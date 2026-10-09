/**
 * Integration test for the finance foundation (gece 2, Tur 4) on the isolated local test database
 * only: a partial invoice from an order, over-invoicing refused, issue/cancel/delete, collections by
 * method, aging, statement, the overdue reminder (activity + notification, once), estimated profit,
 * and nobody outside finance sees any of it.
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['044_access_control.sql', '045_sales_service_chain.sql', '047_finance_foundation.sql', '047_finance_foundation.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const inv = await import('../lib/features/finance/invoices.server');
  const rec = await import('../lib/features/finance/receivables.server');
  const access = await import('../lib/security/member-access.server');
  const { routeRequirement } = await import('../lib/security/access-matrix');
  const { redactFields } = await import('../lib/security/access-matrix');
  const { sql: appSql } = await import('../lib/db');

  const tenantId = randomUUID();
  const ids: Record<string, string> = {};
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Finans Test', ${'fin-' + tenantId.slice(0, 8)})`;
  for (const role of ['owner', 'admin', 'accountant', 'office', 'worker', 'member']) {
    ids[role] = randomUUID();
    await db`INSERT INTO users (id, email, name) VALUES (${ids[role]}, ${`${role}-${ids[role]}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ids[role]}, ${role})`;
  }
  const actor = (role: string) => ({ tenantId, userId: ids[role], role: role as any });
  const acc = actor('accountant');
  const day = (offset: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + offset * 86_400_000));

  // An order of 2 × 10 000 + 1 × 2 000 net (+20% VAT = 26 400) for a customer with 15-day terms.
  const [customer] = await db`INSERT INTO customers (tenant_id, full_name, company_name, tax_number, payment_terms) VALUES (${tenantId}, 'Ayşe Demir', 'Demir Yapı', '1234567890', 15) RETURNING id`;
  const [order] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, currency, product_name)
    VALUES (${tenantId}, ${'ORD-FIN-' + tenantId.slice(0, 6)}, ${customer.id}, 'Ayşe Demir', 'approved', 26400, 'TRY', 'Pergola') RETURNING id`;
  const [a] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${order.id}, 'Pergola 4x3', 2, 10000, 20000) RETURNING id`;
  const [b] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${order.id}, 'Montaj', 1, 2000, 2000) RETURNING id`;
  const orderId = String(order.id);

  // Partial invoice: one of the two pergolas. Asking for more than is left is refused.
  const d1 = await inv.createInvoiceDraft(acc, orderId, { lines: [{ orderItemId: a.id, quantity: 1 }] });
  assert.deepEqual([d1.subtotal, d1.vatTotal, d1.total], [10000, 2000, 12000]);
  await assert.rejects(inv.createInvoiceDraft(acc, orderId, { lines: [{ orderItemId: a.id, quantity: 2 }] }), /kalan 1, istenen 2/);
  let billing = await inv.orderBilling(acc, orderId);
  assert.deepEqual(billing.lines.map((l) => l.remaining), [1, 1], 'a draft holds its quantity');
  assert.equal(billing.invoices[0].eInvoice, 'not_connected');

  // Issue 50 days ago: number, customer terms (15 days) → due 35 days ago. Issued is final.
  const i1 = await inv.issueInvoice(acc, d1.id, { issuedOn: day(-50) });
  assert.match(i1.number, /^FTR-\d{6}$/);
  assert.equal(i1.dueOn, day(-35));
  await assert.rejects(inv.issueInvoice(acc, d1.id, {}), (e: any) => e.status === 409);
  await assert.rejects(inv.deleteDraft(actor('owner'), d1.id), (e: any) => e.status === 409);

  // The rest plus shipping, issued today (due in 15 days).
  const d2 = await inv.createInvoiceDraft(acc, orderId, { lines: [{ orderItemId: a.id, quantity: 1 }, { orderItemId: b.id, quantity: 1 }], extra: [{ description: 'Nakliye', quantity: 1, unitPrice: 500 }] });
  assert.equal(d2.total, 15000);
  const i2 = await inv.issueInvoice(acc, d2.id, {});
  assert.notEqual(i2.number, i1.number);
  billing = await inv.orderBilling(acc, orderId);
  assert.deepEqual(billing.lines.map((l) => l.remaining), [0, 0], 'everything is invoiced');

  // A draft can be deleted (by someone with delete) and frees nothing it did not hold.
  await assert.rejects(inv.createInvoiceDraft(acc, orderId, { lines: [{ orderItemId: b.id, quantity: 1 }] }), /kalan 0/);
  const d3 = await inv.createInvoiceDraft(acc, orderId, { lines: [], extra: [{ description: 'Ek iş', quantity: 1, unitPrice: 100 }] });
  await inv.deleteDraft(actor('owner'), d3.id);

  // Collections: transfer, cheque (needs its due date), card; never above the order's remainder.
  await inv.recordCollection(acc, { orderId, invoiceId: d1.id, amount: 5000, method: 'bank_transfer', paidOn: day(-20), reference: 'DEKONT-1' });
  await assert.rejects(inv.recordCollection(acc, { orderId, amount: 2000, method: 'check', paidOn: day(-10) }), /vade/);
  await inv.recordCollection(acc, { orderId, amount: 2000, method: 'check', paidOn: day(-10), reference: 'ÇEK-778', chequeDueOn: day(30) });
  await inv.recordCollection(acc, { orderId, amount: 1000, method: 'credit_card', paidOn: day(0) });
  await assert.rejects(inv.recordCollection(acc, { orderId, amount: 20000, method: 'cash', paidOn: day(0) }), /kalanını aşamaz/);
  // A closed month takes no collection.
  await db`INSERT INTO accounting_period_closes (tenant_id, period, status) VALUES (${tenantId}, '2026-01', 'hard_closed') ON CONFLICT (tenant_id, period) DO UPDATE SET status = 'hard_closed'`;
  await assert.rejects(inv.recordCollection(acc, { orderId, amount: 10, method: 'cash', paidOn: '2026-01-15' }), /dönemi kapalı/);

  // Receivables: 27 000 invoiced − 8 000 collected; FIFO leaves 4 000 of the first (31–60 days) and 15 000 not due.
  const r = await rec.receivables(acc);
  const c = r.customers[0];
  assert.equal(c.name, 'Demir Yapı');
  assert.deepEqual([c.invoiceTotal, c.collected, c.balance], [27000, 8000, 19000]);
  assert.deepEqual([c.aging.notDue, c.aging.d0_30, c.aging.d31_60, c.aging.d60plus, c.aging.overdue], [15000, 0, 4000, 0, 4000]);
  assert.deepEqual(c.overdue.map((o) => [o.number, o.daysOverdue, o.openAmount]), [[i1.number, 35, 4000]]);
  assert.equal(r.totals.overdueAmount, 4000);

  // Overdue → one "call" activity on the order and a notification to each finance person, once.
  const acts = await db`SELECT kind, title, assignee_id FROM record_activities WHERE tenant_id = ${tenantId} AND rule_key = 'invoice_overdue'`;
  assert.equal(acts.length, 1);
  assert.equal(acts[0].kind, 'call');
  assert.equal(String(acts[0].assignee_id), ids.accountant, 'the person who issued it follows up');
  const notes = await db`SELECT user_id FROM notifications WHERE tenant_id = ${tenantId} AND type = 'reminder'`;
  assert.deepEqual(notes.map((n) => String(n.user_id)).sort(), [ids.owner, ids.admin, ids.accountant].sort());
  await rec.runOverdueRule(tenantId, { force: true });
  assert.equal((await db`SELECT count(*)::int AS n FROM record_activities WHERE tenant_id = ${tenantId} AND rule_key = 'invoice_overdue'`)[0].n, 1, 'not twice');

  // Statement: from 60 days ago everything; from 30 days ago the first invoice is brought forward.
  const s1 = await rec.customerStatement(acc, c.key, day(-60), day(0));
  assert.deepEqual([s1.openingBalance, s1.lines.length, s1.closingBalance], [0, 5, 19000]);
  assert.equal(s1.lines[0].ref, i1.number);
  const s2 = await rec.customerStatement(acc, c.key, day(-30), day(0));
  assert.deepEqual([s2.openingBalance, s2.debit, s2.credit, s2.closingBalance], [12000, 15000, 8000, 19000]);
  await assert.rejects(rec.customerStatement(acc, 'id:' + randomUUID(), day(-1), day(0)), (e: any) => e.status === 404);

  // Cancel the second invoice: its lines are free again and the balance drops.
  await assert.rejects(inv.cancelInvoice(acc, d2.id, { reason: 'x' }), () => true);
  await inv.cancelInvoice(acc, d2.id, { reason: 'Yanlış adres' });
  billing = await inv.orderBilling(acc, orderId);
  assert.deepEqual(billing.lines.map((l) => l.remaining), [1, 1]);
  assert.equal((await rec.receivables(acc)).customers[0].balance, 4000);

  // Estimated profit: no production records yet → gaps, never invented.
  assert.equal(billing.estimatedProfit.complete, false);
  assert.equal(billing.estimatedProfit.revenueNet, 22000);
  assert.equal(billing.estimatedProfit.profit, null, 'no cost record → no profit figure');
  // With a work order: priced material (6 000), 10 h at 250/h, then it is complete.
  const [item] = await db`INSERT INTO inventory_items (tenant_id, name, sku) VALUES (${tenantId}, 'Profil', ${'P-' + tenantId.slice(0, 6)}) RETURNING id`;
  const [wo] = await db`INSERT INTO work_orders (tenant_id, title, order_item_id) VALUES (${tenantId}, 'Pergola üretimi', ${a.id}) RETURNING id`;
  await db`INSERT INTO work_order_material_lots (tenant_id, work_order_id, item_id, quantity, uom, unit_cost, currency, method) VALUES (${tenantId}, ${wo.id}, ${item.id}, 20, 'm', 300, 'TRY', 'legacy_untracked')`;
  await db`INSERT INTO production_operations (tenant_id, work_order_id, position, name, work_center_code, planned_minutes, planned_qty, active_seconds) VALUES (${tenantId}, ${wo.id}, 1, 'Kesim', 'CUT', 60, 1, 36000)`;
  await db`INSERT INTO manufacturing_preferences (tenant_id, labor_cost_per_hour, labor_currency) VALUES (${tenantId}, 250, 'TRY') ON CONFLICT (tenant_id) DO UPDATE SET labor_cost_per_hour = 250, labor_currency = 'TRY'`;
  const p = (await inv.orderBilling(acc, orderId)).estimatedProfit;
  assert.deepEqual([p.materialCost, p.laborCost, p.cost, p.profit, p.marginPercent, p.complete], [6000, 2500, 8500, 13500, 61.4, true]);

  // Who sees finance: owner, admin, accounting. Worker, office, member get 404; the route map says finance.
  for (const role of ['owner', 'admin']) assert.ok(await rec.receivables(actor(role)));
  for (const role of ['worker', 'office', 'member']) {
    await assert.rejects(inv.orderBilling(actor(role), orderId), (e: any) => e.status === 404, `${role} sees billing`);
    await assert.rejects(rec.receivables(actor(role)), (e: any) => e.status === 404);
    await assert.rejects(inv.recordCollection(actor(role), { orderId, amount: 1, method: 'cash', paidOn: day(0) }), (e: any) => e.status === 404);
    await assert.rejects(inv.listInvoices(actor(role)), (e: any) => e.status === 404);
  }
  assert.deepEqual(routeRequirement('/api/v1/invoices', 'GET'), { module: 'finance', action: 'view' });
  assert.deepEqual(routeRequirement('/api/v1/finance/receivables', 'GET'), { module: 'finance', action: 'view' });
  assert.deepEqual(routeRequirement('/finance/receivables', 'GET'), { module: 'finance', action: 'view' });
  const w = await access.resolveMemberAccess(ids.worker, tenantId);
  assert.ok(!(w!.permissions.finance ?? []).length, 'worker has no finance cell');
  // Amounts are price fields: a role hiding prices gets none of them.
  const red = redactFields({ invoiceTotal: 1, vatTotal: 2, openAmount: 3, aging: { notDue: 1 }, openingBalance: 4, profit: 5, name: 'x' }, ['price', 'profit']);
  assert.deepEqual(red, { financialHidden: true, name: 'x' });

  // Every step is on the order's audit trail.
  const actions = (await db`SELECT DISTINCT action FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_type = 'order'`).map((x) => x.action);
  for (const want of ['invoice_drafted', 'invoice_issued', 'invoice_cancelled', 'invoice_draft_deleted', 'collection_recorded', 'invoice_overdue']) assert.ok(actions.includes(want), `audit has ${want}`);

  for (const t of ['production_operations', 'work_order_material_lots', 'work_orders', 'inventory_items', 'manufacturing_preferences', 'payments', 'invoices', 'accounting_period_closes'])
    await db`DELETE FROM ${db(t)} WHERE tenant_id = ${tenantId}`;
  await db`DELETE FROM tenants WHERE id = ${tenantId}`;
  await db`DELETE FROM users WHERE id = ANY(${Object.values(ids)}::uuid[])`;
  await db.end();
  await (appSql as any).end?.();
  console.log('test:finance OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
