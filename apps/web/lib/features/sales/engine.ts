/**
 * Quote → order business rules as pure functions (shared by server and screens). The server
 * enforces every rule; the screens only use them to show what the server will say.
 */

export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** VAT rates a quote may carry (Turkey: 20 general, 10 and 1 reduced, 0 exempt/export). */
export const VAT_RATES = [20, 10, 1, 0] as const;

export type PricedLine = { quantity: number; unitPrice: number; discountPercent: number };

/** Quote totals: line discounts, then the header discount, then VAT on what is left. */
export function quoteTotals(items: PricedLine[], discountPercent = 0, vatPercent = 20) {
  const subtotal = money(items.reduce((sum, i) => sum + money(i.quantity * i.unitPrice * (1 - i.discountPercent / 100)), 0));
  const discountAmount = money((subtotal * discountPercent) / 100);
  const taxAmount = money(((subtotal - discountAmount) * vatPercent) / 100);
  return { subtotal, discountAmount, taxAmount, totalAmount: money(subtotal - discountAmount + taxAmount) };
}

/** The whole discount the customer gets, as a share of the list price (line and header together). */
export function effectiveDiscountPercent(items: PricedLine[], discountPercent = 0) {
  const gross = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  if (gross <= 0) return 0;
  const { subtotal, discountAmount } = quoteTotals(items, discountPercent, 0);
  return money((1 - (subtotal - discountAmount) / gross) * 100);
}

/**
 * Whether sending needs a manager's approval: the discount is above the firm's threshold and no
 * approval covers it (an approval covers up to the percentage approved, not a later larger one).
 */
export function needsDiscountApproval(effective: number, threshold: number, approvedPercent: number | null | undefined) {
  if (effective <= threshold) return false;
  return approvedPercent == null || effective > Number(approvedPercent) + 0.005;
}

/** The total in TRY with the seller's typed rate; null when the rate is missing. */
export function tryEquivalent(total: number, currency: string, fxRate: number | null | undefined) {
  if (currency === 'TRY') return money(total);
  return fxRate && fxRate > 0 ? money(total * fxRate) : null;
}

/** A customer's standing discount for a product family: the family rule wins over the general one. */
export function customerDiscountFor(rules: Array<{ family: string | null; discountPercent: number }>, family: string | null | undefined) {
  const own = family ? rules.find((r) => r.family === family) : undefined;
  return Number((own ?? rules.find((r) => r.family == null))?.discountPercent ?? 0);
}

// Quote revisions ----------------------------------------------------------------------------------

export type SnapshotLine = {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  widthMm?: number | null;
  heightMm?: number | null;
  projectionMm?: number | null;
  color?: string | null;
  notes?: string | null;
};
export type QuoteSnapshot = {
  revision: number;
  currency: string;
  discountPercent: number;
  vatPercent: number;
  validUntil: string | null;
  totalAmount: number;
  notes?: string | null;
  terms?: string | null;
  items: SnapshotLine[];
};
export type FieldChange = { field: string; label: string; from: unknown; to: unknown };
export type LineDiff = { kind: 'added' | 'removed' | 'changed'; productName: string; changes: FieldChange[] };

const LINE_FIELDS: Array<[keyof SnapshotLine, string]> = [
  ['quantity', 'Adet'], ['unitPrice', 'Birim fiyat'], ['discountPercent', 'İndirim %'], ['widthMm', 'Genişlik'],
  ['heightMm', 'Yükseklik'], ['projectionMm', 'Açılım'], ['color', 'Renk'], ['notes', 'Not'],
];
const HEAD_FIELDS: Array<[keyof QuoteSnapshot, string]> = [
  ['currency', 'Para birimi'], ['discountPercent', 'Genel indirim %'], ['vatPercent', 'KDV %'], ['validUntil', 'Geçerlilik'],
  ['totalAmount', 'Toplam'], ['notes', 'Not'], ['terms', 'Koşullar'],
];
const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.005);

/**
 * What changed between two revisions. Lines are matched by product name in order (the first
 * unmatched line with the same name), so a reordered quote shows as changes, not as remove + add.
 */
export function diffQuotes(before: QuoteSnapshot, after: QuoteSnapshot) {
  const header = HEAD_FIELDS.filter(([f]) => !same(before[f], after[f])).map(([f, label]) => ({ field: f, label, from: before[f] ?? null, to: after[f] ?? null }));
  const left = before.items.map((line, i) => ({ line, i, used: false }));
  const lines: LineDiff[] = [];
  for (const line of after.items) {
    const match = left.find((l) => !l.used && l.line.productName === line.productName);
    if (!match) {
      lines.push({ kind: 'added', productName: line.productName, changes: [] });
      continue;
    }
    match.used = true;
    const changes = LINE_FIELDS.filter(([f]) => !same(match.line[f], line[f])).map(([f, label]) => ({ field: f, label, from: match.line[f] ?? null, to: line[f] ?? null }));
    if (changes.length) lines.push({ kind: 'changed', productName: line.productName, changes });
  }
  for (const l of left) if (!l.used) lines.push({ kind: 'removed', productName: l.line.productName, changes: [] });
  return { header, lines, totalDelta: money(after.totalAmount - before.totalAmount) };
}

// Quote validity -----------------------------------------------------------------------------------

export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/** Why a quote may not be sent today (null when it may). */
export function sendBlocker(q: { validUntil: string | null; itemCount: number }, today: string) {
  if (!q.itemCount) return 'Teklif kalemi gerekli';
  if (q.validUntil && q.validUntil < today) return 'Geçerlilik tarihi geçmiş; yeni tarih verin';
  return null;
}

