/** Synthetic fixtures; real local PostgreSQL only. Auto-discovered by CI test:integration. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'synthetic-cutting-test-only-secret-2026';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { exportCuttingList } = await import('../lib/features/manufacturing/cutting-list-export.server');
  const a = { id: randomUUID() }, b = { id: randomUUID() }, user = { id: randomUUID() };
  try {
    await db`INSERT INTO tenants(id,name,slug) VALUES(${a.id},'Synthetic A',${randomUUID()}),(${b.id},'Synthetic B',${randomUUID()})`;
    await db`INSERT INTO users(id,name,email,password) VALUES(${user.id},'Synthetic',${randomUUID() + '@example.invalid'},'test-only')`;
    const actor = { tenantId: a.id, userId: user.id, role: 'owner' as const };
    const [item] = await db`INSERT INTO inventory_items(tenant_id,sku,name,unit,profile_code) VALUES(${b.id},'PRIVATE','Gizli profil','kg','SECRET-PROFILE') RETURNING id`;
    const [order] = await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount,status) VALUES(${b.id},${'SECRET-' + randomUUID()},'Synthetic customer',0,'pending') RETURNING id,order_number`;
    const [job] = await db`INSERT INTO work_orders(tenant_id,title,order_id) VALUES(${a.id},'Synthetic cross-tenant reference',${order.id}) RETURNING id`;
    const [foreignJob] = await db`INSERT INTO work_orders(tenant_id,title,order_id) VALUES(${b.id},'Private job',${order.id}) RETURNING id`;
    const result = { parameterSource: 'default', bars: [{ source: { itemId: item.id, lengthMm: "6000" }, pieces: [{ workOrderId: job.id, lengthMm: 1000 }, { workOrderId: foreignJob.id, lengthMm: "1200" }], remainingMm: "3794" }] };
    const [plan] = await db`INSERT INTO cutting_plans(tenant_id,work_order_ids,demand,parameters,result,created_by,idempotency_key) VALUES(${a.id},${[job.id]},'[]','{}',${db.json(result)},${user.id},${randomUUID()}) RETURNING id`;
    const before = await db`SELECT * FROM cutting_plans WHERE tenant_id=${a.id} AND id=${plan.id}`;
    const csv = await exportCuttingList(actor, plan.id);
    assert.equal(csv.split('\r\n').length, 3);
    assert(csv.includes(';6000;1;1;1000;1;;;3794;Evet;default;draft'));
    assert.equal(csv.split('\r\n')[2].split(';')[10], '', 'remainder must not repeat');
    assert(!csv.includes('SECRET') && !csv.includes('Gizli'), 'joined item/job/order must remain tenant isolated');
    await assert.rejects(() => exportCuttingList({ ...actor, tenantId: b.id }, plan.id), /bulunamadı/);
    for (const role of ['worker','member','accountant'] as const) await assert.rejects(() => exportCuttingList({ ...actor, role }, plan.id), /yetkisi/);
    await assert.rejects(() => exportCuttingList(actor, 'invalid'), /bulunamadı/);
    await db`UPDATE inventory_items SET tenant_id=${a.id},profile_code='ÖLÇÜ-1' WHERE id=${item.id}`;
    await db`UPDATE orders SET tenant_id=${a.id} WHERE id=${order.id}`;
    const own = await exportCuttingList(actor, plan.id);
    assert(own.includes('ÖLÇÜ-1;Gizli profil;6000'));
    assert(own.includes(order.order_number));
    assert.deepEqual(await db`SELECT * FROM cutting_plans WHERE tenant_id=${a.id} AND id=${plan.id}`, before);
    console.log('PASS: two-tenant plan/item/job/order isolation, roles, CSV and no plan writes');
  } finally {
    // Explicit IDs cover partial fixture setup failures; never delete another test's data.
    try {
      await db`DELETE FROM cutting_plans WHERE tenant_id IN (${a.id},${b.id}) AND created_by=${user.id}`;
      await db`DELETE FROM work_orders WHERE tenant_id IN (${a.id},${b.id})`;
      await db`DELETE FROM orders WHERE tenant_id IN (${a.id},${b.id})`;
      await db`DELETE FROM inventory_items WHERE tenant_id IN (${a.id},${b.id})`;
      await db`DELETE FROM tenants WHERE id IN (${a.id},${b.id})`;
      await db`DELETE FROM users WHERE id=${user.id}`;
    } finally { await db.end(); }
  }
  process.exit(0);
}
main().catch(error => { console.error(error); process.exit(1); });
