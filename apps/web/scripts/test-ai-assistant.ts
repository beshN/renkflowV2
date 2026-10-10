/**
 * Integration test for the proactive assistant (gece 3) on the isolated local test database only:
 * settings and the KVKK switch, the model gate (off / rules / budget / daily calls), a detector's
 * run (file, suppress, expire when resolved), snooze, rejection reasons ("bir daha önerme"),
 * priority order, and every real detector's run against a seeded firm.
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['029_ai_suggestions.sql', '044_access_control.sql', '045_sales_service_chain.sql', '046_fleet.sql', '047_finance_foundation.sql', '048_ai_assistant.sql', '048_ai_assistant.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const { registerDetector, runDetector } = await import('../lib/ai/detectors/runner.server');
  const svc = await import('../lib/ai/suggestions/service');
  const settings = await import('../lib/ai/settings.server');
  const gate = await import('../lib/ai/gate.server');
  const { ModelBlockedError } = await import('../lib/ai/policy');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'AI asistan test', ${'ai-asst-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office']] as const) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${id}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };

  // Settings: defaults as today; turning the model on needs the KVKK confirmation; office may not change it.
  assert.equal((await settings.getAiSettings(tenantId)).mode, 'assist');
  await settings.saveAiSettings(owner, { mode: 'rules' });
  await assert.rejects(settings.saveAiSettings(owner, { mode: 'assist' }), /KVKK/);
  await settings.saveAiSettings(owner, { mode: 'assist', kvkkAck: true });
  assert.ok((await settings.getAiSettings(tenantId)).kvkkAckAt);
  await assert.rejects(settings.saveAiSettings(office, { mode: 'off' }), (e: any) => e.status === 403);

  // The model gate: off / rules never call; the firm's budget and the person's daily calls cap it.
  await settings.saveAiSettings(owner, { mode: 'rules' });
  await assert.rejects(gate.assertModelAllowed({ tenantId, userId: ownerId }), (e: any) => e instanceof ModelBlockedError && e.block === 'AI_RULES_ONLY');
  await settings.saveAiSettings(owner, { mode: 'assist', dailyBudgetUsd: 1, userDailyCalls: 2 });
  await gate.assertModelAllowed({ tenantId, userId: ownerId });
  await db`INSERT INTO ai_usage (tenant_id, user_id, feature, provider, model, latency_ms, status, cost_usd) VALUES (${tenantId}, ${ownerId}, 'test', 'openai', 'gpt-6-luna', 10, 'ok', 0.4), (${tenantId}, ${ownerId}, 'test', 'openai', 'gpt-6-luna', 10, 'ok', 0.4)`;
  await assert.rejects(gate.assertModelAllowed({ tenantId, userId: ownerId }), (e: any) => e.block === 'AI_USER_LIMIT');
  await gate.assertModelAllowed({ tenantId, userId: officeId });
  await db`INSERT INTO ai_usage (tenant_id, user_id, feature, provider, model, latency_ms, status, cost_usd) VALUES (${tenantId}, ${officeId}, 'test', 'openai', 'gpt-6-luna', 10, 'ok', 0.3)`;
  await assert.rejects(gate.assertModelAllowed({ tenantId, userId: officeId }), (e: any) => e.block === 'AI_BUDGET');
  await settings.saveAiSettings(owner, { dailyBudgetUsd: null, userDailyCalls: 60 });

  // A test detector: one finding per row of a scratch table; approval writes a mark.
  await db.unsafe('CREATE TABLE IF NOT EXISTS ai_detector_probe (tenant_id uuid, k text, urgent boolean DEFAULT false, done boolean DEFAULT false)');
  registerDetector({
    key: 'probe', label: 'Deneme', icon: 'Bell', roles: ['owner', 'admin'], defaults: { enabled: true, quietDays: 7 },
    payloadSchema: z.object({ k: z.string(), message: z.string().optional() }),
    editableFields: [{ key: 'message', label: 'Mesaj', type: 'text' }],
    detect: async (actor) => (await sql`SELECT k, urgent FROM ai_detector_probe WHERE tenant_id = ${actor.tenantId} AND NOT done`).map((r: any) => ({
      detector: 'probe', dedupeKey: `probe:${r.k}`, title: `Deneme ${r.k}`, rationale: 'Deneme bulgusu.', priority: r.urgent ? 'high' : 'low', confidence: 'high', rule: 'Deneme kuralı',
      evidence: { badges: [{ label: '3 gün', tone: 'warning' }], records: [], numbers: { k: r.k } }, payload: { k: r.k },
      draft: { channel: 'message', to: null, text: `Merhaba ${r.k}`, tone: 'formal' },
    })),
    apply: async (tx, actor, payload) => { await tx`UPDATE ai_detector_probe SET done = true WHERE tenant_id = ${actor.tenantId} AND k = ${payload.k}`; return { done: payload.k }; },
  });
  const probe = (await import('../lib/ai/detectors/runner.server')).listDetectors().find((d) => d.key === 'probe')!;
  await db`INSERT INTO ai_detector_probe (tenant_id, k, urgent) VALUES (${tenantId}, 'a', false), (${tenantId}, 'b', true), (${tenantId}, 'c', false)`;
  let r = await runDetector(probe, owner);
  assert.deepEqual([r.filed, r.skipped], [3, 0]);
  r = await runDetector(probe, owner);
  assert.deepEqual([r.filed, r.skipped], [0, 3], 'the same situations are not filed twice');

  // The queue: urgent first, with evidence, rule, and the draft message as an editable field.
  let list = await svc.listPendingSuggestions(owner, { refresh: false });
  assert.equal(list[0].title, 'Deneme b');
  assert.deepEqual([list[0].priority, list[0].rule, list[0].evidence?.badges[0].label, list[0].payload.message], ['high', 'Deneme kuralı', '3 gün', 'Merhaba b']);
  assert.equal((await svc.listPendingSuggestions(office, { refresh: false })).length, 0, 'office does not decide this kind');

  // Edit the draft, snooze one, reject one for good, approve one.
  const a = list.find((x) => x.title === 'Deneme a')!;
  const edited = await svc.decideSuggestion(owner, a.id, { action: 'edit', expectedVersion: a.version, payload: { message: 'Merhaba a, düzeltildi' } });
  const ex = await db`SELECT original_payload, corrected_payload FROM ai_feedback_examples WHERE suggestion_id = ${a.id}`;
  assert.equal(ex[0].corrected_payload.message, 'Merhaba a, düzeltildi', 'the edit is kept as an improvement example');
  const c = list.find((x) => x.title === 'Deneme c')!;
  await svc.decideSuggestion(owner, c.id, { action: 'snooze', expectedVersion: c.version, days: 3 });
  list = await svc.listPendingSuggestions(owner, { refresh: false });
  assert.ok(!list.some((x) => x.title === 'Deneme c'), 'snoozed is out of sight');
  const b = list.find((x) => x.title === 'Deneme b')!;
  await svc.decideSuggestion(owner, b.id, { action: 'reject', expectedVersion: b.version, reason: 'never' });
  await svc.decideSuggestion(owner, a.id, { action: 'approve', expectedVersion: (edited as any).version });
  assert.equal((await db`SELECT done FROM ai_detector_probe WHERE tenant_id = ${tenantId} AND k = 'a'`)[0].done, true);
  // b (rejected for good) is not filed again even though the situation is still there.
  r = await runDetector(probe, owner);
  assert.equal(r.filed, 0);
  // c's situation is resolved → its pending suggestion expires.
  await db`UPDATE ai_detector_probe SET done = true WHERE tenant_id = ${tenantId} AND k = 'c'`;
  r = await runDetector(probe, owner);
  assert.equal(r.expired, 1);
  // Turned off for this firm: open ones close, nothing new is filed; "off" mode hides detector cards.
  await db`INSERT INTO ai_detector_probe (tenant_id, k) VALUES (${tenantId}, 'd')`;
  await settings.saveAiSettings(owner, { detectors: { probe: { enabled: false } } });
  r = await runDetector(probe, owner);
  assert.equal(r.filed, 0);
  await settings.saveAiSettings(owner, { detectors: { probe: { enabled: true } } });
  await runDetector(probe, owner);
  await settings.saveAiSettings(owner, { mode: 'off' });
  assert.equal((await svc.listPendingSuggestions(owner, { refresh: false })).filter((x) => x.detector).length, 0);
  assert.equal((await runDetector(probe, owner)).filed, 0);
  await settings.saveAiSettings(owner, { mode: 'assist' });

  // The real detectors against a seeded firm ------------------------------------------------------
  const { runAllDetectors } = await import('../lib/ai/detectors/registry.server');
  const accId = randomUUID();
  await db`INSERT INTO users (id, email, name) VALUES (${accId}, ${`acc-${accId}@test.local`}, 'Muhasebe')`;
  await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${accId}, 'accountant')`;
  const acc = { tenantId, userId: accId, role: 'accountant' as const };
  const d = (n: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + n * 86_400_000));
  const [cust] = await db`INSERT INTO customers (tenant_id, full_name, company_name, payment_terms) VALUES (${tenantId}, 'Deniz Kaya', 'Kaya Yapı', 15) RETURNING id`;
  // 1: an order in production, due in 2 days, its status unchanged for 4 days.
  const [late] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, currency, delivery_date, product_name)
    VALUES (${tenantId}, ${'ORD-AI-' + tenantId.slice(0, 5)}, ${cust.id}, 'Kaya Yapı', 'in_production', 12000, 'TRY', ${d(2)}, 'Pergola') RETURNING id`;
  await db`INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, created_at) VALUES (${tenantId}, 'order', ${late.id}, 'status_changed', now() - interval '4 days')`;
  // 3: a quote sent 4 days ago.
  const [quote] = await db`INSERT INTO quotations (tenant_id, quotation_number, customer_id, customer_name, status, total_amount, currency, valid_until, sent_at)
    VALUES (${tenantId}, ${'TKL-AI-' + tenantId.slice(0, 5)}, ${cust.id}, 'Kaya Yapı', 'sent', 48000, 'TRY', ${d(10)}, now() - interval '4 days') RETURNING id`;
  // 4: an invoice due 10 days ago, nothing collected.
  await db`INSERT INTO invoices (tenant_id, invoice_number, order_id, customer_id, customer_name, status, issued_on, due_on, subtotal, vat_total, total)
    VALUES (${tenantId}, 'FTR-000001', ${late.id}, ${cust.id}, 'Kaya Yapı', 'issued', ${d(-25)}, ${d(-10)}, 5000, 1000, 6000)`;
  // 7: a vehicle whose inspection ends in 5 days.
  const [veh] = await db`INSERT INTO vehicles (tenant_id, plate) VALUES (${tenantId}, '34AI001') RETURNING id`;
  await db`INSERT INTO vehicle_documents (tenant_id, vehicle_id, kind, expires_on) VALUES (${tenantId}, ${veh.id}, 'inspection', ${d(5)})`;
  // 2 + 5: a job needing 100 m of a profile nobody stocks, and a burst of scrap on it this week.
  const [wh] = await db`INSERT INTO warehouses (tenant_id, code, name, warehouse_type) VALUES (${tenantId}, ${'RAW-' + tenantId.slice(0, 4)}, 'Hammadde', 'RAW') RETURNING id`;
  const [item] = await db`INSERT INTO inventory_items (tenant_id, name, sku) VALUES (${tenantId}, 'Profil 7016', ${'P7016-' + tenantId.slice(0, 5)}) RETURNING id`;
  const [wo] = await db`INSERT INTO work_orders (tenant_id, title, status, order_id, due_at) VALUES (${tenantId}, 'İE pergola', 'open', ${late.id}, now() + interval '3 days') RETURNING id`;
  await db`INSERT INTO work_order_materials (tenant_id, work_order_id, item_id, source_warehouse_id, required_qty, uom) VALUES (${tenantId}, ${wo.id}, ${item.id}, ${wh.id}, 100, 'm')`;
  for (let i = 0; i < 4; i++) await db`INSERT INTO production_scrap_events (tenant_id, work_order_id, item_id, quantity, reason_code, created_by) VALUES (${tenantId}, ${wo.id}, ${item.id}, 1, 'cut_error', ${ownerId})`;

  const ran = await runAllDetectors(tenantId);
  for (const k of ['late_order', 'shortage', 'stale_quote', 'overdue_receivable', 'scrap_anomaly', 'expiry']) assert.ok((ran[k] as any).filed >= 1, `${k} filed: ${JSON.stringify(ran[k])}`);
  for (const k of ['capacity', 'offcut']) assert.ok(!('error' in ran[k]), `${k} runs: ${JSON.stringify(ran[k])}`);
  const again = await runAllDetectors(tenantId);
  assert.ok(Object.values(again).every((x: any) => x.filed === 0), 'a second run files nothing new');

  // Who sees what: office the sales/production-facing ones, accounting the receivables, the owner all.
  const ownerList = await svc.listPendingSuggestions(owner, { refresh: false });
  const byDet = (l: any[]) => new Set(l.map((x) => x.detector).filter(Boolean));
  assert.deepEqual([...byDet(await svc.listPendingSuggestions(office, { refresh: false }))].sort(), ['late_order', 'shortage', 'stale_quote']);
  assert.deepEqual([...byDet(await svc.listPendingSuggestions(acc, { refresh: false }))], ['overdue_receivable']);
  const lateCard = ownerList.find((x) => x.detector === 'late_order')!;
  assert.ok(lateCard.evidence!.badges.some((b: any) => /gündür aynı aşamada/.test(b.label)), 'evidence says how long it stalled');
  assert.match(String(lateCard.payload.message), /Sayın Kaya Yapı/);
  const overdueCard = (await svc.listPendingSuggestions(acc, { refresh: false }))[0];
  assert.match(overdueCard.title, /FTR-000001 vadesi 10 gün geçti/);

  // Approving: the order gets the new promise date; the quote, vehicle, shortage and scrap get a task.
  await svc.decideSuggestion(office, lateCard.id, { action: 'approve', expectedVersion: lateCard.version });
  const [promise] = await db`SELECT promised_date FROM orders WHERE id = ${late.id}`;
  assert.equal(new Date(promise.promised_date).toISOString().slice(0, 10) > d(2), true);
  for (const det of ['stale_quote', 'expiry', 'shortage', 'scrap_anomaly']) {
    const card = (await svc.listPendingSuggestions(owner, { refresh: false })).find((x) => x.detector === det)!;
    const r2: any = await svc.decideSuggestion(owner, card.id, { action: 'approve', expectedVersion: card.version });
    assert.ok(r2.result.todoId, `${det} made a task`);
  }
  assert.equal((await db`SELECT count(*)::int AS n FROM record_activities WHERE tenant_id = ${tenantId} AND rule_key LIKE 'assistant_%'`)[0].n, 4);
  const prepared = await db`SELECT note FROM activity_logs WHERE tenant_id = ${tenantId} AND action = 'customer_message_prepared'`;
  assert.equal(prepared.length, 2, 'message drafts are recorded as prepared, never as sent');
  void quote;

  const reasons = await db`SELECT reject_reason FROM ai_suggestions WHERE tenant_id = ${tenantId} AND status = 'rejected'`;
  assert.deepEqual(reasons.map((x) => x.reject_reason), ['never']);
  const audit = (await db`SELECT DISTINCT action FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_type = 'ai_suggestion'`).map((x) => x.action);
  for (const want of ['created', 'edited', 'snoozed', 'rejected', 'approved', 'expired']) assert.ok(audit.includes(want), `audit has ${want}`);

  await db`DELETE FROM ai_detector_probe WHERE tenant_id = ${tenantId}`;
  for (const t of ['production_scrap_events', 'work_order_materials', 'work_orders', 'invoices', 'warehouse_locations', 'warehouses', 'inventory_items'])
    await db`DELETE FROM ${db(t)} WHERE tenant_id = ${tenantId}`;
  await db`DELETE FROM tenants WHERE id = ${tenantId}`;
  await db`DELETE FROM users WHERE id = ANY(${[ownerId, officeId, accId]}::uuid[])`;
  await db.end();
  await (sql as any).end?.();
  console.log('test:ai-assistant OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
