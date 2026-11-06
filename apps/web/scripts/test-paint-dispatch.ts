/** Acceptance fixtures run exclusively against the runner's throwaway local database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = randomUUID();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  const tenants = [randomUUID(), randomUUID()], users = [randomUUID(), randomUUID()];
  const fixtures: Array<{ tenantId: string; userId: string; role: 'owner'; supplierId: string; jobId: string; revisionId: string; itemId: string; partIds: string[] }> = [];
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const migration = readFileSync('lib/db/migrations/084_paint_dispatches.sql', 'utf8');
    await db.unsafe(migration); await db.unsafe(migration);
    const { productionCommand } = await import('../lib/features/manufacturing/platform.service');
    const { paintDispatches, paintDispatchCandidates, paintDispatchDetail } = await import('../lib/features/manufacturing/paint-dispatch.server');
    const { recordPartProgress } = await import('../lib/features/manufacturing/parts.server');
    for (let n = 0; n < 2; n++) {
      const t = tenants[n], u = users[n];
      await db`INSERT INTO tenants(id,name,slug) VALUES(${t},'Paint fixture',${t})`;
      await db`INSERT INTO users(id,email,name) VALUES(${u},${u+'@test.invalid'},'Paint fixture')`;
      await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t},${u},'owner')`;
      const [supplier] = await db`INSERT INTO suppliers(tenant_id,name) VALUES(${t},'Paint fixture') RETURNING id`;
      const [order] = await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount) VALUES(${t},${t},'Fixture',0) RETURNING id`;
      const [revision] = await db`INSERT INTO order_technical_revisions(tenant_id,order_id,revision,family,status,source_name,source_hash,document,created_by) VALUES(${t},${order.id},1,'other','approved','fixture',${t},'{}',${u}) RETURNING id`;
      const [job] = await db`INSERT INTO work_orders(tenant_id,title,order_id,technical_revision_id) VALUES(${t},'Paint fixture',${order.id},${revision.id}) RETURNING id`;
      const [item] = await db`INSERT INTO inventory_items(tenant_id,sku,name,unit) VALUES(${t},'PAINT','Fixture profil','m') RETURNING id`;
      const [warehouse] = await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type) VALUES(${t},'RAW','Fixture','RAW') RETURNING id`;
      const [lot] = await db`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty) VALUES(${t},${item.id},${warehouse.id},'Fixture',10,10) RETURNING id`;
      const [plan] = await db`INSERT INTO cutting_plans(tenant_id,work_order_ids,demand,parameters,result,created_by,idempotency_key) VALUES(${t},${[job.id]}::uuid[],'[]','{}','{}',${u},${t}) RETURNING id`;
      const partIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const [p] = await db`INSERT INTO production_parts(tenant_id,work_order_id,technical_revision_id,cut_plan_id,source_lot_id,item_id,length_mm,target_color,state,sequence,weight_per_meter_kg) VALUES(${t},${job.id},${revision.id},${plan.id},${lot.id},${item.id},1000,${i === 4 ? 'RAL 9005' : 'RAL 7016'},'paint_waiting',${i},${i === 2 ? null : 2}) RETURNING id`;
        partIds.push(p.id);
      }
      fixtures.push({ tenantId: t, userId: u, role: 'owner', supplierId: supplier.id, jobId: job.id, revisionId: revision.id, itemId: item.id, partIds });
    }
    const [a, b] = fixtures, [p0, p1, p2, p3, p4] = a.partIds;
    const cmd = (action: string, data: Record<string, unknown>, commandId = randomUUID(), actor = a) => productionCommand(actor, { action, data, commandId });
    const send = (partIds: string[], supplierId = a.supplierId) => cmd('paint.dispatch.create', { partIds, supplierId });
    await assert.rejects(() => send([p0, p4]), { status: 409 });
    await assert.rejects(() => send([p0, b.partIds[0]]), { status: 404 });
    await assert.rejects(() => send([p0], b.supplierId), { status: 404 });
    await assert.rejects(() => cmd('paint.dispatch.create', { partIds: [p0], supplierId: a.supplierId, expectedReturnDate: '2026-02-30' }));
    // Cancelled jobs must be rejected by both discovery and the command boundary.
    await db`UPDATE work_orders SET status='cancelled' WHERE tenant_id=${a.tenantId} AND id=${a.jobId}`;
    assert.equal((await paintDispatchCandidates(a)).groups.length, 0);
    await assert.rejects(() => send([p0]), { status: 409, message: 'İptal edilmiş üretim emrinin parçası gönderilemez' });
    assert.equal((await db`SELECT state FROM production_parts WHERE tenant_id=${a.tenantId} AND id=${p0}`)[0].state, 'paint_waiting');
    await db`UPDATE work_orders SET status='open' WHERE tenant_id=${a.tenantId} AND id=${a.jobId}`;
    // A waiting part from an older technical revision must not be offered.
    const [olderRevision] = await db`INSERT INTO order_technical_revisions(tenant_id,order_id,revision,family,status,source_name,source_hash,document,created_by)
      SELECT tenant_id,order_id,2,family,'superseded','fixture-old',${randomUUID()},'{}',created_by
      FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND id=${a.revisionId} RETURNING id`;
    await db`UPDATE production_parts SET technical_revision_id=${olderRevision.id} WHERE tenant_id=${a.tenantId} AND id=${p4}`;
    assert.ok(!(await paintDispatchCandidates(a)).groups.flatMap(g => g.parts).some(p => p.id === p4));
    await db`UPDATE production_parts SET technical_revision_id=${a.revisionId} WHERE tenant_id=${a.tenantId} AND id=${p4}`;
    const candidatesBefore = await paintDispatchCandidates(a);
    assert.deepEqual(candidatesBefore.groups.map(g => g.target_color), ['RAL 7016', 'RAL 9005']);
    const candidateParts = candidatesBefore.groups.flatMap(g => g.parts);
    assert.equal(candidateParts.length, 5);
    assert.ok(candidateParts.every(p => a.partIds.includes(p.id)));
    assert.equal(candidateParts.find(p => p.id === p2)!.weight_kg, null);
    assert.equal(Number(candidateParts.find(p => p.id === p0)!.weight_kg), 2);
    assert.ok(candidateParts.every(p => p.work_order_id === a.jobId && p.profile_name && p.order_number));
    assert.deepEqual(candidatesBefore.suppliers.map(s => s.id), [a.supplierId]);
    assert.ok((await paintDispatchCandidates(b)).groups.flatMap(g => g.parts).every(p => b.partIds.includes(p.id)));
    const data = { partIds: [p0, p1, p2], supplierId: a.supplierId, expectedReturnDate: '2000-01-01', note: 'Fixture' }, key = randomUUID();
    const created = await cmd('paint.dispatch.create', data, key);
    const candidatesAfter = (await paintDispatchCandidates(a)).groups.flatMap(g => g.parts);
    assert.deepEqual(new Set(candidatesAfter.map(p => p.id)), new Set([p3, p4]));
    const detailBefore = await paintDispatchDetail(a, created.id);
    assert.equal(detailBefore.supplier_name, 'Paint fixture');
    assert.equal(detailBefore.parts.length, 3);
    assert.ok(detailBefore.parts.every(p => p.outcome === 'sent' && p.returned_at === null && p.reject_reason === null));
    assert.equal(detailBefore.parts.find(p => p.id === p2)!.weight_kg, null);
    await assert.rejects(() => paintDispatchDetail(b, created.id), { status: 404 });
    await assert.rejects(() => paintDispatchDetail(a, randomUUID()), { status: 404 });
    assert.deepEqual(await cmd('paint.dispatch.create', data, key), created);
    await assert.rejects(() => cmd('paint.dispatch.create', { ...data, note: 'changed' }, key), { status: 409 });
    await assert.rejects(() => send([p0]), { status: 409 });
    assert.equal((await db`SELECT state FROM production_parts WHERE tenant_id=${a.tenantId} AND id=${p0}`)[0].state, 'paint_sent');
    const oldProgress = { workOrderId: a.jobId, technicalRevisionId: a.revisionId, itemId: a.itemId, lengthMm: 1000, targetColor: 'RAL 7016', quantity: 1 };
    await assert.rejects(() => recordPartProgress(a, { ...oldProgress, action: 'paint.return', commandId: randomUUID() }), { status: 409 });
    let list = await paintDispatches(a);
    assert.equal(list.length, 1); assert.equal(list[0].sent_count, 3); assert.equal(list[0].pending_count, 3);
    assert.equal(list[0].weight_kg, null); assert.equal(list[0].overdue, true);
    assert.equal((await paintDispatches(b)).length, 0);
    await assert.rejects(() => cmd('paint.dispatch.return', { dispatchId: created.id, parts: [{ partId: p0, outcome: 'returned' }] }, randomUUID(), b), { status: 404 });
    await assert.rejects(() => cmd('paint.dispatch.return', { dispatchId: created.id, parts: [{ partId: p1, outcome: 'rejected', rejectReason: ' ' }] }));
    // Invalid second part rolls the entire command back.
    await assert.rejects(() => cmd('paint.dispatch.return', { dispatchId: created.id, parts: [{ partId: p0, outcome: 'returned' }, { partId: p3, outcome: 'returned' }] }), { status: 409 });
    assert.equal((await paintDispatches(a))[0].pending_count, 3);
    const retKey = randomUUID(), retData = { dispatchId: created.id, parts: [{ partId: p0, outcome: 'returned' }] };
    const partial = await cmd('paint.dispatch.return', retData, retKey);
    assert.equal(partial.status, 'partially_returned');
    assert.deepEqual(await cmd('paint.dispatch.return', retData, retKey), partial);
    await cmd('paint.dispatch.return', { dispatchId: created.id, parts: [{ partId: p1, outcome: 'rejected', rejectReason: 'Renk hatalı' }] });
    const [rejected] = await db`SELECT p.state,p.paint_returned_at,d.reject_reason FROM production_parts p JOIN paint_dispatch_parts d ON d.tenant_id=p.tenant_id AND d.part_id=p.id WHERE p.tenant_id=${a.tenantId} AND p.id=${p1}`;
    assert.equal(rejected.state, 'paint_waiting'); assert.equal(rejected.paint_returned_at, null); assert.equal(rejected.reject_reason, 'Renk hatalı');
    const returnedDetail = await paintDispatchDetail(a, created.id);
    assert.equal(returnedDetail.parts.find(p => p.id === p0)!.outcome, 'returned');
    assert.ok(returnedDetail.parts.find(p => p.id === p0)!.returned_at);
    assert.equal(returnedDetail.parts.find(p => p.id === p1)!.reject_reason, 'Renk hatalı');
    assert.ok((await paintDispatchCandidates(a)).groups.flatMap(g => g.parts).some(p => p.id === p1));
    const resent = await send([p1]); assert.equal(resent.dispatchNumber, '2');
    const resentRow = (await paintDispatches(a)).find((d: any) => d.id === resent.id)!;
    assert.equal(Number(resentRow.weight_kg), 2); assert.equal(resentRow.expected_return_date, null); assert.equal(resentRow.overdue, false);
    await db`UPDATE order_technical_revisions SET status='blocked' WHERE tenant_id=${a.tenantId} AND id=${a.revisionId}`;
    assert.equal((await paintDispatchCandidates(a)).groups.length, 0);
    await assert.rejects(() => send([p3]), { status: 409 });
    // Physical returns remain possible even when the work order is cancelled.
    await db`UPDATE work_orders SET status='cancelled' WHERE tenant_id=${a.tenantId} AND id=${a.jobId}`;
    assert.equal((await cmd('paint.dispatch.return', { dispatchId: created.id, parts: [{ partId: p2, outcome: 'returned' }] })).status, 'closed');
    assert.equal((await cmd('paint.dispatch.return', { dispatchId: resent.id, parts: [{ partId: p1, outcome: 'returned' }] })).status, 'closed');
    assert.equal((await db`SELECT state FROM production_parts WHERE tenant_id=${a.tenantId} AND id=${p2}`)[0].state, 'paint_returned');
    assert.equal((await db`SELECT status FROM work_orders WHERE tenant_id=${a.tenantId} AND id=${a.jobId}`)[0].status, 'cancelled');
    await db`UPDATE work_orders SET status='open' WHERE tenant_id=${a.tenantId} AND id=${a.jobId}`;
    assert.equal((await paintDispatches(a)).length, 0);
    list = await paintDispatches(a, 'closed');
    const closed = list.find((d: any) => d.id === created.id)!;
    assert.equal(closed.returned_count, 2); assert.equal(closed.rejected_count, 1); assert.equal(closed.pending_count, 0); assert.equal(closed.overdue, false);
    assert.deepEqual(await cmd('paint.dispatch.return', retData, retKey), partial); // replay survives closure
    await db`UPDATE order_technical_revisions SET status='approved' WHERE tenant_id=${a.tenantId} AND id=${a.revisionId}`;
    // Legacy untracked parts retain paint.send / paint.return semantics.
    await recordPartProgress(a, { ...oldProgress, action: 'paint.send', commandId: randomUUID() });
    await recordPartProgress(a, { ...oldProgress, action: 'paint.return', commandId: randomUUID() });
    assert.equal((await db`SELECT state FROM production_parts WHERE tenant_id=${a.tenantId} AND id=${p3}`)[0].state, 'paint_returned');
    const sameKeyOtherTenant = await cmd('paint.dispatch.create', { partIds: [b.partIds[0]], supplierId: b.supplierId }, key, b);
    assert.equal(sameKeyOtherTenant.dispatchNumber, '1');
    // Database boundaries cannot be bypassed with foreign identifiers.
    await assert.rejects(() => db`INSERT INTO paint_dispatches(tenant_id,dispatch_number,supplier_id,target_color,created_by) VALUES(${a.tenantId},99,${b.supplierId},'RAL 7016',${a.userId})`, { code: '23503' });
    await assert.rejects(() => db`INSERT INTO paint_dispatch_parts(tenant_id,dispatch_id,part_id) VALUES(${a.tenantId},${created.id},${b.partIds[1]})`, { code: '23503' });
    // Resolved history permits re-dispatch, but a second pending membership is unique.
    const secondOther = await cmd('paint.dispatch.create', { partIds: [b.partIds[1]], supplierId: b.supplierId }, randomUUID(), b);
    await assert.rejects(() => db`INSERT INTO paint_dispatch_parts(tenant_id,dispatch_id,part_id) VALUES(${b.tenantId},${secondOther.id},${b.partIds[0]})`, { code: '23505' });
    // Competing creates are serialized; only one document can claim a waiting part.
    const races = await Promise.allSettled([send([p4]), send([p4])]);
    assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(races.filter(r => r.status === 'rejected').length, 1);
    await db`UPDATE tenant_members SET role='office',access_role='sales' WHERE tenant_id=${a.tenantId} AND user_id=${a.userId}`;
    assert.ok((await paintDispatches(a)).length);
    await assert.rejects(() => cmd('paint.dispatch.create', data, key), { status: 403 });
    await db`UPDATE tenant_members SET role='worker' WHERE tenant_id=${a.tenantId} AND user_id=${a.userId}`;
    await assert.rejects(() => paintDispatches(a), { status: 403 });
    await assert.rejects(() => paintDispatchCandidates(a), { status: 403 });
    await assert.rejects(() => paintDispatchDetail(a, created.id), { status: 403 });
    await assert.rejects(() => cmd('paint.dispatch.create', data, key), { status: 403 });
    console.log('Paint dispatch acceptance passed: lifecycle, rework, tenant isolation, replay, kg, legacy rules, migration twice.');
  } finally {
    try {
      for (const table of ['paint_dispatch_parts','paint_dispatches','production_events','production_commands','production_parts','cutting_plans','work_orders','order_technical_revisions','orders','stock_lots','warehouse_locations','warehouses','inventory_items','suppliers','tenant_members']) {
        await db`DELETE FROM ${db(table)} WHERE tenant_id=ANY(${tenants}::uuid[])`;
      }
      await db`DELETE FROM tenants WHERE id=ANY(${tenants}::uuid[])`;
      await db`DELETE FROM users WHERE id=ANY(${users}::uuid[])`;
    } finally {
      await db.end(); const { getSql } = await import('../lib/db'); await getSql().end();
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
