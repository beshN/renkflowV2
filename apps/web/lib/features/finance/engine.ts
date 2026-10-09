/**
 * Finance rules (pure): invoice totals, what is left to invoice on an order, due dates, how
 * collections settle invoices, receivable aging, the customer statement, and an order's estimated
 * profit. No database, no clock: callers pass "today".
 */

export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const qty = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export const COLLECTION_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card'] as const;
export type CollectionMethod = (typeof COLLECTION_METHODS)[number];
export const COLLECTION_METHOD_LABELS: Record<string, string> = { cash: 'Nakit', bank_transfer: 'Havale/EFT', check: 'Çek', credit_card: 'Kart', card: 'Kart', other: 'Diğer' };

export const INVOICE_STATUSES = ['draft', 'issued', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { draft: 'Taslak', issued: 'Kesildi', cancelled: 'İptal' };
export const DEFAULT_VAT_PERCENT = 20;
export const DEFAULT_PAYMENT_TERMS_DAYS = 30;

// Invoice lines ---------------------------------------------------------------------------------

export type LineInput = { quantity: number; unitPrice: number; vatPercent: number };
/** One line: net = quantity × unit price, VAT on the net, both rounded to kuruş per line. */
export function lineTotals(l: LineInput) {
  const net = money(l.quantity * l.unitPrice);
  const vat = money((net * l.vatPercent) / 100);
  return { net, vat, gross: money(net + vat) };
}
/** Invoice totals are the sum of the rounded lines (what is printed adds up). */
export function invoiceTotals(lines: LineInput[]) {
  const t = lines.map(lineTotals);
  const subtotal = money(t.reduce((s, x) => s + x.net, 0));
  const vatTotal = money(t.reduce((s, x) => s + x.vat, 0));
  return { subtotal, vatTotal, total: money(subtotal + vatTotal) };
}

export type OrderLine = { id: string; description: string; quantity: number; unitPrice: number };
/** Each order line with what is already on (non-cancelled) invoices and what is left to invoice. */
export function invoiceableLines(lines: OrderLine[], invoiced: Record<string, number>) {
  return lines.map((l) => {
    const done = qty(invoiced[l.id] ?? 0);
    return { ...l, invoiced: done, remaining: Math.max(0, qty(l.quantity - done)) };
  });
}

/**
 * Problems with a draft taken from an order: no line, a line that is not on the order, more than
 * is left to invoice, a quantity of zero or below. Empty list = the draft is fine.
 */
export function draftProblems(draft: Array<{ orderItemId: string | null; quantity: number }>, left: ReturnType<typeof invoiceableLines>) {
  const out: string[] = [];
  if (!draft.length) out.push('Faturaya en az bir kalem ekleyin');
  const asked = new Map<string, number>();
  for (const d of draft) {
    if (!(d.quantity > 0)) out.push('Miktar sıfırdan büyük olmalı');
    if (!d.orderItemId) continue;
    asked.set(d.orderItemId, qty((asked.get(d.orderItemId) ?? 0) + d.quantity));
  }
  for (const [id, n] of asked) {
    const l = left.find((x) => x.id === id);
    if (!l) out.push('Kalem bu siparişte yok');
    else if (n > l.remaining + 1e-9) out.push(`${l.description}: kalan ${l.remaining}, istenen ${n}`);
  }
  return [...new Set(out)];
}

const DAY = 86_400_000;
const dayNum = (d: string) => Date.parse(d.slice(0, 10) + 'T00:00:00Z');
export const addDays = (d: string, n: number) => new Date(dayNum(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((dayNum(to) - dayNum(from)) / DAY);
/** Due date from the customer's payment terms (days); no terms → 30 days. */
export const dueDate = (issuedOn: string, termsDays: number | null | undefined) => addDays(issuedOn, termsDays === null || termsDays === undefined || !(termsDays >= 0) ? DEFAULT_PAYMENT_TERMS_DAYS : Math.round(termsDays));

// Receivables -----------------------------------------------------------------------------------

export type OpenInvoice = { id: string; number: string; issuedOn: string; dueOn: string; total: number };
export type SettledInvoice = OpenInvoice & { paid: number; open: number; daysOverdue: number };

/**
 * A customer's collections settle their invoices oldest due first (FIFO). What is left over is an
 * advance (credit) — money in before an invoice.
 */
export function settle(invoices: OpenInvoice[], collected: number, today: string) {
  let pool = money(Math.max(0, collected));
  const sorted = [...invoices].sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.issuedOn.localeCompare(b.issuedOn) || a.number.localeCompare(b.number));
  const items: SettledInvoice[] = sorted.map((inv) => {
    const paid = money(Math.min(pool, inv.total));
    pool = money(pool - paid);
    return { ...inv, paid, open: money(inv.total - paid), daysOverdue: Math.max(0, daysBetween(inv.dueOn, today)) };
  });
  return { items, advance: pool };
}

export const AGING_BUCKETS = ['notDue', 'd0_30', 'd31_60', 'd60plus'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export const AGING_LABELS: Record<AgingBucket, string> = { notDue: 'Vadesi gelmedi', d0_30: '0–30 gün', d31_60: '31–60 gün', d60plus: '60+ gün' };

/** Which bucket an open amount is in by days past due (due today = 0–30, not yet due = notDue). */
export function agingBucket(dueOn: string, today: string): AgingBucket {
  const late = daysBetween(dueOn, today);
  if (late < 0) return 'notDue';
  if (late <= 30) return 'd0_30';
  if (late <= 60) return 'd31_60';
  return 'd60plus';
}

/** The open amount of settled invoices split into aging buckets, with the total. */
export function aging(items: SettledInvoice[], today: string) {
  const b: Record<AgingBucket, number> = { notDue: 0, d0_30: 0, d31_60: 0, d60plus: 0 };
  for (const i of items) if (i.open > 0) b[agingBucket(i.dueOn, today)] = money(b[agingBucket(i.dueOn, today)] + i.open);
  const total = money(AGING_BUCKETS.reduce((s, k) => s + b[k], 0));
  return { ...b, total, overdue: money(total - b.notDue) };
}

/** Open invoices past their due date (the ones that make a reminder). */
export const overdueInvoices = (items: SettledInvoice[], today: string) => items.filter((i) => i.open > 0 && daysBetween(i.dueOn, today) > 0);

export type StatementEntry = { on: string; kind: 'invoice' | 'collection' | 'cancel'; ref: string; text: string; debit: number; credit: number };
/**
 * Customer statement (ekstre) for a period: the balance brought forward from before it, every
 * movement in it with a running balance (debit = invoice, credit = collection), the closing balance.
 * A positive balance is what the customer owes; negative is their advance.
 */
export function statement(entries: StatementEntry[], from: string, to: string) {
  const sorted = [...entries].sort((a, b) => a.on.localeCompare(b.on) || (a.kind === 'invoice' ? -1 : 1) - (b.kind === 'invoice' ? -1 : 1) || a.ref.localeCompare(b.ref));
  const before = sorted.filter((e) => e.on.slice(0, 10) < from);
  const opening = money(before.reduce((s, e) => s + e.debit - e.credit, 0));
  let running = opening;
  const lines = sorted.filter((e) => e.on.slice(0, 10) >= from && e.on.slice(0, 10) <= to).map((e) => {
    running = money(running + e.debit - e.credit);
    return { ...e, balance: running };
  });
  return {
    opening, lines, closing: running,
    debit: money(lines.reduce((s, e) => s + e.debit, 0)), credit: money(lines.reduce((s, e) => s + e.credit, 0)),
  };
}

// Estimated profit ------------------------------------------------------------------------------

export type ProfitInput = {
  /** Order lines net of VAT; null when the order has no lines (then the total is used, flagged). */
  revenueNet: number | null;
  orderTotal: number;
  /** Material issued to the order's work orders: priced lots and how many lots had no cost. */
  material: { amount: number; unpricedLots: number; lots: number };
  /** Production time (seconds) and the firm's hourly labour cost (null when not set). */
  labor: { seconds: number; ratePerHour: number | null };
  rework: number;
};

/**
 * Estimated profit of an order from what the system knows. Nothing is guessed: a missing hourly
 * rate or unpriced material is listed as a gap, and the estimate is marked incomplete.
 */
export function estimateProfit(p: ProfitInput) {
  const gaps: string[] = [];
  let revenue = p.revenueNet;
  if (revenue === null) { revenue = p.orderTotal; gaps.push('Sipariş kalemi yok; sipariş toplamı (KDV dahil olabilir) gelir sayıldı'); }
  if (!p.material.lots) gaps.push('İş emrine malzeme çıkışı kaydı yok');
  else if (p.material.unpricedLots) gaps.push(`${p.material.unpricedLots} malzeme lotunun birim maliyeti yok`);
  let labor: number | null = null;
  if (p.labor.seconds > 0) {
    if (p.labor.ratePerHour === null) gaps.push('Saatlik işçilik maliyeti ayarlanmamış (Üretim ayarları)');
    else labor = money((p.labor.seconds / 3600) * p.labor.ratePerHour);
  } else gaps.push('Üretim süresi kaydı yok');
  const material = money(p.material.amount);
  const cost = money(material + (labor ?? 0) + p.rework);
  // No cost record at all: there is no profit to show (it would read as 100%). With some costs
  // missing, the figure is an upper bound — missing costs can only lower it.
  const anyCost = p.material.lots > 0 || labor !== null || p.rework > 0;
  const profit = anyCost ? money(revenue - cost) : null;
  return {
    revenue: money(revenue), material, labor, rework: money(p.rework), cost, profit,
    marginPercent: profit !== null && revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null,
    complete: gaps.length === 0, upperBound: profit !== null && gaps.length > 0, gaps,
  };
}

/** Key a customer by id, or by name when the order has no customer card. */
export const customerKey = (id: string | null | undefined, name: string | null | undefined) => (id ? `id:${id}` : `name:${(name ?? '').trim().toLocaleLowerCase('tr-TR')}`);
