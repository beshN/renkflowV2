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
    await db`INSERT INTO work_centers(tenant_id,code,name,parallel_capacity) VALUES(${actor.tenantId},'TEST','Synthetic kiosk center',2)`;
    await db`UPDATE work_orders SET reservation_status='transferred' WHERE tenant_id=${actor.tenantId}`;
    // A subsequent unassigned stage keeps this test about operation transitions,
    // without creating inventory/shipping fixtures or completing the whole job.
    await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty)
      SELECT tenant_id,work_order_id,1,'Synthetic next stage','TEST',1,'waiting',planned_qty
      FROM production_operations WHERE tenant_id=${actor.tenantId} AND id=${ids[0]}`;
    const jobs = await kioskJobs(actor);
    assert.deepEqual(jobs.map((j: any)=>j.id),[ids[0]]); assert.equal(jobs[0].unit,'m');
    for (const id of [ids[1],ids[2]]) await assert.rejects(kioskCommand(actor,{commandId:randomUUID(),operationId:id,version:1,action:'start'}), /atanmadı/);
    await assert.rejects(kioskCommand(actor,{commandId:randomUUID(),operationId:ids[3],version:1,action:'start'}), /başlatılamaz/);
    for (const role of ['accountant','member'] as const) await assert.rejects(kioskJobs({...actor,role}), /yetkisi/);
    const send = (who: typeof actor | { userId: string; tenantId: string; role: 'owner' }, operationId: string, version: number, action: string, quantity?: number, commandId = randomUUID()) =>
      kioskCommand(who, { commandId, operationId, version, action, ...(quantity === undefined ? {} : { quantity }) });
    const startId = randomUUID();
    const started = await send(actor, ids[0], 1, 'start', undefined, startId);
    assert.equal(started.status, 'running');
    const replayed = await send(actor, ids[0], 1, 'start', undefined, startId);
    assert.deepEqual(replayed, JSON.parse(JSON.stringify(started)));
    assert.equal(Number((await db`SELECT count(*) AS n FROM production_commands WHERE tenant_id=${actor.tenantId} AND command_id=${startId}`)[0].n), 1);
    await assert.rejects(send(actor, ids[0], 1, 'pause'), /başka cihazda değişti/);
    const paused = await send(actor, ids[0], started.version, 'pause');
    assert.equal(paused.status, 'paused'); assert.equal(paused.active_since, null);
    const resumed = await send(actor, ids[0], paused.version, 'start');
    assert.equal(resumed.status, 'running');
    const done = await send(actor, ids[0], resumed.version, 'complete', 2);
    assert.equal(done.status, 'done'); assert.equal(Number(done.completed_qty), 2);
    const [stored] = await db`SELECT status,completed_qty,active_since FROM production_operations WHERE tenant_id=${actor.tenantId} AND id=${ids[0]}`;
    assert.equal(stored.status, 'done'); assert.equal(Number(stored.completed_qty), 2); assert.equal(stored.active_since, null);

    // Synthetic running fixtures isolate completion guards from start prerequisites.
    const [quality] = await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty,assigned_to,quality_checks)
      SELECT tenant_id,work_order_id,2,'Synthetic quality','TEST',1,'running',2,assigned_to,
      '[{"id":"check","name":"Synthetic check","kind":"pass_fail","unit":""}]'::jsonb
      FROM production_operations WHERE tenant_id=${actor.tenantId} AND id=${ids[0]} RETURNING id,version`;
    await assert.rejects(send(actor, quality.id, quality.version, 'complete', 2), /kalite kontrol/);
    assert.equal(Number((await db`SELECT count(*) AS n FROM quality_inspections WHERE tenant_id=${actor.tenantId} AND operation_id=${quality.id}`)[0].n), 0);
    assert.equal((await db`SELECT status FROM production_operations WHERE tenant_id=${actor.tenantId} AND id=${quality.id}`)[0].status, 'running');
    await db`UPDATE production_operations SET status='paused' WHERE tenant_id=${actor.tenantId} AND id=${quality.id}`;
    const [fractional] = await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty,completed_qty,assigned_to)
      SELECT tenant_id,work_order_id,3,'Synthetic fractional','TEST',1,'running',2,0.5,assigned_to
      FROM production_operations WHERE tenant_id=${actor.tenantId} AND id=${ids[0]} RETURNING id,version`;
    await assert.rejects(send(actor, fractional.id, fractional.version, 'complete', 1.5), e => e instanceof Error && e.name === 'ZodError');
    assert.equal(Number((await db`SELECT completed_qty FROM production_operations WHERE tenant_id=${actor.tenantId} AND id=${fractional.id}`)[0].completed_qty), 0.5);
    await db`UPDATE production_operations SET status='paused' WHERE tenant_id=${actor.tenantId} AND id=${fractional.id}`;
    // Even a manager cannot act on another person's assignment through the kiosk.
    await db`UPDATE tenant_members SET role='owner' WHERE tenant_id=${actor.tenantId} AND user_id=${actor.userId}`;
    await assert.rejects(kioskCommand({...actor,role:'owner'},{commandId:randomUUID(),operationId:ids[1],version:1,action:'start'}), /atanmadı/);
    const owner = { ...actor, role: 'owner' as const };
    // The next stage is now ready; explicitly assign it to the owner.
    const [ownOp] = await db`UPDATE production_operations SET assigned_to=${owner.userId} WHERE tenant_id=${owner.tenantId} AND position=1 AND work_order_id=(SELECT work_order_id FROM production_operations WHERE tenant_id=${owner.tenantId} AND id=${ids[0]}) RETURNING id,version`;
    const ownStarted = await send(owner, ownOp.id, ownOp.version, 'start');
    assert.equal(ownStarted.status, 'running');
    await send(owner, ownOp.id, ownStarted.version, 'pause');
    console.log('PASS kiosk: worker start/pause/resume/complete, replay, stale version, owner own assignment, quality rollback, fractional rejection; real DB tenant isolation, assignment, terminal transition, role boundary, unit');
  } finally {
    for (const t of tenants) {
      await db`DELETE FROM quality_inspections WHERE tenant_id=${t}`;
      await db`DELETE FROM production_commands WHERE tenant_id=${t}`;
      await db`DELETE FROM production_events WHERE tenant_id=${t}`;
      await db`DELETE FROM production_operations WHERE tenant_id=${t}`;
      await db`DELETE FROM work_orders WHERE tenant_id=${t}`;
      await db`DELETE FROM orders WHERE tenant_id=${t}`;
      await db`DELETE FROM tenant_members WHERE tenant_id=${t}`;
      await db`DELETE FROM work_centers WHERE tenant_id=${t}`;
      await db`DELETE FROM tenants WHERE id=${t}`;
    }
    for (const u of users) await db`DELETE FROM users WHERE id=${u}`;
    await db.end();
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
