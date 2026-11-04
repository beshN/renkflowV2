/** Synthetic fixtures; real PostgreSQL, localhost renkflow_test only. Auto-discovered by CI integration runner. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.AUTH_SECRET = 'synthetic-production-history-test-only';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { productionHistory } = await import('../lib/features/manufacturing/production-history.server');
  const { sql } = await import('../lib/db');
  const tenants = [randomUUID(), randomUUID()], user = randomUUID();
  const jobs: string[] = [], plans: string[] = [], lots: string[] = [];
  const context = (tenantId: string, role = 'owner') => ({ tenantId, userId: user, role, email: 'fixture@test.local', name: 'Synthetic' }) as any;
  try {
    await db`INSERT INTO users(id,email,name) VALUES(${user},${user+'@test.local'},'Synthetic')`;
    for (const [index, tenant] of tenants.entries()) {
      await db`INSERT INTO tenants(id,name,slug) VALUES(${tenant},'Synthetic',${'history-'+tenant})`;
      await db`INSERT INTO work_centers(tenant_id,code,name) VALUES(${tenant},'CUT',${'Tenant '+index})`;
      for (let i = 0; i < 4; i++) {
        const id = randomUUID(); jobs.push(id);
        const completed = i === 3 ? '2026-01-02T21:00:00Z' : '2026-01-01T22:00:00Z';
        const due = i === 2 ? null : i === 1 ? '2026-01-01T21:59:00Z' : completed;
        await db`INSERT INTO work_orders(id,tenant_id,title,category,status,completed_at,due_at) VALUES(${id},${tenant},'Synthetic','production','done',${completed},${due})`;
        await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty,completed_qty,active_seconds,started_at,completed_at)
          VALUES(${tenant},${id},1,'Synthetic','CUT',1,'done',1,1,${index ? 9000 : [10,30,0,999][i]},${i === 2 ? null : '2026-01-01T21:00:00Z'},${completed})`;
      }
      const warehouse = randomUUID(), item = randomUUID(), lot = randomUUID(), plan = randomUUID();
      plans.push(plan); lots.push(lot);
      await db`INSERT INTO warehouses(id,tenant_id,code,name,warehouse_type) VALUES(${warehouse},${tenant},'SYNTHETIC','Synthetic','RAW')`;
      await db`INSERT INTO inventory_items(id,tenant_id,sku,name) VALUES(${item},${tenant},'SYNTHETIC','Synthetic profile')`;
      await db`INSERT INTO stock_lots(id,tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty) VALUES(${lot},${tenant},${item},${warehouse},'SYNTHETIC',1,0)`;
      await db`INSERT INTO cutting_plans(id,tenant_id,status,work_order_ids,demand,parameters,result,created_by,idempotency_key,completed_at)
        VALUES(${plan},${tenant},'completed','{}','{}','{}','{}',${user},'synthetic','2026-01-01T22:00:00Z')`;
      await db`INSERT INTO cutting_losses(tenant_id,plan_id,lot_id,length_mm,weight_kg,cost) VALUES(${tenant},${plan},${lot},${index ? 999 : 12},99999,99999)`;
    }
    // Invalid cross-tenant references must not pass tenant-qualified joins.
    await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty,active_seconds,started_at,completed_at)
      VALUES(${tenants[0]},${jobs[4]},2,'Cross tenant','CUT',1,'done',1,99999,'2026-01-01T21:00:00Z','2026-01-01T22:00:00Z')`;
    await db`INSERT INTO cutting_losses(tenant_id,plan_id,lot_id,length_mm,weight_kg,cost) VALUES(${tenants[0]},${plans[1]},${lots[1]},99999,99999,99999)`;
    const a = await productionHistory(context(tenants[0]), '2026-01-02', '2026-01-02');
    assert.deepEqual(a.centers, [{ code: 'CUT', name: 'Tenant 0', completed: 3, active: { n: 2, median: 20 } }]);
    assert.deepEqual(a.deadlines, { n: 2, onTime: 1, late: 1 });
    assert.equal(a.completedJobs, 3);
    assert.deepEqual(a.calculatedLosses, [{ unit: 'mm', n: 1, total: 12 }]);
    assert.equal(a.measuredLossSamples, 0);
    const b = await productionHistory(context(tenants[1]), '2026-01-02', '2026-01-02');
    assert.equal(b.centers[0].active.median, 9000); assert.equal(b.centers[0].completed, 3);
    assert.deepEqual(b.calculatedLosses, [{ unit: 'mm', n: 1, total: 999 }]);
    const empty = await productionHistory(context(tenants[0]), '2025-01-01', '2025-01-01');
    assert.deepEqual(empty.centers, []); assert.equal(empty.deadlines.n, 0); assert.deepEqual(empty.calculatedLosses, []);
    await assert.rejects(productionHistory(context(tenants[0], 'worker'), '2026-01-02', '2026-01-02'), /yetkiniz/);
    await assert.rejects(productionHistory({ ...context(tenants[0]), narrowed: { permissions: { reports: [] }, hidden: [] } }, '2026-01-02', '2026-01-02'), /yetkiniz/);
    assert.equal((await productionHistory(context(tenants[0], 'accountant'), '2026-01-02', '2026-01-02')).deadlines.n, 2);
    console.log('PASS: two-tenant isolation, cross-tenant joins, date boundary, measured samples, native mm, roles and narrowing');
  } finally {
    for (const table of ['cutting_losses','cutting_plans','stock_lots','inventory_items','warehouse_locations','warehouses','production_operations','work_orders','work_centers']) {
      await db.unsafe(`DELETE FROM ${table} WHERE tenant_id=ANY($1::uuid[])`, [tenants]);
    }
    await db`DELETE FROM tenants WHERE id=ANY(${tenants}::uuid[])`;
    await db`DELETE FROM users WHERE id=${user}`;
    await db.end(); await sql.end();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
