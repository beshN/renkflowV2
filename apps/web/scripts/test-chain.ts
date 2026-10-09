/**
 * Integration test for the sales-to-service chain (gece 2, Tur 2) on the isolated local test
 * database only: lead → survey → quote → order → installation → customer sign-off → approved
 * "delivered" suggestion → warranty ticket, with each link reached from the previous one.
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
  for (const file of ['029_ai_suggestions.sql', '040_record_platform.sql', '041_quote_order_depth.sql', '044_access_control.sql', '045_sales_service_chain.sql', '045_sales_service_chain.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const leads = await import('../lib/features/field/leads.server');
  const inst = await import('../lib/features/field/installations.server');
  const svc = await import('../lib/features/field/service.server');
  const suggestions = await import('../lib/ai/suggestions/service');
  const { quotationService } = await import('../lib/features/quotations/service');
  const { applyOrderStatus } = await import('../lib/features/sales/order-status.server');
  const { withTransaction } = await import('../lib/db');
  const records = await import('../lib/features/records/service');

  const tenantId = randomUUID();
  const ids: Record<string, string> = {};
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Zincir Test', ${'chain-' + tenantId.slice(0, 8)})`;
  for (const role of ['owner', 'office', 'worker', 'worker2', 'accountant']) {
    ids[role] = randomUUID();
    await db`INSERT INTO users (id, email, name) VALUES (${ids[role]}, ${`${role}-${ids[role]}@test.local`}, ${role === 'worker2' ? 'Usta İki' : role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ids[role]}, ${role === 'worker2' ? 'worker' : role})`;
  }
  const office = { tenantId, userId: ids.office, role: 'office' as const };
  const worker = { tenantId, userId: ids.worker, role: 'worker' as const };
  const worker2 = { tenantId, userId: ids.worker2, role: 'worker' as const };
  const accountant = { tenantId, userId: ids.accountant, role: 'accountant' as const };

  // 1. Lead, follow-up and survey appointment.
  await assert.rejects(leads.createLead(worker, { title: 'x', contactName: 'y' }), (e: any) => e.status === 403);
  const lead = await leads.createLead(office, { title: 'Bahçe pergolası', contactName: 'Deniz Kaya', phone: '0532 000 00 00', email: 'deniz@ornek.test', address: 'Moda Cad. 1, Kadıköy', source: 'referral', productFamily: 'pergola', nextFollowUp: '2026-10-12' });
  assert.match(lead.number, /^POT-\d{6}$/);
  const survey = await leads.createSurvey(office, lead.id, { scheduledAt: '2026-10-11T09:00:00+03:00', assignedTo: ids.office });
  let l = await leads.getLead(office, lead.id);
  assert.equal(l.stage, 'survey', 'planning a survey moves a new lead to survey');
  assert.equal(l.surveys[0].address, 'Moda Cad. 1, Kadıköy');
  assert.match(l.mapUrl!, /openstreetmap/);
  await assert.rejects(leads.saveSurvey(office, survey.id, { status: 'done', measures: { widthMm: 4000 } }), /Ölçü eksik/);
  await leads.saveSurvey(office, survey.id, { status: 'done', measures: { widthMm: 4000, projectionMm: 3000, mountingHeightMm: 2500, postCount: 2, motorSide: 'Sol', power: true } });

  // 2. Winning the lead opens the customer card and a draft quote from the measures (one step).
  await assert.rejects(leads.moveLead(office, lead.id, { to: 'lost' }), /Kayıp nedeni/);
  l = await leads.moveLead(office, lead.id, { to: 'quoted' });
  assert.ok(l.quotationId && l.customerId, 'quote and customer exist');
  const quote: any = await quotationService.getQuotationById(tenantId, l.quotationId!);
  assert.equal(quote.items[0].widthMm, 4000);
  assert.match(quote.items[0].notes, /Ayak sayısı: 2/);
  const [card] = await db`SELECT full_name, phone FROM customers WHERE id = ${l.customerId}`;
  assert.equal(card.full_name, 'Deniz Kaya');
  // Measures changed after the quote: the quote screen is warned.
  await leads.saveSurvey(office, survey.id, { measures: { widthMm: 4200, projectionMm: 3000, mountingHeightMm: 2500, postCount: 2, motorSide: 'Sol', power: true } });
  const changes = await leads.measureChangesForQuote(office, l.quotationId!);
  assert.deepEqual(changes[0].changes, [{ key: 'widthMm', label: 'En (mm)', before: 4000, after: 4200 }]);
  l = await leads.moveLead(office, lead.id, { to: 'won' });
  assert.equal(l.stage, 'won');
  const report = await leads.leadReport(office);
  assert.equal(report.bySource.find((s) => s.source === 'referral')?.conversionPct, 100);

  // 3. Quote → order (existing conversion).
  const conversion: any = await quotationService.convertToOrder(tenantId, l.quotationId!, ids.office, undefined, 'office');
  const orderId = String(conversion.orderId);
  const [order] = await db`SELECT status, order_number FROM orders WHERE id = ${orderId}`;

  // 4. Order → installation plan in one call; checklist seeded; conflict warned, not blocked.
  await assert.rejects(inst.planInstallation(worker, orderId, {}), (e: any) => e.status === 403);
  const plan = await inst.planInstallation(office, orderId, { date: '2026-10-20', startTime: '09:00', durationMinutes: 240, crew: [ids.worker, ids.worker2], crewName: 'Ekip A' });
  assert.match(plan.number, /^MNT-\d{6}$/);
  const other = await inst.planInstallation(office, orderId, { date: '2026-10-20', startTime: '11:00', durationMinutes: 120, crew: [ids.worker2] });
  assert.equal(other.conflicts.length, 1, 'the same person twice at once is reported');
  const moved = await inst.updateInstallation(office, other.id, { date: '2026-10-21' });
  assert.equal(moved.conflicts.length, 0, 'moving it to another day (calendar drag) clears the conflict');
  const checklist = await db`SELECT id FROM record_checklist_items WHERE tenant_id = ${tenantId} AND entity_type = 'installation' AND entity_id = ${plan.id}`;
  assert.equal(checklist.length, 6);

  // The crew sees only its own jobs, as a technical view (no customer, address or prices).
  const crewView = await inst.listInstallations(worker);
  assert.equal(crewView.installations.length, 1);
  const text = JSON.stringify(crewView);
  for (const leak of ['Deniz', 'Moda', '0532', 'deniz@', 'customerName', 'address', 'totalAmount']) assert.ok(!text.includes(leak), `crew view leaks ${leak}`);
  await assert.rejects(inst.updateInstallation(worker, plan.id, { date: '2026-10-22' }), /ofis/);
  await assert.rejects(inst.getInstallation({ tenantId, userId: ids.accountant, role: 'worker' } as any, plan.id), (e: any) => e.status === 404);
  // The crew works the job: starts it, ticks the checklist (records platform), notes a missing part.
  await inst.updateInstallation(worker, plan.id, { status: 'in_progress' });
  await records.recordCommand(worker as any, 'installation', plan.id, { action: 'checklist.toggle', itemId: checklist[0].id, done: true });
  await inst.addIssue(worker, plan.id, { kind: 'missing', text: '2 adet ankraj eksik' });

  // 5. Delivery sign-off by the customer through the link (shown once, hash stored).
  const link = await inst.createSignoffLink(office, plan.id);
  const token = link.path.split('/').pop()!;
  const [stored] = await db`SELECT signoff_token_hash FROM installations WHERE id = ${plan.id}`;
  assert.notEqual(stored.signoff_token_hash, token);
  const page = await inst.publicSignoff(token);
  assert.equal(page?.number, plan.number);
  assert.ok(!JSON.stringify(page).match(/price|amount|total/i), 'the sign-off page shows no prices');
  assert.equal(page?.issues[0].text, '2 adet ankraj eksik');
  assert.equal(await inst.publicSignoff('x'.repeat(43)), null);
  // The order reaches "ready for shipment" through the state machine (production finished).
  const path: Record<string, string[]> = { new: ['approved'], pending: ['approved'], approved: ['preparing_materials', 'ready_for_production', 'in_production', 'ready_for_shipment'] };
  for (const step of ['approved', ...path.approved].filter((s, i, all) => all.indexOf(s) === i)) {
    const [cur] = await db`SELECT status FROM orders WHERE id = ${orderId}`;
    if (cur.status === 'ready_for_shipment') break;
    if (cur.status === step) continue;
    await withTransaction((tx: any) => applyOrderStatus(tx, { tenantId, orderId, from: cur.status, to: step, actorId: ids.office }));
  }
  await assert.rejects(inst.signDelivery(token, { name: 'De', accept: true }, { ip: '10.0.0.1', agent: 'test' }));
  await inst.signDelivery(token, { name: 'Deniz Kaya', accept: true, note: 'Ankrajlar sonra gelecek' }, { ip: '10.0.0.1', agent: 'test' });
  await assert.rejects(inst.signDelivery(token, { name: 'Deniz Kaya', accept: true }, { ip: '10.0.0.1', agent: 'test' }), /zaten/);
  const [signed] = await db`SELECT status, signed_name, signed_at FROM installations WHERE id = ${plan.id}`;
  assert.equal(signed.status, 'done');
  assert.equal(signed.signed_name, 'Deniz Kaya');

  // 6. The "mark delivered" suggestion waits for approval; approving runs the state machine.
  const [{ status: beforeApproval }] = await db`SELECT status FROM orders WHERE id = ${orderId}`;
  assert.equal(beforeApproval, 'ready_for_shipment', 'nothing changed before approval');
  const pending: any = await suggestions.listPendingSuggestions(office as any);
  const card2 = (pending.suggestions ?? pending).find((s: any) => s.kind === 'installation.mark_delivered');
  assert.ok(card2, 'delivered suggestion filed');
  await suggestions.decideSuggestion(office as any, card2.id, { action: 'approve', expectedVersion: card2.version });
  const [after] = await db`SELECT status, delivered_on FROM orders WHERE id = ${orderId}`;
  assert.equal(after.status, 'delivered');
  assert.ok(after.delivered_on);

  // 7. Delivered order → warranty ticket in one call; warranty judged at opening.
  await assert.rejects(svc.openTicket(worker, { orderId, title: 'Sızıntı' }), (e: any) => e.status === 403);
  const ticket = await svc.openTicket(office, { installationId: plan.id, title: 'Köşeden su sızıyor', category: 'leak', assignedTo: ids.worker });
  assert.equal(ticket.inWarranty, true);
  assert.match(ticket.number, /^SRV-\d{6}$/);
  await assert.rejects(svc.updateTicket(worker, ticket.id, { status: 'resolved' }), /Çözümü/);
  await svc.updateTicket(worker, ticket.id, { status: 'in_progress', parts: [{ name: 'Silikon', quantity: 1 }], laborMinutes: 45 });
  await svc.updateTicket(worker, ticket.id, { status: 'resolved', resolution: 'Köşe contası yenilendi' });
  const crewTickets = await svc.listTickets(worker2);
  assert.equal(crewTickets.length, 0, 'the other crew member does not see a ticket not assigned to them');
  await svc.openTicket(office, { orderId, title: 'Yine sızıntı', category: 'leak' });
  const svcReport = await svc.ticketReport(office);
  assert.equal(svcReport.recurring.byOrder[0].count, 2);
  assert.equal(svcReport.recurring.byOrder[0].orderNumber, order.order_number);

  // 8. The chain from the order's side: lead, installations, tickets, warranty — each one click away.
  const chain: any = await svc.orderChain(office, orderId);
  assert.equal(chain.lead?.number, lead.number);
  assert.equal(chain.installations.length, 2);
  assert.equal(chain.tickets.length, 2);
  assert.equal(chain.warranty.covered, true);
  assert.equal(chain.can.planInstallation, true);
  const crewChain: any = await svc.orderChain(worker, orderId);
  assert.equal(crewChain.lead, null);
  assert.ok(!JSON.stringify(crewChain).includes('Deniz'));
  // The accountant may look but not plan.
  await assert.rejects(inst.planInstallation(accountant, orderId, {}), (e: any) => e.status === 403);

  // Every step left a trace in the single audit trail.
  const actions = (await db`SELECT DISTINCT entity_type || ':' || action AS a FROM activity_logs WHERE tenant_id = ${tenantId}`).map((r) => r.a);
  for (const want of ['lead:created', 'lead:survey_planned', 'lead:stage_changed', 'lead:quotation_created', 'installation:created', 'installation:missing_noted',
    'installation:signoff_link_created', 'installation:delivery_signed', 'order:status_changed', 'service_ticket:created', 'service_ticket:status_changed'])
    assert.ok(actions.includes(want), `audit has ${want}`);

  await db`DELETE FROM tenants WHERE id = ${tenantId}`;
  await db`DELETE FROM users WHERE id = ANY(${Object.values(ids)}::uuid[])`;
  await db.end();
  const { sql } = await import('../lib/db');
  await (sql as any).end?.();
  console.log('test:chain OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
