import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { columnExists, tableExists } from '@/lib/db/schema-guard';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can, type Action } from '@/lib/security/access-matrix';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { exemptionCode, UNIT_CODES, withholdingCode, type UnitCode } from '@/lib/features/einvoice/codes';
import { cancelEBelge, eBelgeProvider, invoiceDocument, prepareEBelge, retryEInvoice, ublInput } from '@/lib/features/einvoice/document.server';
import { buildUblInvoice } from '@/lib/features/einvoice/ubl';
import { syncLedger } from '@/lib/features/accounting/posting.server';
import { effectiveRate } from '@/lib/features/fx/rates.server';
import {
  COLLECTION_METHODS, DEFAULT_VAT_PERCENT, draftProblems, dueDate, estimateProfit, headerDiscountRatio, invoiceTotals, invoiceableLines, lineTotals, money, roundTo,
} from './engine';

type Row = Record<string, any>;
const iso = (d: unknown) => (d ? (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) : null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const istanbulToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const fail = (message: string, status = 400): never => { throw new WorkOrderApiError(message, status); };
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => new Date(Date.parse(d + 'T00:00:00Z') || 0).toISOString().slice(0, 10) === d, 'Geçerli bir gün değil');

/**
 * Finance is for the owner, admins and accounting (the member's finance cell). A worker, or anyone
 * without the cell, gets 404 as if there were nothing; a missing action is 403.
 */
export async function requireFinance(actor: WorkOrderActor, action: Action = 'view') {
  if (!(await tableExists('invoices'))) fail('Fatura ve tahsilat için veritabanı güncellemesi (047) bekleniyor', 409);
  if (actor.role === 'worker') fail('Bulunamadı', 404);
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated) fail('Unauthorized', 401);
  if (!can(access!, 'finance', 'view')) fail('Bulunamadı', 404);
  if (!can(access!, 'finance', action)) fail('Bu işlem için yetkiniz yok', 403);
}

/**
 * A closed accounting month takes no new invoice or collection (the same rule and locking as
 * payments): the period row is created open if missing and held FOR SHARE, so a close waits.
 */
async function writablePeriod(tx: any, tenantId: string, date: string) {
  if (!(await tableExists('accounting_period_closes'))) return;
  const period = date.slice(0, 7);
  await tx`INSERT INTO accounting_period_closes (tenant_id, period, status) VALUES (${tenantId}, ${period}, 'open') ON CONFLICT (tenant_id, period) DO NOTHING`;
  const [row] = await tx`SELECT status FROM accounting_period_closes WHERE tenant_id = ${tenantId} AND period = ${period} FOR SHARE`;
  if (row?.status === 'hard_closed') fail('Bu muhasebe dönemi kapalı. Önce dönemi açın.');
}

/**
 * How the order prices its lines: the VAT of the quote it came from (else 20%), and — for an order
 * from a quote — the share of the lines' net it really charges after the quote's header discount.
 * An order typed by hand keeps its line prices as they are.
 */
async function orderPricing(db: any, tenantId: string, orderId: string, orderGross: number) {
  const [q] = (await columnExists('quotations', 'vat_percent'))
    ? await db`SELECT vat_percent FROM quotations WHERE tenant_id = ${tenantId} AND converted_to_order_id = ${orderId} ORDER BY created_at DESC LIMIT 1`
    : [];
  const vat = q ? Number(q.vat_percent) : DEFAULT_VAT_PERCENT;
  const [n] = await db`SELECT coalesce(sum(total_price), 0) AS net, count(*)::int AS lines FROM order_items WHERE order_id = ${orderId}`;
  return { vat, ratio: q ? headerDiscountRatio(orderGross, vat, Number(n.net)) : 1, linesNet: Number(n.net), lines: Number(n.lines) };
}

