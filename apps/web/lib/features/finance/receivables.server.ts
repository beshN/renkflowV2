import 'server-only';

import { sql, withTransaction } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { createNotification } from '@/lib/notifications/service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import { COLLECTION_METHOD_LABELS, aging, customerKey, money, overdueInvoices, settle, statement, type OpenInvoice, type StatementEntry } from './engine';
import { istanbulToday, requireFinance } from './invoices.server';

type Row = Record<string, any>;
const iso = (d: unknown) => (d ? (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) : '');

/**
 * Every customer's issued invoices and collections (TRY), keyed by the order's customer card (or
 * name when the order has none). Cancelled invoices and drafts are not receivables.
 */
async function ledger(tenantId: string) {
  const [invoices, payments] = await Promise.all([
    sql`SELECT i.id, i.invoice_number, i.issued_on, i.due_on, i.total, i.order_id, i.issued_by, o.order_number, o.customer_id, o.customer_name, i.customer_name AS invoice_customer
      FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.tenant_id = ${tenantId} AND i.status = 'issued' AND i.currency = 'TRY'`,
    sql`SELECT p.id, p.amount, p.method, p.paid_at, p.reference, p.order_id, p.invoice_id, o.order_number, o.customer_id, o.customer_name
      FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.tenant_id = ${tenantId} AND p.currency = 'TRY'`,
  ]);
  const customers = new Map<string, { key: string; customerId: string | null; name: string; invoices: Row[]; payments: Row[] }>();
  const slot = (r: Row) => {
    const key = customerKey(r.customer_id, r.customer_name);
    if (!customers.has(key)) customers.set(key, { key, customerId: r.customer_id ? String(r.customer_id) : null, name: (r.invoice_customer || r.customer_name || 'Müşteri') as string, invoices: [], payments: [] });
    return customers.get(key)!;
  };
  for (const i of invoices) slot(i).invoices.push(i);
  for (const p of payments) slot(p).payments.push(p);
  return [...customers.values()];
}

/** Collections recorded against an invoice, by invoice (they pay that invoice first). */
const targetedOf = (payments: Row[]) => {
  const t: Record<string, number> = {};
  for (const p of payments) if (p.invoice_id) t[String(p.invoice_id)] = money((t[String(p.invoice_id)] ?? 0) + Number(p.amount));
  return t;
};

const asOpen = (i: Row): OpenInvoice & { orderId: string; orderNumber: string; issuedBy: string | null } => ({
  id: String(i.id), number: i.invoice_number, issuedOn: iso(i.issued_on), dueOn: iso(i.due_on), total: Number(i.total),
  orderId: String(i.order_id), orderNumber: i.order_number, issuedBy: i.issued_by ? String(i.issued_by) : null,
});

/** Open balance and aging per customer, the firm's totals, and the overdue invoices. */
export async function receivables(actor: WorkOrderActor) {
  await requireFinance(actor);
  const today = istanbulToday();
  const rows = (await ledger(actor.tenantId)).map((c) => {
    const collected = money(c.payments.reduce((s, p) => s + Number(p.amount), 0));
    const invoiced = money(c.invoices.reduce((s, i) => s + Number(i.total), 0));
    const s = settle(c.invoices.map(asOpen), collected, today, targetedOf(c.payments));
    return {
      key: c.key, customerId: c.customerId, name: c.name, invoiceTotal: invoiced, collected, balance: money(invoiced - collected), advance: s.advance,
      aging: aging(s.items, today),
      overdue: overdueInvoices(s.items, today).map((i) => ({ id: i.id, number: i.number, dueOn: i.dueOn, daysOverdue: i.daysOverdue, openAmount: i.open, orderId: (i as any).orderId, orderNumber: (i as any).orderNumber })),
    };
  }).filter((c) => c.invoiceTotal > 0 || c.collected > 0).sort((a, b) => b.aging.overdue - a.aging.overdue || b.balance - a.balance);
  const sum = (f: (r: (typeof rows)[number]) => number) => money(rows.reduce((s, r) => s + f(r), 0));
  await runOverdueRule(actor.tenantId).catch((e) => console.error('[finance] overdue rule', e instanceof Error ? e.message : e));
  return {
    today,
    totals: { balance: sum((r) => r.aging.total), overdueAmount: sum((r) => r.aging.overdue), advance: sum((r) => r.advance), aging: {
      notDue: sum((r) => r.aging.notDue), d0_30: sum((r) => r.aging.d0_30), d31_60: sum((r) => r.aging.d31_60), d60plus: sum((r) => r.aging.d60plus),
    } },
    customers: rows,
  };
}

