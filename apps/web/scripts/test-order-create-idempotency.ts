/** Runs only on the runner's throwaway, local renkflow_test database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
import type { NewOrderFormData } from '../lib/types';

async function main() {
  process.env.AUTH_SECRET = randomUUID() + randomUUID();
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  const { sql } = await import('../lib/db');
  const { PostgresOrderService } = await import('../lib/features/orders/postgres/order.postgres');
  const service = new PostgresOrderService();
  const tenants = [randomUUID(), randomUUID()];
  const data: NewOrderFormData = {
    customerName: 'Idempotency test', productName: 'Profil', quantity: 2,
    totalAmount: 100, currency: 'TRY',
    items: [{ productName: 'Profil', quantity: 2, unitPrice: 50, totalPrice: 100 }],
  };
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const migration = readFileSync('lib/db/migrations/088_order_client_request_id.sql', 'utf8');
    await db.unsafe(migration);
    await db.unsafe(migration); // Reapplying the additive migration is safe.
    for (const id of tenants)
      await db`INSERT INTO tenants (id,name,slug) VALUES (${id}, 'Idempotency test', ${'idem-' + id})`;

    const key = randomUUID();
    const first = await service.createOrder(tenants[0], data, [], undefined, key);
    // Simulate a lost response, then replay even after mutable order data changes.
    await db`UPDATE orders SET notes='later edit' WHERE tenant_id=${tenants[0]} AND id=${first.id}`;
    assert.equal((await service.createOrder(tenants[0], data, [], undefined, key)).id, first.id);
    const conflict = (error: unknown) => (error as { status?: number }).status === 409;
    await assert.rejects(service.createOrder(tenants[0], { ...data, totalAmount: 101 }, [], undefined, key), conflict);
    await assert.rejects(service.createOrder(tenants[0], { ...data, items: [{ ...data.items![0], quantity: 3 }] }, [], undefined, key), conflict);
    await assert.rejects(service.createOrder(tenants[0], data, [new File(['changed'], 'test.pdf', { type: 'application/pdf' })], undefined, key), conflict);
    assert.equal((await service.createOrder(tenants[0], data, [], undefined, key.toUpperCase())).id, first.id, 'UUID case does not change the request identity');
    const other = await service.createOrder(tenants[1], data, [], undefined, key);
    assert.notEqual(other.id, first.id, 'same key belongs independently to each tenant');

    const raceKey = randomUUID();
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => service.createOrder(tenants[0], data, [], undefined, raceKey)));
    assert.equal(new Set(concurrent.map(order => order.id)).size, 1, 'concurrent retries return one id');
    assert.equal((await db`SELECT count(*)::int AS n FROM orders WHERE tenant_id=${tenants[0]} AND client_request_id=${raceKey}`)[0].n, 1);
    assert.equal((await db`SELECT count(*)::int AS n FROM order_items WHERE order_id=${first.id}`)[0].n, 1);
    assert.equal((await db`SELECT count(*)::int AS n FROM activity_logs WHERE tenant_id=${tenants[0]} AND entity_id=${first.id} AND action='created'`)[0].n, 1);
    assert.equal((await db`SELECT count(*)::int AS n FROM customers WHERE tenant_id=${tenants[0]}`)[0].n, 1);

    const retryKey = randomUUID();
    await assert.rejects(service.createOrder(tenants[0], { ...data, customerId: randomUUID() }, [], undefined, retryKey));
    assert.ok((await service.createOrder(tenants[0], data, [], undefined, retryKey)).id, 'failed transaction does not consume the key');
    const legacy = await Promise.all([service.createOrder(tenants[0], data), service.createOrder(tenants[0], data)]);
    assert.notEqual(legacy[0].id, legacy[1].id, 'nullable keys preserve legacy callers');
    await assert.rejects(db`INSERT INTO orders (tenant_id,order_number,customer_name,total_amount,client_request_id) VALUES (${tenants[0]},${'duplicate-' + key},'Duplicate',0,${key})`, (error: unknown) => (error as { code?: string }).code === '23505');
    console.log('PASS · migration replay, lost response, changed payload/files, tenant isolation, concurrent retries, single side effects, rollback retry, legacy callers, unique index');
  } finally {
    try {
      // Cleanup runs even when an assertion fails; the runner also removes the whole cluster.
      await db.begin(async tx => {
        await tx`SELECT set_config('renkflow.audit_purge', 'on', true)`;
        await tx`DELETE FROM activity_logs WHERE tenant_id IN ${tx(tenants)}`;
        await tx`DELETE FROM tenants WHERE id IN ${tx(tenants)}`;
      });
    } finally {
      await sql.end({ timeout: 5 });
      await db.end({ timeout: 5 });
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