async function loadOrder(db: any, tenantId: string, orderId: string, lock = false) {
  const [o] = lock
    ? await db`SELECT id, order_number, customer_id, customer_name, total_amount, currency, status FROM orders WHERE tenant_id = ${tenantId} AND id = ${orderId} FOR UPDATE`
    : await db`SELECT id, order_number, customer_id, customer_name, total_amount, currency, status FROM orders WHERE tenant_id = ${tenantId} AND id = ${orderId}`;
  if (!o) fail('Sipariş bulunamadı', 404);
  return o;
}

/** What each order line has on non-cancelled invoices (drafts count, so two drafts cannot double-bill). */
async function invoicedByItem(db: any, tenantId: string, orderId: string) {
  const rows = await db`SELECT l.order_item_id, sum(l.quantity) AS q FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
    WHERE i.tenant_id = ${tenantId} AND i.order_id = ${orderId} AND i.status <> 'cancelled' AND l.order_item_id IS NOT NULL GROUP BY l.order_item_id`;
  return Object.fromEntries(rows.map((r: Row) => [String(r.order_item_id), Number(r.q)]));
}

/** Order lines at the price really charged: the line's net (line discount in) per unit, × the header-discount share. */
async function orderLines(db: any, orderId: string, ratio: number) {
  const items = await db`SELECT id, product_name, description, quantity, unit_price, total_price FROM order_items WHERE order_id = ${orderId} ORDER BY created_at, id`;
  return items.map((i: Row) => {
    const q = Number(i.quantity);
    const unit = q > 0 ? Number(i.total_price) / q : Number(i.unit_price);
    return { id: String(i.id), description: [i.product_name, i.description].filter(Boolean).join(' — ').slice(0, 300), quantity: q, unitPrice: roundTo(unit * ratio, 4) };
  });
}

/** What the buyer owes on an invoice: total less withheld VAT (053), or the total on older ones. */
const payable = (i: Row) => Number(i.payable_total ?? i.total);

const invoiceDto = (i: Row) => ({
  id: String(i.id), number: i.invoice_number ?? null, status: i.status as string, orderId: String(i.order_id), orderNumber: i.order_number ?? null,
  customerName: i.customer_name as string, issuedOn: iso(i.issued_on), dueOn: iso(i.due_on), currency: i.currency as string,
  // 'grandTotal', not 'total': a whole-number 'total' next to a list reads as a page count to the redactor.
  subtotal: Number(i.subtotal), vatTotal: Number(i.vat_total), grandTotal: Number(i.total), withholdingTotal: Number(i.withholding_total ?? 0), payableTotal: payable(i), typeCode: (i.invoice_type_code ?? 'SATIS') as string, eInvoice: i.e_invoice_status as string,
  documentType: (i.document_type ?? null) as string | null, ettn: i.ettn ? String(i.ettn) : null, eInvoiceError: (i.e_invoice_error ?? null) as string | null,
  cancelReason: i.cancel_reason ?? null, createdAt: i.created_at,
});

/**
 * Estimated profit of an order from the system's own records: order lines (net), material lots
 * issued to its work orders, production time × the firm's hourly labour cost, rework. Gaps are named.
 */
