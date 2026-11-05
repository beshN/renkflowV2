/** Integration test for transitionOrder (order status command), on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';

const status = (code: number) => (e: any) => e?.status === code;

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['037_production_lead.sql', '038_notification_json.sql', '040_record_platform.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const { transitionOrder } = await import('../lib/features/orders/transitions.service');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID(), workerId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Durum geçişi test', ${'transition-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office'], [workerId, 'worker']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${tenantId}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };
  const worker = { tenantId, userId: workerId, role: 'worker' as const };
  const newOrder = async (n: string) =>
    (await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency)
      VALUES (${tenantId}, ${n}, 'Geçiş Müşteri', 'Pergola', 1, 'new', 1000, 'TRY') RETURNING id, version`)[0];
  const commandCount = async (orderId: string) =>
    (await db`SELECT count(*)::int AS n FROM order_transition_commands WHERE tenant_id = ${tenantId} AND order_id = ${orderId}`)[0].n;

  // 1. Replay: the same command twice answers the same result, marks it replayed and changes the order once.
  const order = await newOrder('TR-1');
  const command = { commandId: randomUUID(), version: order.version, newStatus: 'approved', note: '' };
  const first: any = await transitionOrder(office as any, order.id, command);
  assert.deepEqual([first.previousStatus, first.newStatus, first.version, first.replayed], ['new', 'approved', order.version + 1, undefined]);
  const again: any = await transitionOrder(office as any, order.id, command);
  assert.equal(again.replayed, true, 'replay says so');
  assert.deepEqual([again.orderId, again.newStatus, again.version], [first.orderId, first.newStatus, first.version]);
  const [row] = await db`SELECT status, version FROM orders WHERE id = ${order.id}`;
  assert.deepEqual([row.status, row.version], ['approved', order.version + 1], 'the order moved once');
  assert.equal(await commandCount(order.id), 1);
  console.log('PASS · replay: same command returns the stored result once');

  // 2. Same command id, different request (or another person): 409, nothing changes.
  await assert.rejects(transitionOrder(office as any, order.id, { ...command, newStatus: 'on_hold', note: 'farklı istek' }), status(409));
  await assert.rejects(transitionOrder(owner as any, order.id, command), status(409), 'another person cannot reuse the key');
  assert.equal((await db`SELECT status FROM orders WHERE id = ${order.id}`)[0].status, 'approved');
  assert.equal(await commandCount(order.id), 1);
  console.log('PASS · command key reused with a different hash or actor: 409');

  // 3. Stale version: another device changed the order first, 409.
  await assert.rejects(transitionOrder(office as any, order.id, { commandId: randomUUID(), version: order.version, newStatus: 'on_hold', note: 'eski sürüm' }), status(409));
  assert.equal((await db`SELECT version FROM orders WHERE id = ${order.id}`)[0].version, order.version + 1);
  console.log('PASS · version conflict: 409');

  // 4. An order under production management is moved only by production and shipment records: 409.
  const managed = await newOrder('TR-2');
  const [item] = await db`INSERT INTO inventory_items (tenant_id, name, sku) VALUES (${tenantId}, 'Pergola mamul', ${'PRG-' + tenantId.slice(0, 5)}) RETURNING id`;
  const [recipe] = await db`INSERT INTO production_recipes (tenant_id, code, name, version, finished_item_id, rules, operations, limits) VALUES (${tenantId}, 'TR', 'Geçiş reçetesi', 1, ${item.id}, '[]', '[]', '{}') RETURNING id`;
  await db`INSERT INTO work_orders (tenant_id, title, category, created_by, order_id, recipe_id) VALUES (${tenantId}, 'TR-2 · Pergola', 'production', ${officeId}, ${managed.id}, ${recipe.id})`;
  await assert.rejects(transitionOrder(office as any, managed.id, { commandId: randomUUID(), version: managed.version, newStatus: 'approved', note: '' }), status(409));
  assert.equal((await db`SELECT status FROM orders WHERE id = ${managed.id}`)[0].status, 'new');
  assert.equal(await commandCount(managed.id), 0);
  console.log('PASS · production-managed order: 409');

  // 5. Permission: a worker cannot change an order's status, 403; nothing is stored.
  const guarded = await newOrder('TR-3');
  await assert.rejects(transitionOrder(worker as any, guarded.id, { commandId: randomUUID(), version: guarded.version, newStatus: 'approved', note: '' }), status(403));
  assert.equal((await db`SELECT status FROM orders WHERE id = ${guarded.id}`)[0].status, 'new');
  assert.equal(await commandCount(guarded.id), 0);
  console.log('PASS · permission: 403');

  await sql.end({ timeout: 5 });
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
