/** Integration test for production depth (Tur C), on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['030_cutting_defaults.sql', '037_production_lead.sql', '038_notification_json.sql', '040_record_platform.sql', '042_production_depth.sql', '042_production_depth.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const p = await import('../lib/features/production/depth.server');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID(), workerId = randomUUID(), otherWorkerId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Üretim Test', ${'prod-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office'], [workerId, 'worker'], [otherWorkerId, 'worker']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${id}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  await db`INSERT INTO manufacturing_preferences (tenant_id, production_lead_user_id) VALUES (${tenantId}, ${officeId}) ON CONFLICT (tenant_id) DO UPDATE SET production_lead_user_id = ${officeId}`;
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };
  const worker = { tenantId, userId: workerId, role: 'worker' as const };
  const other = { tenantId, userId: otherWorkerId, role: 'worker' as const };

  const [order] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency)
    VALUES (${tenantId}, 'URT-1', 'Gizli Müşteri', 'Pergola', 1, 'in_production', 99999, 'TRY') RETURNING id`;
  const [job] = await db`INSERT INTO work_orders (tenant_id, title, category, assigned_to, created_by, order_id) VALUES (${tenantId}, 'URT-1 · Pergola', 'production', ${workerId}, ${officeId}, ${order.id}) RETURNING id`;

  // The firm starts with default reasons; managers rename, add and switch off.
  let reasons: any = await p.allReasonCodes(office as any);
  assert.ok(reasons.scrap.some((r: any) => r.code === 'cut_error'));
  await assert.rejects(p.saveReasonCode(office as any, { kind: 'scrap', label: 'Boya çizildi' }), (e: any) => e.status === 403);
  reasons = await p.saveReasonCode(owner as any, { kind: 'scrap', label: 'Boya çizildi' });
  assert.ok(reasons.scrap.some((r: any) => r.code === 'boya_cizildi'));
  reasons = await p.saveReasonCode(owner as any, { kind: 'scrap', code: 'handling', label: 'Taşıma / düşme', active: false });
  assert.equal(reasons.scrap.find((r: any) => r.code === 'handling').active, false);

  // Scrap: a worker on their own job, with an active reason; never on someone else's job.
  await assert.rejects(p.recordScrap(other as any, job.id, { reasonCode: 'cut_error', quantity: 1 }), (e: any) => e.status === 404);
  await assert.rejects(p.recordScrap(worker as any, job.id, { reasonCode: 'handling', quantity: 1 }), /Neden kodu/);
  let depth: any = await p.recordScrap(worker as any, job.id, { reasonCode: 'cut_error', quantity: 2, lengthMm: 1450, note: 'Açı ters' });
  await p.recordScrap(worker as any, job.id, { reasonCode: 'cut_error', quantity: 1 });
  depth = await p.recordScrap(office as any, job.id, { reasonCode: 'boya_cizildi', quantity: 1 });
  assert.deepEqual(depth.scrap.map((s: any) => s.reason).sort(), ['Boya çizildi', 'Yanlış kesim', 'Yanlış kesim']);
  assert.equal(/99999|Gizli/.test(JSON.stringify(await p.workOrderDepth(worker as any, job.id))), false, 'no price or customer on the worker view');
  const [scrapAudit] = await db`SELECT metadata FROM activity_logs WHERE entity_id = ${job.id} AND action = 'scrap_recorded' ORDER BY created_at LIMIT 1`;
  assert.equal(scrapAudit.metadata.reason, 'Yanlış kesim');

  // Delay: one open at a time; the production lead hears of it without the customer; the reporter or office closes it.
  depth = await p.reportDelay(worker as any, job.id, { reasonCode: 'material', note: 'Profil gelmedi', expectedUntil: '2026-10-12' });
  assert.deepEqual([depth.openDelay.reason, depth.openDelay.canResolve], ['Malzeme bekleniyor', true]);
  await assert.rejects(p.reportDelay(office as any, job.id, { reasonCode: 'machine' }), /açık bir gecikme/);
  const [notice] = await db`SELECT title, message FROM notifications WHERE user_id = ${officeId} AND type = 'order:delayed'`;
  assert.ok(notice && !/Gizli|99999/.test(notice.title + notice.message));
  await assert.rejects(p.resolveDelay(other as any, job.id), (e: any) => e.status === 404);
  depth = await p.resolveDelay(worker as any, job.id);
  assert.equal(depth.openDelay, null);
  await p.reportDelay(office as any, job.id, { reasonCode: 'paint' });

  // Insights for the office only: Pareto of reasons and open delays.
  await assert.rejects(p.productionInsights(worker as any), (e: any) => e.status === 403);
  const insights: any = await p.productionInsights(office as any);
  assert.deepEqual(insights.scrap.map((r: any) => [r.label, r.count]), [['Yanlış kesim', 2], ['Boya çizildi', 1]]);
  assert.equal(insights.scrap[0].vital, true);
  assert.deepEqual(insights.delay.map((r: any) => r.label).sort(), ['Boyahane', 'Malzeme bekleniyor']);
  assert.deepEqual(insights.openDelays.map((d: any) => d.reason), ['Boyahane']);
  assert.ok(Array.isArray(insights.capacity));

  // Bar lengths the firm can buy: managers only, kept sorted without duplicates, traced.
  await assert.rejects(p.saveBarLengthOptions(office as any, { options: [6500] }), (e: any) => e.status === 403);
  const lengths = await p.saveBarLengthOptions(owner as any, { options: [7000, 6500, 6500] });
  assert.deepEqual(lengths.options, [6500, 7000]);
  assert.ok((await db`SELECT 1 FROM activity_logs WHERE tenant_id = ${tenantId} AND action = 'bar_lengths_changed'`).length);

  // Cutting plan history: the plans for the same jobs, oldest first, with the change in waste.
  const first = randomUUID(), second = randomUUID();
  await db`INSERT INTO cutting_plans (id, tenant_id, status, work_order_ids, demand, parameters, result, created_by, idempotency_key, created_at)
    VALUES (${first}, ${tenantId}, 'cancelled', ${[job.id]}::uuid[], '[]', '{}', '{"wastePercent": 9.4, "bars": [1, 2, 3]}', ${officeId}, ${randomUUID()}, now() - interval '1 hour'),
           (${second}, ${tenantId}, 'draft', ${[job.id]}::uuid[], '[]', '{}', '{"wastePercent": 7.1, "bars": [1, 2]}', ${officeId}, ${randomUUID()}, now())`;
  const versions = await p.cutPlanVersions(office as any, second);
  assert.deepEqual(versions.map((v) => [v.id, v.wastePercent, v.wasteDelta]), [[first, 9.4, null], [second, 7.1, -2.3]]);
  await assert.rejects(p.cutPlanVersions(worker as any, second), (e: any) => e.status === 403);

  await db.end();
  await (sql as any).end?.();
  console.log('PASS · production depth: firm reason codes (defaults, managers rename/add/switch off), scrap with an active reason by the worker on their own job only (no price/customer on their view, traced), one open delay per job told to the production lead without customer, closed by the reporter or office, Pareto of scrap/delay reasons and open delays for the office only, live capacity rows, bar length options (managers, sorted, traced), cutting plan history with change in waste, migration twice is a no-op');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
