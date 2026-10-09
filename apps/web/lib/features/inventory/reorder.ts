import { COUNT_UNITS } from './vocabulary';

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** What the firm holds and expects of one item with a minimum stock, and how it was last bought. */
export type ThresholdRow = {
  itemId: string;
  sku: string;
  name: string;
  uom: string;
  minStock: number;
  /** Usable stock: raw-material and reusable-remnant warehouses. */
  onHand: number;
  reserved: number;
  /** Ordered and not yet received on sent purchase orders. */
  incoming: number;
  /** On purchase orders still in draft. */
  drafted: number;
  /**
   * Reorder policy (migration 043), all optional: stock to fill up to, days a purchase takes, the pack
   * size bought, and the average daily use over the last 90 days.
   */
  policy?: { maxStock: number | null; leadTimeDays: number | null; orderMultiple: number | null; dailyUsage: number };
  last: null | {
    supplierId: string | null;
    supplierName: string | null;
    supplierActive: boolean;
    warehouseId: string;
    /** The last order's warehouse is still an active raw-material warehouse. */
    warehouseUsable: boolean;
    unitPrice: number | null;
    currency: string;
    lengthMm: number | null;
    color: string | null;
    orderNumber: string;
  };
};

export type ReorderLine = { itemId: string; warehouseId: string; quantity: number; unitPrice: number; lengthMm?: number; color: string };
export type ReorderOrder = { supplierId: string; supplierName: string; currency: string; lines: ReorderLine[] };
export type ThresholdStatus =
  | { state: 'ok' }
  | { state: 'covered'; shortfall: number }
  | { state: 'draftable'; shortfall: number; line: ReorderLine; supplierId: string; supplierName: string; currency: string; orderNumber: string }
  | { state: 'unknown'; shortfall: number; reason: string };

export const available = (row: ThresholdRow) => row.onHand - row.reserved;

/**
 * When to buy and up to what: the reorder point is the minimum plus what the firm uses while a
 * purchase is on its way (daily use × lead time); a purchase fills up to the maximum when one is set,
 * otherwise to the reorder point. Without a policy this is the minimum, as before.
 */
export function reorderLevels(row: Pick<ThresholdRow, 'minStock' | 'policy'>) {
  const p = row.policy;
  const cover = p && p.dailyUsage > 0 && (p.leadTimeDays ?? 0) > 0 ? p.dailyUsage * (p.leadTimeDays ?? 0) : 0;
  const reorderPoint = round(row.minStock + cover);
  const target = round(Math.max(reorderPoint, p?.maxStock ?? 0));
  return { reorderPoint, target, cover: round(cover) };
}

/** Rounded up to the pack size the firm buys in (a whole multiple), never below what is needed. */
export const toMultiple = (quantity: number, multiple: number | null | undefined) =>
  multiple && multiple > 0 ? round(Math.ceil(quantity / multiple - 1e-9) * multiple) : quantity;

/** What one purchase order line may hold (the purchase order's own rules). */
const MAX_BARS_PER_LINE = 10000;
const MAX_QUANTITY_PER_LINE = 1000000;

/** The parts of a draft line that the approver agreed to; only the quantity may follow the stock. */
export const lineTerms = (supplierId: string, currency: string, l: ReorderLine) =>
  JSON.stringify([supplierId, currency, l.itemId, l.warehouseId, l.unitPrice, l.lengthMm ?? null, l.color]);


/**
 * Below the threshold when usable stock minus reservations is under the minimum. What to buy brings
 * it back to the minimum, counting what is already ordered or in a draft order, and copies supplier,
 * warehouse, price, bar length and colour from the item's last purchase line; nothing is guessed.
 */
export function thresholdStatus(row: ThresholdRow): ThresholdStatus {
  const { reorderPoint, target } = reorderLevels(row);
  if (!(row.minStock > 0) || available(row) >= reorderPoint) return { state: 'ok' };
  const shortfall = round(target - available(row) - row.incoming - row.drafted);
  if (shortfall <= 0) return { state: 'covered', shortfall: round(target - available(row)) };
  const last = row.last;
  if (!last || !last.supplierId) return { state: 'unknown', shortfall, reason: 'Daha önce satın alınmamış: tedarikçi, fiyat ve depo bilinmiyor' };
  if (!last.supplierActive) return { state: 'unknown', shortfall, reason: `Son tedarikçi (${last.supplierName ?? '—'}) pasif` };
  if (!last.warehouseUsable) return { state: 'unknown', shortfall, reason: 'Son alışın deposu artık etkin bir hammadde deposu değil' };
  if (last.unitPrice === null) return { state: 'unknown', shortfall, reason: 'Son alışta birim fiyat yok' };
  let quantity: number;
  let lengthMm: number | undefined;
  if (row.uom === 'm') {
    if (!last.lengthMm || !last.color) return { state: 'unknown', shortfall, reason: 'Son alışta çubuk boyu veya renk yok' };
    if (!Number.isInteger(last.lengthMm) || last.lengthMm < 100 || last.lengthMm > 30000) return { state: 'unknown', shortfall, reason: 'Son alıştaki çubuk boyu geçersiz' };
    lengthMm = last.lengthMm;
    // Bars of the last bought length, enough to cover the metres.
    quantity = toMultiple(Math.ceil((shortfall * 1000) / lengthMm - 1e-9), row.policy?.orderMultiple);
  } else if (COUNT_UNITS.has(row.uom)) quantity = toMultiple(Math.ceil(shortfall - 1e-9), row.policy?.orderMultiple);
  else quantity = toMultiple(Math.ceil(shortfall * 1000 - 1e-9) / 1000, row.policy?.orderMultiple);
  if (quantity > (row.uom === 'm' ? MAX_BARS_PER_LINE : MAX_QUANTITY_PER_LINE))
    return { state: 'unknown', shortfall, reason: 'Eksik, bir sipariş satırının alabileceğinden fazla; minimum stoğu kontrol edin' };
  return {
    state: 'draftable',
    shortfall,
    supplierId: last.supplierId,
    supplierName: last.supplierName ?? 'adı yok',
    currency: last.currency,
    orderNumber: last.orderNumber,
    line: { itemId: row.itemId, warehouseId: last.warehouseId, quantity, unitPrice: last.unitPrice, ...(lengthMm ? { lengthMm } : {}), color: last.color ?? '' },
  };
}

/** One draft order per supplier and currency, lines and orders in a fixed order. */
export function groupReorder(rows: ThresholdRow[]): ReorderOrder[] {
  const orders = new Map<string, ReorderOrder>();
  for (const row of [...rows].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
    const status = thresholdStatus(row);
    if (status.state !== 'draftable') continue;
    const key = status.supplierId + ':' + status.currency;
    const order = orders.get(key) ?? { supplierId: status.supplierId, supplierName: status.supplierName, currency: status.currency, lines: [] };
    order.lines.push(status.line);
    orders.set(key, order);
  }
  return [...orders.values()].sort((a, b) => (a.supplierId + a.currency).localeCompare(b.supplierId + b.currency));
}