export async function orderProfit(tenantId: string, orderId: string, orderTotal: number, currency: string) {
  const pricing = await orderPricing(sql, tenantId, orderId, orderTotal);
  const linked = (await columnExists('work_orders', 'order_item_id'))
    ? (await sql`SELECT w.id FROM work_orders w JOIN order_items oi ON oi.id = w.order_item_id WHERE w.tenant_id = ${tenantId} AND oi.order_id = ${orderId}`).map((w: Row) => String(w.id))
    : [];
  let material = { amount: 0, unpricedLots: 0, lots: 0 };
  let seconds = 0;
  let rework = 0;
  if (linked.length) {
    if (await tableExists('work_order_material_lots')) {
      const [m] = await sql`SELECT count(*)::int AS lots, count(*) FILTER (WHERE unit_cost IS NULL OR (currency IS NOT NULL AND currency <> ${currency}))::int AS unpriced,
          coalesce(sum(quantity * unit_cost) FILTER (WHERE unit_cost IS NOT NULL AND (currency IS NULL OR currency = ${currency})), 0) AS amount
        FROM work_order_material_lots WHERE tenant_id = ${tenantId} AND work_order_id = ANY(${linked}::uuid[])`;
      material = { amount: Number(m.amount), unpricedLots: Number(m.unpriced), lots: Number(m.lots) };
    }
    if (await tableExists('production_operations')) {
      const [s] = await sql`SELECT coalesce(sum(active_seconds), 0) AS s FROM production_operations WHERE tenant_id = ${tenantId} AND work_order_id = ANY(${linked}::uuid[])`;
      seconds = Number(s.s);
    }
    if (await columnExists('production_rework', 'profile_cost')) {
      const [r] = await sql`SELECT coalesce(sum(profile_cost), 0) AS c FROM production_rework WHERE tenant_id = ${tenantId} AND work_order_id = ANY(${linked}::uuid[])`;
      rework = Number(r.c);
    }
  }
  let rate: number | null = null;
  if (await columnExists('manufacturing_preferences', 'labor_cost_per_hour')) {
    const [p] = await sql`SELECT labor_cost_per_hour, labor_currency FROM manufacturing_preferences WHERE tenant_id = ${tenantId}`;
    if (p?.labor_cost_per_hour !== null && p?.labor_cost_per_hour !== undefined && (!p.labor_currency || p.labor_currency === currency)) rate = Number(p.labor_cost_per_hour);
  }
  const e = estimateProfit({ revenueNet: pricing.lines ? money(pricing.linesNet * pricing.ratio) : null, orderTotal, material, labor: { seconds, ratePerHour: rate }, rework });
  return {
    revenueNet: e.revenue, materialCost: e.material, laborCost: e.labor, reworkCost: e.rework, cost: e.cost, profit: e.profit, marginPercent: e.marginPercent,
    complete: e.complete, upperBound: e.upperBound, gaps: e.gaps, workOrders: linked.length,
  };
}

/** The order's billing: what is left to invoice, its invoices, collections, balance, estimated profit. */
export async function orderBilling(actor: WorkOrderActor, orderId: string) {
  await requireFinance(actor);
  const o = await loadOrder(sql, actor.tenantId, orderId);
  const pricing = await orderPricing(sql, actor.tenantId, orderId, Number(o.total_amount));
  const [lines, invoiced, invoices, payments] = await Promise.all([
    orderLines(sql, orderId, pricing.ratio),
    invoicedByItem(sql, actor.tenantId, orderId),
    sql`SELECT * FROM invoices WHERE tenant_id = ${actor.tenantId} AND order_id = ${orderId} ORDER BY created_at`,
    sql`SELECT p.id, p.amount, p.currency, p.method, p.paid_at, p.note, p.reference, p.cheque_due_on, p.invoice_id, i.invoice_number FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id
      WHERE p.tenant_id = ${actor.tenantId} AND p.order_id = ${orderId} ORDER BY p.paid_at`,
  ]);
  const ids = invoices.map((i: Row) => i.id);
  const invLines = ids.length ? await sql`SELECT * FROM invoice_lines WHERE invoice_id = ANY(${ids}::uuid[]) ORDER BY position` : [];
  const total = Number(o.total_amount);
  const issued = invoices.filter((i: Row) => i.status === 'issued');
  const collected = money(payments.reduce((s: number, p: Row) => s + Number(p.amount), 0));
  return {
    order: { id: String(o.id), number: o.order_number as string, customerName: o.customer_name as string, total, currency: o.currency as string },
    vatPercent: pricing.vat, headerDiscount: pricing.ratio < 1 ? Math.round((1 - pricing.ratio) * 1000) / 10 : 0,
    lines: invoiceableLines(lines, invoiced),
    invoices: invoices.map((i: Row) => ({
      ...invoiceDto({ ...i, order_number: o.order_number }),
      lines: invLines.filter((l: Row) => String(l.invoice_id) === String(i.id)).map((l: Row) => ({ id: String(l.id), orderItemId: l.order_item_id ? String(l.order_item_id) : null, description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unit_price), vatPercent: Number(l.vat_percent), netAmount: Number(l.net_amount), vatAmount: Number(l.vat_amount) })),
    })),
    payments: payments.map((p: Row) => ({ id: String(p.id), amount: Number(p.amount), currency: p.currency, method: p.method, paidAt: p.paid_at, note: p.note ?? null, reference: p.reference ?? null, chequeDueOn: iso(p.cheque_due_on), invoiceId: p.invoice_id ? String(p.invoice_id) : null, invoiceNumber: p.invoice_number ?? null })),
    summary: { invoiceTotal: money(issued.reduce((s: number, i: Row) => s + Number(i.total), 0)), collected, balance: money(Math.max(total, issued.reduce((s: number, i: Row) => s + payable(i), 0)) - collected) },
    estimatedProfit: await orderProfit(actor.tenantId, orderId, total, String(o.currency)),
  };
}

