import { localTestDatabaseUrl } from './local-test-database';
/** Integration test for quote → order depth (Tur B), on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseUrl();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['037_production_lead.sql', '038_notification_json.sql', '040_record_platform.sql', '041_quote_order_depth.sql', '041_quote_order_depth.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const { quotationService } = await import('../lib/features/quotations/service');
  const q = await import('../lib/features/sales/quotes.server');
  const o = await import('../lib/features/sales/orders.server');
  const { transitionOrder } = await import('../lib/features/orders/transitions.service');
  const { orderService } = await import('../lib/services/orderService.server');
  const { istanbulToday } = await import('../lib/features/sales/order-status.server');
  const { sql } = await import('../lib/db');
  const today = istanbulToday();

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID(), workerId = randomUUID(), accountantId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Satış Test Alüminyum', ${'sales-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office'], [workerId, 'worker'], [accountantId, 'accountant']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${tenantId}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };
  const worker = { tenantId, userId: workerId, role: 'worker' as const };
  const accountant = { tenantId, userId: accountantId, role: 'accountant' as const };
  const [customer] = await db`INSERT INTO customers (tenant_id, full_name) VALUES (${tenantId}, 'Bayi Müşteri') RETURNING id`;

  // Settings: managers only; defaults until saved.
  assert.deepEqual(await q.getQuoteSettings(tenantId), { discountApprovalPercent: 10, defaultValidDays: 15, defaultVatPercent: 20 });
  await assert.rejects(q.saveQuoteSettings(office as any, { discountApprovalPercent: 50, defaultValidDays: 15, defaultVatPercent: 20 }), (e: any) => e.status === 403);
  await q.saveQuoteSettings(owner as any, { discountApprovalPercent: 10, defaultValidDays: 10, defaultVatPercent: 20 });

  // Customer price list: a general and a family discount; a new quote applies them to lines without one.
  await assert.rejects(q.savePriceRule(worker as any, customer.id, { discountPercent: 5 }), (e: any) => e.status === 403);
  await q.savePriceRule(office as any, customer.id, { discountPercent: 5 });
  await q.savePriceRule(office as any, customer.id, { family: 'pergola', discountPercent: 8 });
  let rules = await q.savePriceRule(office as any, customer.id, { discountPercent: 6 });
  assert.deepEqual(rules.map((r) => [r.family, r.discountPercent]), [[null, 6], ['pergola', 8]], 'saving the same scope replaces it');
  const priced = await q.applyCustomerPrices(tenantId, customer.id, [{ discountPercent: 0, productConfiguration: { family: 'pergola' } }, { discountPercent: 0 }, { discountPercent: 2 }]);
  assert.deepEqual(priced.map((p) => p.discountPercent), [8, 6, 2]);
  rules = await q.deletePriceRule(office as any, customer.id, rules[1].id);
  assert.equal(rules.length, 1);

  // A quote in EUR at 10 % VAT with the seller's typed rate.
  const lines = [{ productName: 'Pergola', quantity: 1, unitPrice: 1000, discountPercent: 15, totalPrice: 0, color: 'RAL 7016 Mat', widthMm: 4000 }, { productName: 'Giyotin', quantity: 2, unitPrice: 250, discountPercent: 0, totalPrice: 0 }];
  const quote = await quotationService.createQuotation(tenantId, { customerId: customer.id, customerName: 'Bayi Müşteri', currency: 'EUR', discountPercent: 0, vatPercent: 10, fxRate: 36.5, internalNotes: 'iç not: marj düşük', notes: 'Montaj dahil', items: lines } as any, officeId);
  assert.deepEqual([quote.vatPercent, quote.fxRate, quote.subtotal, quote.taxAmount, quote.totalAmount], [10, 36.5, 1350, 135, 1485]);
  let ds = await q.discountState(tenantId, quote.id);
  assert.deepEqual([ds.effective, ds.needsApproval, ds.tryTotal], [10, false, 54202.5], '150 off 1500 list = 10 %, at the threshold');

  // Over the threshold: the office cannot send it, a manager approves it, then it goes.
  let current = await quotationService.updateQuotation(tenantId, quote.id, { items: lines.map((l, i) => (i === 1 ? { ...l, discountPercent: 10 } : l)), expectedVersion: quote.version } as any);
  ds = await q.discountState(tenantId, quote.id);
  assert.deepEqual([ds.effective, ds.needsApproval], [13.33, true]);
  await assert.rejects(quotationService.updateStatus(tenantId, quote.id, 'sent', current.version, officeId, 'office'), /yönetici onayı/);
  await assert.rejects(q.approveDiscount(office as any, quote.id), (e: any) => e.status === 403);
  await assert.rejects(q.approveDiscount(owner as any, quote.id, 5), /bu arada/, 'approval is tied to the discount the manager saw');
  await q.approveDiscount(owner as any, quote.id);
  current = (await quotationService.getQuotationById(tenantId, quote.id))!;
  current = await quotationService.updateStatus(tenantId, quote.id, 'sent', current.version, officeId, 'office');
  assert.equal(current.status, 'sent');
  assert.ok(current.sentAt, 'sent time kept');
  assert.equal(current.validUntil, new Date(Date.parse(today + 'T00:00:00Z') + 10 * 86_400_000).toISOString().slice(0, 10), 'firm default validity filled in');

  // Customer approval link: the customer sees their quote but never internal notes; one decision with name, time, IP.
  await assert.rejects(q.createApprovalLink(worker as any, quote.id), (e: any) => e.status === 403);
  const link = await q.createApprovalLink(office as any, quote.id);
  const token = link.path.split('/').pop()!;
  const seen: any = await q.publicQuote(token);
  assert.equal(seen.quotationNumber, current.quotationNumber);
  assert.equal(JSON.stringify(seen).includes('marj'), false, 'internal notes never reach the customer');
  assert.equal(seen.decidable, true);
  assert.equal(await q.publicQuote('x'.repeat(43)), null);
  await assert.rejects(q.publicDecision(token, { decision: 'accept', name: 'A' }, { ip: '203.0.113.9', agent: 'test' }), /Adınızı/);
  await q.publicDecision(token, { decision: 'accept', name: 'Ayşe Bayi', note: 'Uygundur' }, { ip: '203.0.113.9', agent: 'Mozilla/5.0 test' });
  const [decided] = await db`SELECT status, customer_decision_name, customer_decision_ip, customer_decided_at FROM quotations WHERE id = ${quote.id}`;
  assert.deepEqual([decided.status, decided.customer_decision_name, decided.customer_decision_ip, Boolean(decided.customer_decided_at)], ['accepted', 'Ayşe Bayi', '203.0.113.9', true]);
  const [trail] = await db`SELECT actor_id, metadata FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_id = ${quote.id} AND action = 'customer_accepted'`;
  assert.deepEqual([trail.actor_id, trail.metadata.ip, trail.metadata.name], [null, '203.0.113.9', 'Ayşe Bayi']);
  await assert.rejects(q.publicDecision(token, { decision: 'reject', name: 'Ayşe Bayi' }, { ip: '203.0.113.9', agent: 'x' }), /zaten verildi/);
  const [notice] = await db`SELECT title FROM notifications WHERE tenant_id = ${tenantId} AND user_id = ${officeId} AND title LIKE '%onaylandı%'`;
  assert.ok(notice, 'the seller hears of the decision');

  // Revision: the accepted version is kept, the quote is a draft again under revision 2; old link closed; diff shows the change.
  await assert.rejects(q.reviseQuote(office as any, quote.id, ''), /gerekçesi/);
  await q.reviseQuote(office as any, quote.id, 'Müşteri genişliği değiştirdi');
  current = (await quotationService.getQuotationById(tenantId, quote.id))!;
  assert.deepEqual([current.status, current.revision, current.discountApprovedPercent, current.customerDecidedAt], ['draft', 2, null, null]);
  assert.equal(await q.publicQuote(token), null, 'a revision closes the old link');
  current = await quotationService.updateQuotation(tenantId, quote.id, { items: lines.map((l, i) => (i === 0 ? { ...l, widthMm: 4500, unitPrice: 1100 } : l)), expectedVersion: current.version } as any);
  const history: any = await q.quoteHistory(office as any, quote.id);
  assert.equal(history.revisions.length, 1);
  assert.equal(history.revisions[0].status, 'accepted');
  const pergola = history.revisions[0].diffToNext.lines.find((l: any) => l.productName === 'Pergola');
  assert.deepEqual(pergola.changes.map((c: any) => [c.field, c.from, c.to]), [['unitPrice', 1000, 1100], ['widthMm', 4000, 4500]]);
  await assert.rejects(q.reviseQuote(office as any, quote.id, 'tekrar'), /Taslak/);

  // Validity: a sent quote whose day has passed expires (with a trace) and can be neither accepted nor converted.
  current = await quotationService.updateStatus(tenantId, quote.id, 'sent', current.version, ownerId, 'owner');
  await db`UPDATE quotations SET valid_until = ${today}::date - 1 WHERE id = ${quote.id}`;
  await assert.rejects(quotationService.convertToOrder(tenantId, quote.id, officeId, undefined, 'office'), /süresi doldu/);
  await assert.rejects(quotationService.updateStatus(tenantId, quote.id, 'accepted', undefined, officeId, 'office'), /süresi doldu/);
  assert.equal((await db`SELECT status FROM quotations WHERE id = ${quote.id}`)[0].status, 'expired');
  assert.ok((await db`SELECT 1 FROM activity_logs WHERE entity_id = ${quote.id} AND action = 'status_changed' AND metadata->>'reason' = 'validity_passed'`).length);
  await assert.rejects(q.createApprovalLink(office as any, quote.id), /süresi doldu/);

  // Templates: from a quote, unique by name, listed and deleted.
  const tpl = await q.saveTemplateFromQuote(office as any, quote.id, 'Pergola + giyotin standart');
  await assert.rejects(q.saveTemplateFromQuote(office as any, quote.id, 'pergola + GİYOTİN standart'), /Bu adla/);
  const templates = await q.listTemplates(accountant as any);
  assert.deepEqual([templates.length, templates[0].lineCount, templates[0].notes], [1, 2, 'Montaj dahil']);
  await assert.rejects(q.listTemplates(worker as any), (e: any) => e.status === 403);
  await q.deleteTemplate(office as any, tpl.id);

  // Converting a draft over the threshold without approval is refused for the office.
  const draft = await quotationService.createQuotation(tenantId, { customerName: 'Bayi Müşteri', currency: 'TRY', discountPercent: 20, items: [lines[1]] } as any, officeId);
  await assert.rejects(quotationService.convertToOrder(tenantId, draft.id, officeId, draft.version, 'office'), /yönetici onayı/);

  // Order state machine: one gate for every path; a reason for stopping, cancelling or going back; promise frozen at approval.
  const [order] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency, delivery_date)
    VALUES (${tenantId}, 'SAT-1', 'Bayi Müşteri', 'Pergola', 3, 'pending', 1200, 'TRY', ${today}::date + 20) RETURNING id, version`;
  const [itemA] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price, width_mm) VALUES (${order.id}, 'Pergola', 2, 400, 800, 4000) RETURNING id`;
  const [itemB] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${order.id}, 'Giyotin', 1, 400, 400) RETURNING id`;
  await assert.rejects(orderService.updateOrderStatus(tenantId, order.id, 'in_production', { actorId: officeId }), /izin verilmiyor/, 'the old status endpoint obeys the map too');
  await assert.rejects(orderService.updateOrderStatus(tenantId, order.id, 'cancelled', { actorId: officeId }), /gerekçe/);
  let version = (await transitionOrder(office as any, order.id, { commandId: randomUUID(), version: order.version, newStatus: 'approved', note: '' })).version;
  let [row] = await db`SELECT promised_date, delivery_date FROM orders WHERE id = ${order.id}`;
  assert.equal(String(row.promised_date), String(row.delivery_date), 'promise frozen at approval');
  await assert.rejects(transitionOrder(office as any, order.id, { commandId: randomUUID(), version, newStatus: 'on_hold', note: '' }), /gerekçe/);
  version = (await transitionOrder(office as any, order.id, { commandId: randomUUID(), version, newStatus: 'on_hold', note: 'Ölçü teyidi bekleniyor' })).version;
  const [held] = await db`SELECT note FROM activity_logs WHERE entity_id = ${order.id} AND action = 'status_changed' ORDER BY created_at DESC LIMIT 1`;
  assert.equal(held.note, 'Ölçü teyidi bekleniyor');
  version = (await transitionOrder(office as any, order.id, { commandId: randomUUID(), version, newStatus: 'approved', note: '' })).version;

  // Promise: moving it needs a reason, and it is traced.
  await assert.rejects(o.setPromisedDate(office as any, order.id, { date: today }), /gerekçe/);
  let sales: any = await o.setPromisedDate(office as any, order.id, { date: today, reason: 'Müşteri erken istedi' });
  assert.deepEqual([sales.dates.promised, sales.dates.slipDays], [today, 0]);

  // Who sees it: never a worker; accounts may read and plan payments but not change the order.
  await assert.rejects(o.orderSales(worker as any, order.id), (e: any) => e.status === 403);
  await o.orderSales(accountant as any, order.id);
  await assert.rejects(o.proposeChange(accountant as any, order.id, { reason: 'deneme', lines: [{ orderItemId: itemA.id, quantity: 3 }] }), (e: any) => e.status === 403);

  // Payment plan: must add up; payments go to installments in order.
  await assert.rejects(o.setPaymentPlan(accountant as any, order.id, { installments: [{ label: 'Kapora', dueOn: today, amount: 300 }] }), /eşit/);
  await o.setPaymentPlan(accountant as any, order.id, { installments: [{ label: 'Kapora', dueOn: '2026-01-01', amount: 400 }, { label: 'Teslimde', dueOn: '2099-01-01', amount: 800 }] });
  await db`INSERT INTO payments (tenant_id, order_id, amount, currency, method, paid_at, created_by) VALUES (${tenantId}, ${order.id}, 250, 'TRY', 'cash', now(), ${officeId})`;
  sales = await o.orderSales(office as any, order.id);
  assert.deepEqual(sales.plan.rows.map((r: any) => [r.state, r.paid]), [['overdue', 250], ['planned', 0]]);
  assert.equal(sales.plan.overdue, 150);

  // Change order: an open work order warns; applying needs that acknowledged; total scales; the assignee hears without prices.
  const [job] = await db`INSERT INTO work_orders (tenant_id, title, category, assigned_to, created_by, order_id, order_item_id) VALUES (${tenantId}, 'SAT-1 · Pergola', 'production', ${workerId}, ${officeId}, ${order.id}, ${itemA.id}) RETURNING id`;
  await assert.rejects(o.proposeChange(office as any, order.id, { reason: 'Adet düşür', lines: [{ orderItemId: itemA.id, quantity: 0 }] }));
  const proposal: any = await o.proposeChange(office as any, order.id, { reason: 'Genişlik 4200 olacak', lines: [{ orderItemId: itemA.id, widthMm: 4200, unitPrice: 450 }] });
  const pending = proposal.changes.find((c: any) => c.id === proposal.id);
  assert.deepEqual([pending.status, pending.impact.level], ['pending', 'warn']);
  await assert.rejects(o.decideChange(office as any, order.id, proposal.id, { decision: 'apply' }), /Üretim etkisini onaylayın/);
  sales = await o.decideChange(office as any, order.id, proposal.id, { decision: 'apply', acknowledgeImpact: true });
  const [lineA] = await db`SELECT width_mm, unit_price, total_price FROM order_items WHERE id = ${itemA.id}`;
  assert.deepEqual([Number(lineA.width_mm), Number(lineA.unit_price), Number(lineA.total_price)], [4200, 450, 900]);
  assert.equal(sales.totalAmount, 1300, 'lines 1200 → 1300, total scaled with them');
  // A colour-only change leaves money alone; a quantity change keeps the line's discount.
  let colour: any = await o.proposeChange(office as any, order.id, { reason: 'Renk değişti', lines: [{ orderItemId: itemB.id, color: 'RAL 9016 Mat' }] });
  sales = await o.decideChange(office as any, order.id, colour.id, { decision: 'apply' });
  assert.equal(sales.totalAmount, 1300, 'colour alone does not reprice');
  await db`UPDATE order_items SET total_price = 360 WHERE id = ${itemB.id}`;
  colour = await o.proposeChange(office as any, order.id, { reason: 'İki adet', lines: [{ orderItemId: itemB.id, quantity: 2 }] });
  await o.decideChange(office as any, order.id, colour.id, { decision: 'apply' });
  assert.equal(Number((await db`SELECT total_price FROM order_items WHERE id = ${itemB.id}`)[0].total_price), 720, 'the 10 % line discount is kept');
  const [applied] = await db`SELECT changes FROM activity_logs WHERE entity_id = ${order.id} AND action = 'change_applied' ORDER BY created_at LIMIT 1`;
  assert.deepEqual(applied.changes['Pergola genişlik'], { from: 4000, to: 4200 });
  const [workerNotice] = await db`SELECT title, message, data FROM notifications WHERE user_id = ${workerId} AND data->>'entityId' = ${job.id}`;
  assert.ok(workerNotice, 'the work order assignee is told');
  assert.equal(/450|900|1300|Bayi/.test(workerNotice.title + workerNotice.message), false, 'no price or customer in the worker notice');
  assert.equal(sales.plan.mismatch !== null, true, 'the plan no longer adds up after the change and says so');
  await assert.rejects(o.decideChange(office as any, order.id, proposal.id, { decision: 'reject' }), /sonuçlandı/);

  // Partial delivery per line; no more than what is left; the order's delivery day once all is delivered.
  await assert.rejects(o.recordDelivery(office as any, order.id, { deliveredOn: today, lines: [{ orderItemId: itemA.id, quantity: 3 }] }), /kalan 2/);
  sales = await o.recordDelivery(office as any, order.id, { deliveredOn: today, lines: [{ orderItemId: itemA.id, quantity: 1 }] });
  assert.deepEqual(sales.lines.map((l: any) => l.deliveryStatus), ['partial', 'open']);
  assert.equal(sales.dates.delivered, null);

  await assert.rejects(o.proposeChange(office as any, order.id, { reason: 'Genişlik yine değişsin', lines: [{ orderItemId: itemA.id, widthMm: 4300 }] }), /teslim edilmiş/);
  // Finish the delivery: the rest of both lines; the delivery day is noted.
  sales = await o.recordDelivery(office as any, order.id, { deliveredOn: today, lines: [{ orderItemId: itemA.id, quantity: 1 }, { orderItemId: itemB.id, quantity: 2 }] });
  assert.deepEqual([sales.lines.map((l: any) => l.deliveryStatus), sales.dates.delivered], [['delivered', 'delivered'], today]);
  await assert.rejects(o.proposeChange(office as any, order.id, { reason: 'Renk değişsin', lines: [{ orderItemId: itemB.id, color: 'RAL 9016' }] }), /teslim edilmiş/);

  await db.end();
  await sql.end?.();
  console.log('PASS · sales depth: firm quote settings (managers only), customer price list (family over general) applied to new lines, VAT rate and typed FX rate in totals, discount over threshold needs a manager before sending or converting, firm default validity on send, customer approval link (own quote, no internal notes, one decision with name/time/IP, seller notified), revision snapshot + diff + old link closed, expiry on its day (trace; no accept/convert/link), templates unique by name, one order state machine for every path with reasons for hold/cancel/back, promise frozen at approval and moved only with a reason, worker never / accounts read+plan only, payment plan adds up and payments fill installments in order, partial delivery per line never over what is left, change request with production impact acknowledged, total scaled, field trace and price-free notice to the work order, delivered goods cannot change, migration twice is a no-op');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
