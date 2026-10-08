import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { groupReorder, lineTerms, thresholdStatus, type ReorderOrder } from '@/lib/features/inventory/reorder';
import { PURCHASE_DRAFT_ROLES, thresholdRows } from '@/lib/features/inventory/thresholds';
import { formatQty } from '@/lib/features/inventory/vocabulary';
import { executeProcurement } from '@/lib/features/manufacturing/purchasing.service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { registerSuggestionKind, type SuggestionActor } from '../kinds';

export const PURCHASE_DRAFT_KIND = 'procurement.purchase_draft';

/** A purchase order takes at most this many lines. */
const LINES_PER_ORDER = 100;

const LineSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  lengthMm: z.number().int().optional(),
  color: z.string(),
});
const PayloadSchema = z.object({
  fingerprint: z.string().length(40),
  orders: z.array(z.object({ supplierId: z.string().uuid(), currency: z.string().max(3), lines: z.array(LineSchema).min(1) })).min(1),
});
type Payload = z.infer<typeof PayloadSchema>;

function split(orders: ReorderOrder[]) {
  return orders.flatMap((order) => {
    const parts: ReorderOrder[] = [];
    for (let i = 0; i < order.lines.length; i += LINES_PER_ORDER) parts.push({ ...order, lines: order.lines.slice(i, i + LINES_PER_ORDER) });
    return parts;
  });
}

/** The situation the card describes: the drafts and the items left out, so either changing refiles it. */
export function reorderFingerprint(orders: ReorderOrder[], leftOut: string[] = []) {
  const shape = orders.map((o) => [o.supplierId, o.currency, o.lines.map((l) => [l.itemId, l.warehouseId, l.quantity, l.unitPrice, l.lengthMm ?? null, l.color])]);
  return createHash('sha256').update(JSON.stringify([shape, [...leftOut].sort()])).digest('hex').slice(0, 40);
}

/**
 * The purchase draft suggestion: items under their minimum stock, not covered by what is already
 * ordered, drafted from each item's last sent purchase line (supplier, warehouse, price, bar length,
 * colour). Items never bought, or bought without what a draft needs, are named and left out. No
 * model is involved and nothing is sent to a supplier: approval only creates draft orders.
 */
export async function refreshPurchaseDraftSuggestion(actor: SuggestionActor) {
  const { fileSuggestion, expireOtherPending } = await import('../service');
  const rows = await thresholdRows(sql, actor.tenantId);
  const statuses = rows.map((row) => ({ row, status: thresholdStatus(row) }));
  const orders = split(groupReorder(rows));
  if (!orders.length) {
    await expireOtherPending(sql, actor.tenantId, PURCHASE_DRAFT_KIND, null);
    return;
  }
  const unknown = statuses.flatMap(({ row, status }) => (status.state === 'unknown' ? [{ id: row.itemId, text: `${row.name}: ${status.reason}` }] : []));
  const fingerprint = reorderFingerprint(orders, unknown.map((u) => u.id + ':' + u.text));
  await expireOtherPending(sql, actor.tenantId, PURCHASE_DRAFT_KIND, fingerprint);
  const byId = new Map(rows.map((r) => [r.itemId, r]));
  const lineCount = orders.reduce((n, o) => n + o.lines.length, 0);
  const describe = (o: ReorderOrder) =>
    `${o.supplierName} (${o.currency}): ` +
    o.lines
      .map((l) => {
        const item = byId.get(l.itemId)!;
        return l.lengthMm ? `${item.name} ${l.quantity} çubuk × ${formatQty(l.lengthMm / 1000)} m, ${l.color}` : `${item.name} ${formatQty(l.quantity, item.uom)}`;
      })
      .join('; ');
  await fileSuggestion(
    sql,
    actor.tenantId,
    null,
    {
      kind: PURCHASE_DRAFT_KIND,
      title: `${lineCount} malzeme minimum stok altında: ${orders.length} taslak satın alma siparişi`,
      rationale: [
        `Kullanılabilir stok (hammadde ve artık depoları, ayrılanlar düşülerek), yoldaki ve taslaktaki siparişlerle birlikte minimumun altında kalan ${lineCount} malzeme için eksik kadar alım önerilir.`,
        ...orders.slice(0, 10).map(describe),
        ...(orders.length > 10 ? [`… ve ${orders.length - 10} sipariş daha.`] : []),
        'Tedarikçi, depo, birim fiyat, çubuk boyu ve renk her malzemenin gönderilmiş son satın alma satırından alındı; fiyatı tedarikçiden teyit edin.',
        ...(unknown.length ? [`Taslağa alınmayan ${unknown.length} malzeme: ${unknown.slice(0, 10).map((u) => u.text).join('; ')}${unknown.length > 10 ? '; …' : ''}.`] : []),
        'Onaylarsanız siparişler taslak olarak açılır; tedarikçiye hiçbir şey gönderilmez, Satın alma ekranından gözden geçirip onaylarsınız. Onay anında stok yeniden hesaplanır: miktar güncel eksiğe göre yazılır, artık gerekmeyen ya da son alış bilgisi değişen satır alınmaz.',
      ].join('\n'),
      payload: { fingerprint, orders: orders.map((o) => ({ supplierId: o.supplierId, currency: o.currency, lines: o.lines })) },
      affected: orders.flatMap((o) => o.lines).slice(0, 50).map((l) => ({ entityType: 'inventory_item', entityId: l.itemId, label: byId.get(l.itemId)!.name.slice(0, 200), href: `/inventory/${l.itemId}` })),
      uncertain: unknown.length > 0,
      uncertaintyNote: unknown.length ? `${unknown.length} malzeme için tedarikçi veya alış bilgisi eksik; emin değilim, bunlar taslağa alınmadı.` : null,
      source: 'system',
      dedupeKey: fingerprint,
    },
    { notAgainAfterRejection: true },
  );
}