// Per-line tax treatment (e-Belge): GİB withholding / exemption codes from lib/features/einvoice/codes.ts.
const LineTax = {
  withholdingCode: z.string().trim().refine((c) => !!withholdingCode(c), 'Tanınmayan tevkifat kodu').nullish(),
  exemptionCode: z.string().trim().refine((c) => !!exemptionCode(c), 'Tanınmayan istisna kodu').nullish(),
  exemptionReason: z.string().trim().max(250).nullish(),
  unitCode: z.enum(Object.keys(UNIT_CODES) as [UnitCode, ...UnitCode[]]).optional(),
};
const DraftInput = z.object({
  lines: z.array(z.object({ orderItemId: z.string().uuid(), quantity: z.coerce.number().positive().max(1e6), ...LineTax })).max(200).default([]),
  extra: z.array(z.object({ description: z.string().trim().min(1).max(300), quantity: z.coerce.number().positive().max(1e6), unitPrice: z.coerce.number().min(0).max(1e9), ...LineTax })).max(20).default([]),
  vatPercent: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).nullish(),
}).strict();

type LineTaxInput = { withholdingCode?: string | null; exemptionCode?: string | null; exemptionReason?: string | null; unitCode?: UnitCode };
function lineTax(l: LineTaxInput) {
  return {
    withholdingCode: l.withholdingCode || null,
    withholdingPercent: withholdingCode(l.withholdingCode)?.percent ?? 0,
    exemptionCode: l.exemptionCode || null,
    exemptionReason: l.exemptionReason || null,
    unitCode: l.unitCode ?? 'C62',
  };
}
/** SATIS, or TEVKIFAT / ISTISNA when a line needs it (GİB checks the pairing). */
export function invoiceTypeCode(lines: Array<{ withholdingCode: string | null; exemptionCode: string | null }>): 'SATIS' | 'TEVKIFAT' | 'ISTISNA' {
  if (lines.some((l) => l.withholdingCode)) return 'TEVKIFAT';
  if (lines.some((l) => exemptionCode(l.exemptionCode)?.invoiceType === 'ISTISNA')) return 'ISTISNA';
  return 'SATIS';
}