// Orders ------------------------------------------------------------------------------------------

/** A line's delivery state from what was ordered and what has gone to the customer. */
export function lineDeliveryStatus(ordered: number, delivered: number): 'open' | 'partial' | 'delivered' {
  if (delivered <= 0) return 'open';
  return delivered + 1e-9 >= ordered ? 'delivered' : 'partial';
}

/** Days late against the promise: positive when late (to the delivery day, or to today while open). */
export function slipDays(promised: string | null | undefined, delivered: string | null | undefined, today: string) {
  if (!promised) return null;
  const end = delivered ?? today;
  if (!delivered && end <= promised) return 0;
  return Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(promised + 'T00:00:00Z')) / 86_400_000);
}

export type Installment = { seq: number; label: string; dueOn: string; amount: number };
export type InstallmentState = Installment & { paid: number; remaining: number; state: 'paid' | 'partial' | 'overdue' | 'today' | 'planned' };

/** A payment plan must cover the order total exactly (to the kuruş) with positive amounts. */
export function planProblem(plan: Array<{ amount: number; dueOn: string; label: string }>, orderTotal: number) {
  if (!plan.length) return 'En az bir taksit gerekli';
  if (plan.length > 24) return 'En fazla 24 taksit';
  if (plan.some((p) => !(p.amount > 0))) return 'Taksit tutarı sıfırdan büyük olmalı';
  if (plan.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.dueOn))) return 'Taksit tarihi gerekli';
  const sum = money(plan.reduce((s, p) => s + p.amount, 0));
  if (Math.abs(sum - money(orderTotal)) > 0.009) return `Taksitlerin toplamı (${sum.toFixed(2)}) sipariş tutarına (${money(orderTotal).toFixed(2)}) eşit olmalı`;
  return null;
}

/** Payments received are applied to installments in order; what is unpaid after its day is overdue. */
export function allocatePayments(plan: Installment[], paidTotal: number, today: string) {
  let pool = money(paidTotal);
  const rows: InstallmentState[] = [...plan].sort((a, b) => a.seq - b.seq).map((p) => {
    const paid = money(Math.min(pool, p.amount));
    pool = money(pool - paid);
    const remaining = money(p.amount - paid);
    const state = remaining <= 0 ? 'paid' : p.dueOn < today ? 'overdue' : p.dueOn === today ? 'today' : paid > 0 ? 'partial' : 'planned';
    return { ...p, paid, remaining, state };
  });
  const planned = money(plan.reduce((s, p) => s + p.amount, 0));
  return {
    rows,
    planned,
    paid: money(Math.min(paidTotal, planned)),
    overdue: money(rows.filter((r) => r.state === 'overdue').reduce((s, r) => s + r.remaining, 0)),
    next: rows.find((r) => r.remaining > 0) ?? null,
    surplus: pool,
  };
}

// Change orders -----------------------------------------------------------------------------------

export const PRODUCTION_FIELDS = ['quantity', 'widthMm', 'heightMm', 'projectionMm', 'color'] as const;
export type LineChange = { orderItemId: string; quantity?: number; widthMm?: number; heightMm?: number; projectionMm?: number; color?: string; unitPrice?: number; notes?: string };
export type LineState = {
  orderItemId: string;
  productName: string;
  quantity: number;
  delivered: number;
  workOrders: Array<{ status: string; producedQty: number }>;
};
export type ChangeImpact = { level: 'none' | 'warn' | 'block'; reasons: string[] };

const CLOSED_ORDER = ['shipped', 'delivered', 'completed', 'cancelled'];

/**
 * What a change does to production: closed orders and delivered lines cannot change; a line whose
 * work has started warns of scrap; an open work order warns that its cut list must be redone.
 * Price and note changes do not touch production.
 */
export function changeImpact(orderStatus: string, lines: LineState[], changes: LineChange[]): ChangeImpact {
  const reasons: string[] = [];
  let level: ChangeImpact['level'] = 'none';
  const raise = (to: ChangeImpact['level'], why: string) => {
    if (to === 'block' || (to === 'warn' && level === 'none')) level = to;
    reasons.push(why);
  };
  if (CLOSED_ORDER.includes(orderStatus)) raise('block', 'Sevk edilmiş, kapanmış ya da iptal edilmiş sipariş değiştirilemez');
  for (const c of changes) {
    const line = lines.find((l) => l.orderItemId === c.orderItemId);
    if (!line) {
      raise('block', 'Satır bu siparişte yok');
      continue;
    }
    const touchesProduction = PRODUCTION_FIELDS.some((f) => c[f] !== undefined);
    if (c.quantity !== undefined && c.quantity < line.delivered) raise('block', `${line.productName}: teslim edilen ${line.delivered} adetten aza indirilemez`);
    else if (line.delivered > 0 && touchesProduction && PRODUCTION_FIELDS.some((f) => f !== 'quantity' && c[f] !== undefined)) raise('block', `${line.productName}: teslim edilmiş ürünün ölçü/rengi değişemez`);
    if (!touchesProduction) continue;
    const active = line.workOrders.filter((w) => w.status !== 'cancelled');
    if (active.some((w) => w.status === 'done' || w.status === 'in_progress' || w.producedQty > 0))
      raise('warn', `${line.productName}: üretim başladı; kesilen parçalar hurdaya gidebilir`);
    else if (active.length) raise('warn', `${line.productName}: iş emri açık; kesim listesi ve malzeme yeniden hesaplanmalı`);
  }
  return { level, reasons };
}