registerSuggestionKind<Payload>({
  kind: PURCHASE_DRAFT_KIND,
  label: 'Satın alma taslağı',
  payloadSchema: PayloadSchema,
  roles: PURCHASE_DRAFT_ROLES,
  refresh: refreshPurchaseDraftSuggestion,
  apply: async (tx, actor, payload, suggestion) => {
    // Today's need, read in the approval transaction. A line is drafted only on the terms the card
    // showed (supplier, currency, warehouse, price, length, colour), for what is missing today.
    const today = new Map<string, number>();
    for (const order of groupReorder(await thresholdRows(tx, actor.tenantId)))
      for (const line of order.lines) today.set(lineTerms(order.supplierId, order.currency, line), line.quantity);
    const created: Array<{ id: string; number: string; lines: number }> = [];
    let changed = 0;
    let dropped = 0;
    for (const order of payload.orders) {
      const lines = order.lines.flatMap((line) => {
        const quantity = today.get(lineTerms(order.supplierId, order.currency, line));
        if (quantity === undefined) {
          dropped++;
          return [];
        }
        if (quantity !== line.quantity) changed++;
        return [{ ...line, quantity }];
      });
      if (!lines.length) continue;
      try {
        const po = await executeProcurement(
          tx,
          actor as any,
          'procurement.purchase.create',
          { supplierId: order.supplierId, currency: order.currency, notes: `Stok eşik önerisinden taslak (${suggestion.title})`.slice(0, 1000), lines },
          `ai-suggestion:${suggestion.id}:${created.length}`,
        );
        created.push({ id: po.id, number: po.purchase_order_number, lines: lines.length });
      } catch (error) {
        // A record changed under the card (supplier, warehouse, item): refuse and let it be refiled.
        if (error instanceof WorkOrderApiError && error.status === 400) throw new WorkOrderApiError(`${error.message}. Öneri yenilenecek; listeyi yenileyin.`, 409);
        throw error;
      }
    }
    if (!created.length) throw new WorkOrderApiError('Önerideki malzemeler artık gerekmiyor ya da son alış bilgileri değişti; öneri yenilenecek. Listeyi yenileyin.', 409);
    return { orders: created, changedQuantities: changed, droppedLines: dropped, href: '/purchases' };
  },
});