/** A draft invoice from an order: some or all of what is left on each line, plus free lines (shipping). */
export async function createInvoiceDraft(actor: WorkOrderActor, orderId: string, raw: unknown) {
  await requireFinance(actor, 'create');
  const d = DraftInput.parse(raw);
  return withTransaction(async (tx: any) => {
    const o = await loadOrder(tx, actor.tenantId, orderId, true);
    const pricing = await orderPricing(tx, actor.tenantId, orderId, Number(o.total_amount));
    const left = invoiceableLines(await orderLines(tx, orderId, pricing.ratio), await invoicedByItem(tx, actor.tenantId, orderId));
    const problems = draftProblems([...d.lines, ...d.extra.map((e) => ({ orderItemId: null, quantity: e.quantity }))], left);
    if (problems.length) fail(problems.join('; '));
    const vat = d.vatPercent ?? pricing.vat;
    const lines = [
      ...d.lines.map((l) => { const src = left.find((x) => x.id === l.orderItemId)!; return { orderItemId: l.orderItemId, description: src.description || 'Kalem', quantity: l.quantity, unitPrice: src.unitPrice, vatPercent: vat, ...lineTax(l) }; }),
      ...d.extra.map((e) => ({ orderItemId: null, description: e.description, quantity: e.quantity, unitPrice: e.unitPrice, vatPercent: vat, ...lineTax(e) })),
    ];
    const t = invoiceTotals(lines);
    // Columns of migration 053; before it, invoices keep the plain sale model.
    const eBelgeColumns = await columnExists('invoices', 'payable_total');
    if (!eBelgeColumns && lines.some((l) => l.withholdingCode || l.exemptionCode)) fail('Tevkifat ve istisna bu kurulumda henüz etkin değil');
    const [c] = o.customer_id ? await tx`SELECT * FROM customers WHERE tenant_id = ${actor.tenantId} AND id = ${o.customer_id}` : [null];
    const [inv] = await tx`INSERT INTO invoices (tenant_id, order_id, customer_id, customer_name, customer_tax_number, customer_tax_office, customer_address, currency, subtotal, vat_total, total, notes, created_by)
      VALUES (${actor.tenantId}, ${orderId}, ${o.customer_id ?? null}, ${(c?.company_name || c?.full_name || o.customer_name || 'Müşteri') as string}, ${c?.tax_number ?? null}, ${c?.tax_office ?? null},
        ${c?.billing_address ?? c?.address ?? null}, ${o.currency ?? 'TRY'}, ${t.subtotal}, ${t.vatTotal}, ${t.total}, ${d.notes || null}, ${actor.userId}) RETURNING id`;
    if (eBelgeColumns) {
      await tx`UPDATE invoices SET withholding_total = ${t.withholdingTotal}, payable_total = ${t.payable}, invoice_type_code = ${invoiceTypeCode(lines)} WHERE id = ${inv.id}`;
    }
    if (c && (await columnExists('invoices', 'customer_city'))) {
      await tx`UPDATE invoices SET customer_city = ${c.city ?? null}, customer_district = ${c.district ?? null} WHERE id = ${inv.id}`;
    }
    let position = 0;
    for (const l of lines) {
      const x = lineTotals(l);
      const [line] = await tx`INSERT INTO invoice_lines (tenant_id, invoice_id, order_item_id, position, description, quantity, unit_price, vat_percent, net_amount, vat_amount)
        VALUES (${actor.tenantId}, ${inv.id}, ${l.orderItemId}, ${position++}, ${l.description}, ${l.quantity}, ${l.unitPrice}, ${l.vatPercent}, ${x.net}, ${x.vat}) RETURNING id`;
      if (eBelgeColumns) {
        await tx`UPDATE invoice_lines SET unit_code = ${l.unitCode}, withholding_code = ${l.withholdingCode}, withholding_percent = ${l.withholdingPercent},
          withholding_amount = ${x.withholding}, exemption_code = ${l.exemptionCode}, exemption_reason = ${l.exemptionReason} WHERE id = ${line.id}`;
      }
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: orderId, action: 'invoice_drafted', metadata: { invoiceId: inv.id, lines: lines.length, total: t.total, withholding: t.withholdingTotal } });
    return { id: String(inv.id), ...t };
  });
}

async function loadInvoice(tx: any, tenantId: string, id: string) {
  const [i] = await tx`SELECT * FROM invoices WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE`;
  if (!i) fail('Fatura bulunamadı', 404);
  return i;
}