/** A customer's statement (ekstre) for a period: brought forward, movements, running and closing balance. */
export async function customerStatement(actor: WorkOrderActor, key: string, from: string, to: string) {
  await requireFinance(actor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new WorkOrderApiError('Geçerli bir tarih aralığı seçin', 400);
  const found = (await ledger(actor.tenantId)).find((x) => x.key === key);
  // A cancelled invoice stays in the history: its debit on the day it was issued, a reversal on the
  // day it was cancelled — so a statement already sent for a past period does not change.
  const cancelled = (await sql`SELECT i.invoice_number, i.issued_on, i.cancelled_at, i.total, o.order_number, o.customer_id, o.customer_name
    FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.tenant_id = ${actor.tenantId} AND i.status = 'cancelled' AND i.invoice_number IS NOT NULL AND i.currency = 'TRY'`)
    .filter((i: Row) => customerKey(i.customer_id, i.customer_name) === key);
  if (!found && !cancelled.length) throw new WorkOrderApiError('Müşteri bulunamadı', 404);
  const c = found ?? { key, customerId: null, name: String(cancelled[0].customer_name ?? 'Müşteri'), invoices: [] as Row[], payments: [] as Row[] };
  const istanbul = (d: unknown) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(d as string));
  const entries: StatementEntry[] = [
    ...c.invoices.map((i) => ({ on: iso(i.issued_on), kind: 'invoice' as const, ref: i.invoice_number as string, text: `Fatura · ${i.order_number} · vade ${iso(i.due_on)}`, debit: Number(i.total), credit: 0 })),
    ...cancelled.flatMap((i: Row) => [
      { on: iso(i.issued_on), kind: 'invoice' as const, ref: i.invoice_number as string, text: `Fatura · ${i.order_number}`, debit: Number(i.total), credit: 0 },
      { on: istanbul(i.cancelled_at), kind: 'cancel' as const, ref: i.invoice_number as string, text: `İptal · ${i.order_number}`, debit: 0, credit: Number(i.total) },
    ]),
    ...c.payments.map((p) => ({ on: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(p.paid_at)), kind: 'collection' as const, ref: (p.reference as string) || p.order_number, text: `Tahsilat · ${COLLECTION_METHOD_LABELS[p.method] ?? p.method} · ${p.order_number}`, debit: 0, credit: Number(p.amount) })),
  ];
  const [tenant] = await sql`SELECT name FROM tenants WHERE id = ${actor.tenantId}`;
  const st = statement(entries, from, to);
  return { customer: { key: c.key, name: c.name }, seller: tenant?.name ?? null, from, to, currency: 'TRY', openingBalance: st.opening, closingBalance: st.closing, debit: st.debit, credit: st.credit, lines: st.lines };
}

const lastRun = new Map<string, number>();

/**
 * An issued invoice past its due date with money still open makes, once per invoice, a "call the
 * customer" activity on the order and a notification to the finance people (owner, admin, accounting).
 */
export async function runOverdueRule(tenantId: string, { force = false } = {}) {
  const now = Date.now();
  if (!force && now - (lastRun.get(tenantId) ?? 0) < 10 * 60_000) return { ran: 0 };
  lastRun.set(tenantId, now);
  if (!(await tableExists('invoices'))) return { ran: 0 };
  const today = istanbulToday();
  const overdue = (await ledger(tenantId)).flatMap((c) => {
    const collected = c.payments.reduce((s, p) => s + Number(p.amount), 0);
    return overdueInvoices(settle(c.invoices.map(asOpen), collected, today, targetedOf(c.payments)).items, today).map((i) => ({ ...i, customer: c.name }));
  });
  if (!overdue.length) return { ran: 0 };
  // Only people whose own access holds the finance cell hear of it (a custom role can take it away).
  const candidates = await sql`SELECT user_id, role FROM tenant_members WHERE tenant_id = ${tenantId} AND role IN ('owner', 'admin', 'accountant')
    AND (to_jsonb(tenant_members)->>'deactivated_at') IS NULL ORDER BY (role = 'accountant') DESC, (role = 'owner') DESC`;
  const finance: Row[] = [];
  for (const m of candidates) {
    const access = await resolveMemberAccess(String(m.user_id), tenantId);
    if (access && !access.deactivated && can(access, 'finance', 'view')) finance.push(m);
  }
  if (!finance.length) return { ran: 0 };
  let ran = 0;
  for (const raw of overdue) {
    const i = raw as typeof raw & { orderId: string; orderNumber: string; issuedBy: string | null };
    // The person who issued it, if they still do finance; else accounting first, then the owner. Never
    // unassigned, so it does not land in the office's shared list.
    const assignee = finance.some((m: Row) => String(m.user_id) === i.issuedBy) ? i.issuedBy : String(finance[0].user_id);
    const done = await withTransaction(async (tx: any) => {
      const claimed = await tx`INSERT INTO record_rule_runs (tenant_id, rule_key, entity_type, entity_id) VALUES (${tenantId}, 'invoice_overdue', 'invoice', ${i.id}) ON CONFLICT DO NOTHING RETURNING 1`;
      if (!claimed.length) return false;
      await tx`INSERT INTO record_activities (tenant_id, entity_type, entity_id, kind, title, due_on, assignee_id, rule_key)
        VALUES (${tenantId}, 'order', ${i.orderId}, 'call', 'Tahsilat takibi: müşteriyi arayın', ${today}, ${assignee}, 'invoice_overdue')`;
      await recordAudit(tx, { tenantId, actorId: null, entityType: 'order', entityId: i.orderId, action: 'invoice_overdue', metadata: { invoiceId: i.id, number: i.number, dueOn: i.dueOn, rule: 'invoice_overdue' } });
      return true;
    });
    if (!done) continue;
    ran++;
    for (const m of finance)
      await createNotification(String(m.user_id), tenantId, 'reminder', `${i.number} vadesi geçti`, `${i.customer} · ${i.daysOverdue} gün gecikti. Alacaklar ekranından tahsilatı takip edin.`, { href: '/finance/receivables', entityType: 'order', entityId: i.orderId })
        .catch((e) => console.error('[finance] overdue notice', e instanceof Error ? e.message : e));
  }
  return { ran };
}
