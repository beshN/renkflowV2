/** Synthetic fixtures, exclusively on the local renkflow_test database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'synthetic-kiosk-test-only-123456789012345';
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL);
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { kioskJobs, kioskCommand } = await import('../lib/features/kiosk/service.server');
  const tenants: string[] = [], users: string[] = [];
  try {
    for (let i=0;i<2;i++) {
      tenants.push((await db`INSERT INTO tenants(name,slug) VALUES('Synthetic kiosk',${randomUUID()}) RETURNING id`)[0].id);
      users.push((await db`INSERT INTO users(name,email,password) VALUES('Synthetic worker',${randomUUID()+'@example.invalid'},'unusable-test-password') RETURNING id`)[0].id);
      await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenants[i]},${users[i]},'worker')`;
    }
    const actor = { userId: users[0], tenantId: tenants[0], role: 'worker' as const };
    const ids: string[] = [];
    for (const [tenant, user, status, unit] of [[tenants[0],users[0],'ready','m'],[tenants[0],users[1],'ready','kg'],[tenants[1],users[0],'ready','adet'],[tenants[0],users[0],'done','adet']] as const) {
      const [order] = await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount,status) VALUES(${tenant},${randomUUID()},'Synthetic',0,'in_production') RETURNING id`;
      const [job] = await db`INSERT INTO work_orders(tenant_id,title,category,order_id,created_by,status,production_uom) VALUES(${tenant},'Synthetic kiosk','production',${order.id},${users[0]},'open',${unit}) RETURNING id`;
      const [op] = await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty,assigned_to) VALUES(${tenant},${job.id},0,'Synthetic operation','TEST',1,${status},2,${user}) RETURNING id`;
      ids.push(op.id);
    }
    const jobs = await kioskJobs(actor);
    assert.deepEqual(jobs.map((j: any)=>j.id),[ids[0]]); assert.equal(jobs[0].unit,'m');
    for (const id of [ids[1],ids[2]]) await assert.rejects(kioskCommand(actor,{commandId:randomUUID(),operationId:id,version:1,action:'start'}), /atanmadı/);
    await assert.rejects(kioskCommand(actor,{commandId:randomUUID(),operationId:ids[3],version:1,action:'start'}), /başlatılamaz/);
    for (const role of ['accountant','member'] as const) await assert.rejects(kioskJobs({...actor,role}), /yetkisi/);
    // Even a manager cannot act on another person's assignment through the kiosk.
    await db`UPDATE tenant_members SET role='owner' WHERE tenant_id=${actor.tenantId} AND user_id=${actor.userId}`;
    await assert.rejects(kioskCommand({...actor,role:'owner'},{commandId:randomUUID(),operationId:ids[1],version:1,action:'start'}), /atanmadı/);
    console.log('PASS kiosk: real DB tenant isolation, assignment, terminal transition, role boundary, unit');
  } finally {
    for (const t of tenants) {
      await db`DELETE FROM production_events WHERE tenant_id=${t}`;
      await db`DELETE FROM production_operations WHERE tenant_id=${t}`;
      await db`DELETE FROM work_orders WHERE tenant_id=${t}`;
      await db`DELETE FROM orders WHERE tenant_id=${t}`;
      await db`DELETE FROM tenant_members WHERE tenant_id=${t}`;
      await db`DELETE FROM tenants WHERE id=${t}`;
    }
    for (const u of users) await db`DELETE FROM users WHERE id=${u}`;
    await db.end();
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