/** The firm's next invoice number (FTR-000001), serialized per firm; drafts take none. */
async function nextInvoiceNumber(tx: any, tenantId: string) {
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ':invoices'}, 0))`;
  const [r] = await tx`SELECT max(substring(invoice_number FROM '^FTR-(\\d+)$')::bigint) AS n FROM invoices WHERE tenant_id = ${tenantId}`;
  return `FTR-${String(Number(r?.n ?? 0) + 1).padStart(6, '0')}`;
}

const IssueInput = z.object({ issuedOn: day.optional(), dueOn: day.optional() }).strict();

/** Issue a draft: it gets a number, a date and a due date (customer terms) and cannot change after. */
export async function issueInvoice(actor: WorkOrderActor, id: string, raw: unknown) {
  await requireFinance(actor, 'edit');
  const d = IssueInput.parse(raw ?? {});
  return withTransaction(async (tx: any) => {
    const i = await loadInvoice(tx, actor.tenantId, id);
    if (i.status !== 'draft') fail('Yalnız taslak fatura kesilebilir', 409);
    const issuedOn = d.issuedOn ?? istanbulToday();
    await writablePeriod(tx, actor.tenantId, issuedOn);
    let terms: number | null = null;
    if (i.customer_id && (await columnExists('customers', 'payment_terms'))) {
      const [c] = await tx`SELECT payment_terms FROM customers WHERE tenant_id = ${actor.tenantId} AND id = ${i.customer_id}`;
      terms = num(c?.payment_terms);
    }
    const dueOn = d.dueOn ?? dueDate(issuedOn, terms);
    if (dueOn < issuedOn) fail('Vade, fatura tarihinden önce olamaz');
    // A foreign-currency invoice takes the TCMB forex buying rate in force on its date (unless one
    // was entered): the ledger and the e-Belge both need it.
    if (i.currency && i.currency !== 'TRY' && !i.exchange_rate && (await columnExists('invoices', 'exchange_rate'))) {
      const fx = await effectiveRate(tx, i.currency, issuedOn).catch(() => null);
      if (fx) {
        await tx`UPDATE invoices SET exchange_rate = ${fx.rate} WHERE id = ${id}`;
        i.exchange_rate = fx.rate;
      }
    }
    // With an e-Belge provider the number comes from the GİB series and the invoice is queued for
    // sending; without one it keeps the firm's internal FTR- numbering.
    const provider = await eBelgeProvider();
    const eBelge = provider ? await prepareEBelge(tx, provider, i, issuedOn) : null;
    const number = eBelge?.number ?? (await nextInvoiceNumber(tx, actor.tenantId));
    await tx`UPDATE invoices SET status = 'issued', invoice_number = ${number}, issued_on = ${issuedOn}, due_on = ${dueOn}, issued_by = ${actor.userId}, issued_at = now(), version = version + 1, updated_at = now() WHERE id = ${id}`;
    if (eBelge && provider) {
      await tx`UPDATE invoices SET document_type = ${eBelge.documentType}, profile = ${eBelge.profile}, ettn = ${eBelge.ettn}, e_invoice_status = 'queued',
        e_invoice_provider = ${provider.name}, e_invoice_attempts = 0, e_invoice_next_attempt_at = now() WHERE id = ${id}`;
      const [issued] = await tx`SELECT * FROM invoices WHERE id = ${id}`;
      const xml = buildUblInvoice(await ublInput(tx, issued));
      await tx`UPDATE invoices SET e_invoice_xml = ${xml}, e_invoice_recipient_alias = ${eBelge.alias} WHERE id = ${id}`;
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: i.order_id, action: 'invoice_issued', metadata: { invoiceId: id, number, total: Number(i.total), dueOn, ...(eBelge ? { documentType: eBelge.documentType, ettn: eBelge.ettn } : {}) } });
    await syncLedger(tx, actor.tenantId, { invoiceId: id });
    return { id, number, issuedOn, dueOn, eBelge: eBelge ? { documentType: eBelge.documentType, ettn: eBelge.ettn, status: 'queued' } : null };
  });
}

/** Cancel an issued invoice (with a reason); its lines go back to "left to invoice". */
export async function cancelInvoice(actor: WorkOrderActor, id: string, raw: unknown) {
  await requireFinance(actor, 'edit');
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).strict().parse(raw);
  await withTransaction(async (tx: any) => {
    const i = await loadInvoice(tx, actor.tenantId, id);
    if (i.status !== 'issued') fail('Yalnız kesilmiş fatura iptal edilir; taslak silinir', 409);
    await writablePeriod(tx, actor.tenantId, iso(i.issued_on)!);
    await cancelEBelge(tx, i);
    await tx`UPDATE invoices SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by = ${actor.userId}, cancelled_at = now(), version = version + 1, updated_at = now() WHERE id = ${id}`;
    await tx`UPDATE payments SET invoice_id = NULL WHERE tenant_id = ${actor.tenantId} AND invoice_id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: i.order_id, action: 'invoice_cancelled', note: reason, metadata: { invoiceId: id, number: i.invoice_number } });
    await syncLedger(tx, actor.tenantId, { invoiceId: id });
  });
}

