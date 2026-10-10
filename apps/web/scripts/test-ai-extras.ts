/**
 * Integration test for the assistant extras (gece 3, AI-6) on the isolated local test database only:
 * price hint from accepted quotes (role and feature limits), customer memory with sources, morning
 * summary per role, and the data quality guard (approve → fixed, undo → back; undo refused when the
 * value changed since). No model is used.
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
  for (const f of ['029_ai_suggestions.sql', '036_product_configuration.sql', '041_quote_order_depth.sql', '044_access_control.sql', '048_ai_assistant.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${f}`, 'utf8'));

  const { priceSuggestionFor } = await import('../lib/ai/insight/price.server');
  const { customerMemoryFor } = await import('../lib/ai/insight/customer-memory.server');
  const { morningFor } = await import('../lib/ai/insight/morning.server');
  const { runDetector, listDetectors } = await import('../lib/ai/detectors/registry.server');
  const { undoQualityFix } = await import('../lib/ai/detectors/quality.server');
  const svc = await import('../lib/ai/suggestions/service');
  const settings = await import('../lib/ai/settings.server');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID();
  const ids: Record<string, string> = {};
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Ekler test', ${'xtr-' + tenantId.slice(0, 8)})`;
  for (const role of ['owner', 'worker']) {
    ids[role] = randomUUID();
    await db`INSERT INTO users (id, email, name) VALUES (${ids[role]}, ${`${role}-${ids[role]}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ids[role]}, ${role})`;
  }
  const owner = { tenantId, userId: ids.owner, role: 'owner' as any };
  const worker = { tenantId, userId: ids.worker, role: 'worker' as any };

  // Customers (two cards with one phone = a duplicate) and their records.
  const [c1] = await db`INSERT INTO customers (tenant_id, full_name, phone) VALUES (${tenantId}, 'Selin Aydın', '0532 123 45 67') RETURNING id`;
  const [c2] = await db`INSERT INTO customers (tenant_id, full_name, phone) VALUES (${tenantId}, 'Selin Aydin', '05321234567') RETURNING id`;
  const q = async (n: number, area: [number, number], price: number, status = 'accepted', customer = c1.id) => {
    const [row] = await db`INSERT INTO quotations (tenant_id, quotation_number, customer_id, customer_name, status, currency) VALUES (${tenantId}, ${`TKL-X${n}-${tenantId.slice(0, 4)}`}, ${customer}, 'Selin Aydın', ${status}, 'TRY') RETURNING id`;
    await db`INSERT INTO quotation_items (tenant_id, quotation_id, product_name, width_mm, projection_mm, quantity, unit_price, total_price, color) VALUES (${tenantId}, ${row.id}, 'Pergola', ${area[0]}, ${area[1]}, 1, ${price}, ${price}, 'RAL 7016')`;
    return row.id;
  };
  await q(1, [3000, 4000], 36000); await q(2, [3000, 3500], 31500); await q(3, [4000, 3500], 42000); await q(4, [3000, 4000], 99000, 'rejected');
  await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, delivery_date) VALUES (${tenantId}, ${'ORD-XT-' + tenantId.slice(0, 4)}, ${c1.id}, 'Selin Aydın', 'in_production', 36000, now() - interval '2 days')`;
  const [o] = await db`SELECT id FROM orders WHERE tenant_id = ${tenantId}`;
  await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price, color) VALUES (${o.id}, 'Pergola', 1, 36000, 36000, '7016 mat')`;

  // Price hint: three accepted 10.5–14 m² quotes → median 3.000 ₺/m²; the rejected one does not count.
  const p: any = await priceSuggestionFor(owner, { family: 'pergola', widthMm: 3000, projectionMm: 4000 });
  assert.equal(p.basis, 'history');
  assert.equal(p.evidence.count, 3);
  assert.equal(p.evidence.medianPerM2, 3000);
  assert.equal(p.suggested, 36000);
  assert.match(p.warnings.join(' '), /maliyeti bilinmiyor/, 'no cost → no floor verdict, said so');
  await assert.rejects(priceSuggestionFor(worker, { family: 'pergola', widthMm: 3000, projectionMm: 4000 }), /yetkiniz yok/);
  await settings.saveAiSettings(owner, { features: { price_hint: false } });
  assert.equal(((await priceSuggestionFor(owner, { family: 'pergola', widthMm: 3000, projectionMm: 4000 })) as any).available, false);
  await settings.saveAiSettings(owner, { features: { price_hint: true }, profitFloorPercent: 20 });
  assert.equal((await settings.getAiSettings(tenantId)).profitFloorPercent, 20);

  // Customer memory: facts with sources; a worker cannot read it.
  const mem: any = await customerMemoryFor(owner, c1.id);
  assert.deepEqual(mem.facts.map((f: any) => f.key), ['since', 'orders', 'quotes', 'colors']);
  assert.match(mem.facts.find((f: any) => f.key === 'quotes').value, /4 teklif · sonuçlananların %75'i kabul/);
  await assert.rejects(customerMemoryFor(worker, c1.id), /yetkiniz yok/);

  // Morning: the owner sees the late order; the worker sees only their own job (no customers).
  await db`INSERT INTO work_orders (tenant_id, title, status, assigned_to, due_at) VALUES (${tenantId}, 'Kesim 7016', 'open', ${ids.worker}, now())`;
  const m1: any = await morningFor(owner);
  assert.ok(m1.lines.some((l: any) => l.key === 'late' && /1 sipariş terminini geçti/.test(l.text)));
  const m2: any = await morningFor(worker);
  assert.deepEqual(m2.lines.map((l: any) => l.key), ['jobs']);
  assert.doesNotMatch(JSON.stringify(m2), /Selin|₺/);

  // Data quality: the duplicate (same phone) and the colour spelling are found; approve → fixed; undo → back.
  const dq = listDetectors().find((d) => d.key === 'data_quality')!;
  await runDetector(dq, owner);
  const queue = await svc.listPendingSuggestions(owner, { refresh: false });
  const dup = queue.find((s: any) => s.kind === 'detector.data_quality' && s.payload.issue === 'duplicate_customer')!;
  const color = queue.find((s: any) => s.kind === 'detector.data_quality' && s.payload.issue === 'color_spelling')!;
  assert.ok(dup && color, 'both issues filed');
  await svc.decideSuggestion(owner, dup.id, { action: 'approve', expectedVersion: dup.version });
  const deactivated = (dup.payload as any).changes[0].id;
  assert.equal((await db`SELECT is_active FROM customers WHERE id = ${deactivated}`)[0].is_active, false);
  await undoQualityFix(owner, dup.id);
  assert.equal((await db`SELECT is_active FROM customers WHERE id = ${deactivated}`)[0].is_active, true, 'undo restores');
  await assert.rejects(undoQualityFix(owner, dup.id), /zaten geri alındı/);
  await svc.decideSuggestion(owner, color.id, { action: 'approve', expectedVersion: color.version });
  assert.equal((await db`SELECT color FROM order_items WHERE order_id = ${o.id}`)[0].color, 'RAL 7016 Mat');
  await db`UPDATE order_items SET color = 'RAL 9016' WHERE order_id = ${o.id}`;
  await assert.rejects(undoQualityFix(owner, color.id), /değişmiş/, 'a value changed since is not overwritten');
  assert.equal((await db`SELECT color FROM order_items WHERE order_id = ${o.id}`)[0].color, 'RAL 9016');
  await assert.rejects(undoQualityFix(worker, color.id), /yetkiniz yok/);

  await db`DELETE FROM order_items WHERE order_id = ${o.id}`;
  for (const t of ['work_orders', 'quotation_items', 'quotations', 'orders', 'customers', 'ai_suggestions', 'ai_settings'])
    await db`DELETE FROM ${db(t)} WHERE tenant_id = ${tenantId}`.catch(() => {});
  await db`DELETE FROM tenants WHERE id = ${tenantId}`.catch(() => {});
  await db`DELETE FROM users WHERE id = ANY(${Object.values(ids)}::uuid[])`.catch(() => {});
  await db.end();
  await (sql as any).end?.();
  console.log('test:ai-extras OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