/** Puts a failed e-Belge back in the send queue (after its cause is fixed). */
export async function retryInvoiceSend(actor: WorkOrderActor, id: string) {
  await requireFinance(actor, 'edit');
  await withTransaction(async (tx: any) => {
    const i = await loadInvoice(tx, actor.tenantId, id);
    await retryEInvoice(tx, i);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: i.order_id, action: 'e_invoice_retried', metadata: { invoiceId: id, number: i.invoice_number } });
  });
}

/** The invoice's UBL-TR XML (unsigned; the provider signs what it sends). */
export async function invoiceXml(actor: WorkOrderActor, id: string) {
  await requireFinance(actor);
  return withTransaction(async (tx: any) => {
    const [i] = await tx`SELECT * FROM invoices WHERE tenant_id = ${actor.tenantId} AND id = ${id} FOR UPDATE`;
    if (!i) fail('Fatura bulunamadı', 404);
    if (!i.ettn) fail('Bu fatura e-Belge olarak kesilmedi', 409);
    if (!(await columnExists('invoices', 'e_invoice_xml'))) fail('e-Belge veritabanı güncellemesi (060) uygulanmamış', 503);
    return { filename: `${i.invoice_number}.xml`, xml: await invoiceDocument(tx, i) };
  });
}

export async function deleteDraft(actor: WorkOrderActor, id: string) {
  await requireFinance(actor, 'delete');
  await withTransaction(async (tx: any) => {
    const i = await loadInvoice(tx, actor.tenantId, id);
    if (i.status !== 'draft') fail('Kesilmiş fatura silinmez; iptal edin', 409);
    await tx`DELETE FROM invoices WHERE id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: i.order_id, action: 'invoice_draft_deleted', metadata: { invoiceId: id } });
  });
}

const CollectionInput = z.object({
  orderId: z.string().uuid(),
  invoiceId: z.string().uuid().nullish(),
  amount: z.coerce.number().positive().max(1e8).multipleOf(0.01),
  method: z.enum(COLLECTION_METHODS),
  paidOn: day,
  reference: z.string().trim().max(120).nullish(),
  chequeDueOn: day.nullish(),
  note: z.string().trim().max(2000).nullish(),
}).strict();

/**
 * A collection (tahsilat) on an order: cash, transfer, cheque (with its due date) or card. Same rules
 * as a payment: the order's currency, never more than what is left on the order, an open period.
 */
export async function recordCollection(actor: WorkOrderActor, raw: unknown) {
  await requireFinance(actor, 'create');
  const d = CollectionInput.parse(raw);
  if (d.method === 'check' && !d.chequeDueOn) fail('Çek için vade tarihi girin');
  return withTransaction(async (tx: any) => {
    const o = await loadOrder(tx, actor.tenantId, d.orderId, true);
    if (d.invoiceId) {
      // Held so a cancel cannot slip in between this check and the insert.
      const [i] = await tx`SELECT status FROM invoices WHERE tenant_id = ${actor.tenantId} AND id = ${d.invoiceId} AND order_id = ${d.orderId} FOR SHARE`;
      if (!i || i.status !== 'issued') fail('Fatura bu siparişte kesilmiş görünmüyor');
    }
    const [paid] = await tx`SELECT coalesce(sum(amount), 0) AS total FROM payments WHERE tenant_id = ${actor.tenantId} AND order_id = ${d.orderId}`;
    // What can be collected: the order total less the VAT withheld on its invoices (the buyer pays that
    // to the tax office), or what was invoiced if more (extra lines such as shipping).
    const [billed] = await tx`SELECT coalesce(sum(coalesce((to_jsonb(invoices) ->> 'payable_total')::numeric, total)), 0) AS total,
        coalesce(sum(coalesce((to_jsonb(invoices) ->> 'withholding_total')::numeric, 0)), 0) AS withheld
      FROM invoices WHERE tenant_id = ${actor.tenantId} AND order_id = ${d.orderId} AND status = 'issued'`;
    const cap = Math.max(Number(o.total_amount) - Number(billed.withheld), Number(billed.total));
    if (Number(paid.total) + d.amount > cap + 0.005) fail(`Tahsilat siparişin kalanını aşamaz (kalan ${money(cap - Number(paid.total))})`);
    await writablePeriod(tx, actor.tenantId, d.paidOn);
    const paidAt = `${d.paidOn}T12:00:00+03:00`;
    const [p] = await tx`INSERT INTO payments (tenant_id, order_id, amount, currency, method, paid_at, note, created_by, invoice_id, reference, cheque_due_on)
      VALUES (${actor.tenantId}, ${d.orderId}, ${d.amount}, ${o.currency ?? 'TRY'}, ${d.method}, ${paidAt}, ${d.note || null}, ${actor.userId}, ${d.invoiceId ?? null}, ${d.reference || null}, ${d.chequeDueOn ?? null}) RETURNING id`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: d.orderId, action: 'collection_recorded', metadata: { paymentId: p.id, amount: d.amount, method: d.method, invoiceId: d.invoiceId ?? null } });
    await syncLedger(tx, actor.tenantId, { paymentId: String(p.id) });
    return { id: String(p.id) };
  });
}

/** Invoices of the firm (newest first), filtered by status. */
export async function listInvoices(actor: WorkOrderActor, status?: string | null) {
  await requireFinance(actor);
  const s = status && ['draft', 'issued', 'cancelled'].includes(status) ? status : null;
  const rows = await sql`SELECT i.*, o.order_number FROM invoices i JOIN orders o ON o.id = i.order_id
    WHERE i.tenant_id = ${actor.tenantId} AND (${s}::text IS NULL OR i.status = ${s}) ORDER BY coalesce(i.issued_on, i.created_at::date) DESC, i.created_at DESC LIMIT 300`;
  return rows.map(invoiceDto);
}

/** One invoice with its lines and the seller (for the printable page). */
export async function getInvoice(actor: WorkOrderActor, id: string) {
  await requireFinance(actor);
  const [i] = await sql`SELECT i.*, o.order_number FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.tenant_id = ${actor.tenantId} AND i.id = ${id}`;
  if (!i) fail('Fatura bulunamadı', 404);
  const [lines, [tenant]] = await Promise.all([
    sql`SELECT * FROM invoice_lines WHERE invoice_id = ${id} ORDER BY position`,
    // to_jsonb: the legal identity columns exist from migration 053 on.
    sql`SELECT name, to_jsonb(tenants) AS t FROM tenants WHERE id = ${actor.tenantId}`,
  ]);
  const t = (tenant?.t ?? {}) as Row;
  const sellerAddress = [t.address_line, t.district, t.city].filter(Boolean).join(', ') || null;
  return {
    ...invoiceDto(i), seller: (t.legal_name as string) || tenant?.name || null, sellerTaxNumber: t.tax_number ?? null, sellerTaxOffice: t.tax_office ?? null, sellerAddress,
    taxNumber: i.customer_tax_number ?? null, taxOffice: i.customer_tax_office ?? null,
    address: [i.customer_address, i.customer_district, i.customer_city].filter(Boolean).join(', ') || null, notes: i.notes ?? null,
    lines: lines.map((l: Row) => ({ id: String(l.id), description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unit_price), vatPercent: Number(l.vat_percent), netAmount: Number(l.net_amount), vatAmount: Number(l.vat_amount) })),
  };
}
