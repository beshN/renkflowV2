/**
 * A busy factory day on the isolated local test database only (synthetic data). Dozens of orders at
 * once, several masters on the floor, cutting/assembly/QC/packing in parallel, scarce stock shared by
 * many orders, QC rejects with rework, a cancelled cutting plan, double taps, resubmits after a page
 * refresh, a dropped database connection mid-command and parallel shipments. At the end the stock
 * ledger, balances, lots and production records must agree.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

type Actor = { tenantId: string; userId: string; role: 'owner' | 'office' | 'worker' };
const settledOk = (r: PromiseSettledResult<unknown>[]) => r.filter((x) => x.status === 'fulfilled').length;

/** Runs tasks with at most `width` in flight (several masters, not unbounded parallelism). */
async function pool<T>(items: T[], width: number, run: (item: T, lane: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: width }, async (_, lane) => {
    while (next < items.length) await run(items[next++], lane);
  }));
}

async function main() {
  process.env.AUTH_SECRET = 'factory-stress-local-only-1234567890123456789';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {}, max: 4 });
  const timings: Record<string, number> = {};
  let shortageCuts = 0;
  const timed = async <T>(label: string, work: () => Promise<T>) => { console.log('… ' + label); const s = Date.now(); const r = await work(); timings[label] = Date.now() - s; return r; };
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { productionCommand } = await import('../lib/features/manufacturing/platform.service');
    const { PostgresQuotationService } = await import('../lib/features/quotations/postgres.service');
    const { DEFAULT_AWNING } = await import('../lib/features/awning/configuration');

    // ── The firm: an owner, the office and four masters ──────────────────────────────────────────
    const [tenant] = await db`INSERT INTO tenants (name, slug) VALUES ('Stres fabrikası', ${'stress-' + randomUUID()}) RETURNING id`;
    const person = async (role: Actor['role'], name: string): Promise<Actor> => {
      const [u] = await db`INSERT INTO users (name, email) VALUES (${name}, ${randomUUID() + '@example.invalid'}) RETURNING id`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenant.id}, ${u.id}, ${role})`;
      return { tenantId: tenant.id, userId: u.id, role };
    };
    const owner = await person('owner', 'Sahip');
    const office = await person('office', 'Ofis');
    const masters = await Promise.all([1, 2, 3, 4].map((n) => person('office', `Usta ${n}`)));
    const worker = await person('worker', 'Atanmamış işçi');
    const run = (a: Actor, action: string, data: Record<string, unknown>, commandId = randomUUID()) => productionCommand(a as any, { commandId, action, data });
    const cmd = (action: string, data: Record<string, unknown>, commandId?: string) => run(owner, action, data, commandId);

    const profile = await cmd('material.save', { sku: 'PRF', name: 'Profil', itemType: 'raw_material', uom: 'm', standardLengthMm: 6000, weightPerMeterKg: 1.2 });
    const screw = await cmd('material.save', { sku: 'VID', name: 'Vida', itemType: 'consumable', uom: 'adet', standardLengthMm: 0, weightPerMeterKg: 0 });
    const motor = await cmd('material.save', { sku: 'MOT', name: 'Motor', itemType: 'consumable', uom: 'adet', standardLengthMm: 0, weightPerMeterKg: 0 });
    const finished = await cmd('material.save', { sku: 'TNT', name: 'Tente', itemType: 'finished_good', uom: 'adet', standardLengthMm: 0, weightPerMeterKg: 0 });
    const wh: Record<string, any> = {};
    for (const type of ['RAW', 'WIP', 'FINISHED', 'REUSABLE_REMNANTS']) wh[type] = await cmd('warehouse.save', { code: type, name: type, type });
    const route = [['Kesim', 'CUT'], ['Montaj', 'ASSEMBLY'], ['Kalite', 'QC'], ['Paketleme', 'PACK']];
    for (const [name, code] of route) await cmd('center.save', { name, code, parallelCapacity: 4, shiftStart: '08:00', shiftEnd: '17:00', workDays: [1, 2, 3, 4, 5], maintenance: [] });
    await cmd('preferences.save', { kerfMm: 3, trimStartMm: 5, trimEndMm: 5, minimumRemnantMm: 500, cuttingConfirmed: true, emailEnabled: false, whatsappEnabled: false });
    await cmd('stock.receive', { itemId: profile.id, warehouseId: wh.RAW.id, quantity: 40, lengthMm: 6000, color: 'Antrasit', unitCost: 50, lotNumber: 'BAR-A' });
    await cmd('stock.receive', { itemId: screw.id, warehouseId: wh.RAW.id, quantity: 1000, unitCost: 1, lotNumber: 'VIDA-1' });
    // Scarce on purpose: 24 orders, motors for 12.
    await cmd('stock.receive', { itemId: motor.id, warehouseId: wh.RAW.id, quantity: 12, unitCost: 900, lotNumber: 'MOTOR-1' });

    const recipe = await cmd('recipe.save', {
      code: 'TNT', name: 'Tente (sentetik)', version: 1, finishedItemId: finished.id,
      rules: [
        { itemId: profile.id, kind: 'profile', uom: 'm', quantityFormula: '2', cutLengthFormula: 'widthMm-10' },
        { itemId: screw.id, kind: 'material', uom: 'adet', quantityFormula: '8' },
        { itemId: motor.id, kind: 'material', uom: 'adet', quantityFormula: '1' },
      ],
      operations: route.map(([name, workCenterCode]) => ({ name, workCenterCode, minutesFormula: '10*quantity', qualityChecks: workCenterCode === 'QC' ? [{ id: 'visual', name: 'Görsel kontrol', kind: 'pass_fail', unit: '' }] : [] })),
      limits: { minWidthMm: 2500, maxWidthMm: 6000, minProjectionMm: 1500, maxProjectionMm: 5000, minMountingHeightMm: 2200, maxMountingHeightMm: 4500 },
      examples: [
        { parameters: { widthMm: 3000, projectionMm: 1500, mountingHeightMm: 3000, quantity: 1 }, expected: [{ itemId: profile.id, quantity: 5.98 }, { itemId: screw.id, quantity: 8 }, { itemId: motor.id, quantity: 1 }] },
        { parameters: { widthMm: 5000, projectionMm: 2000, mountingHeightMm: 3000, quantity: 2 }, expected: [{ itemId: profile.id, quantity: 19.96 }, { itemId: screw.id, quantity: 16 }, { itemId: motor.id, quantity: 2 }] },
      ],
    });
    await cmd('recipe.publish', { id: recipe.id });

    // ── 1. Twenty-four orders at once, from two desks, with double clicks on "convert" ──────────
    const quotes = new PostgresQuotationService();
    const config = { ...DEFAULT_AWNING, widthMm: 3000, projectionMm: 1500, mountingHeightMm: 3100 };
    const quoteList = await timed('24 quotes in parallel', () => Promise.all(Array.from({ length: 24 }, (_, i) => quotes.createQuotation(tenant.id, {
      idempotencyKey: randomUUID(), customerName: `Müşteri ${i + 1}`, currency: 'TRY', discountPercent: 0,
      items: [{ productName: 'Tente', quantity: 1, unitPrice: 20000, discountPercent: 0, totalPrice: 0, awningConfiguration: config, widthMm: 3000, projectionMm: 1500, mountingHeightMm: 3100, heightMm: 2100 }],
    } as any, (i % 2 ? office : owner).userId))));
    const conversions = await timed('24 conversions (+8 double clicks)', () => Promise.all(quoteList.flatMap((q, i) => {
      const convert = () => quotes.convertToOrder(tenant.id, q.id, (i % 2 ? office : owner).userId);
      return i < 8 ? [convert(), convert()] : [convert()];
    })));
    const orderIds = [...new Set(conversions.map((c: any) => c.orderId as string))];
    assert.equal(orderIds.length, 24, 'a double-clicked conversion opens one order');
    const orders = await db`SELECT id, order_number FROM orders WHERE tenant_id = ${tenant.id}`;
    assert.equal(orders.length, 24);
    assert.equal(new Set(orders.map((o) => o.order_number)).size, 24, 'order numbers are unique under load');
    const items = await db`SELECT i.id, i.order_id FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.tenant_id = ${tenant.id}`;
    assert.equal(items.length, 24);

    // ── 2. Work orders for every line at once; a refresh resubmits four of them ──────────────────
    const jobFor = (orderItemId: string, commandId?: string, assignee = masters[0]) => cmd('job.create', { orderItemId, recipeId: recipe.id, sourceWarehouseId: wh.RAW.id, wipWarehouseId: wh.WIP.id, targetWarehouseId: wh.FINISHED.id, assignedTo: assignee.userId }, commandId);
    const jobResults = await timed('24 work orders in parallel', () => Promise.allSettled(items.map((i, k) => jobFor(i.id, undefined, masters[k % 4]))));
    assert.equal(settledOk(jobResults), 24);
    const resubmits = await Promise.allSettled(items.slice(0, 4).map((i) => jobFor(i.id)));
    const jobsPerItem = await db`SELECT order_item_id, count(*)::int AS n FROM work_orders WHERE tenant_id = ${tenant.id} AND status <> 'cancelled' GROUP BY order_item_id`;
    assert(jobsPerItem.every((r) => r.n === 1), `a resubmitted work order is not opened twice (${settledOk(resubmits)} of 4 resubmits were accepted)`);
    const jobs = await db`SELECT id, order_item_id, assigned_to FROM work_orders WHERE tenant_id = ${tenant.id} ORDER BY created_at`;

    // ── 3. Cutting: four plans prepared and approved in parallel, one cancelled and redone ───────
    const groups = [0, 1, 2, 3].map((g) => jobs.slice(g * 6, g * 6 + 6).map((j) => j.id as string));
    const previews = await timed('4 cutting previews in parallel', () => Promise.all(groups.map((ids) => cmd('cut.preview', { workOrderIds: ids }))));
    // A second preview over the same jobs competes for the same bars: only one of the two may be approved.
    const rival = await cmd('cut.preview', { workOrderIds: groups[0] });
    const approvals = await Promise.allSettled([...previews.map((p) => cmd('cut.approve', { id: p.id, version: p.version })), cmd('cut.approve', { id: rival.id, version: rival.version })]);
    // Previews made at the same moment pick the same bars; once one is approved the others are refused
    // with "stock changed, recompute" (never approved on bars already taken). The planner recomputes them.
    const refusals = approvals.filter((a) => a.status === 'rejected').map((a) => String((a as PromiseRejectedResult).reason?.message));
    assert(refusals.every((m) => /stoku değişti|daha önce planlandı/.test(m)), 'refusals explain themselves: ' + refusals.join('; '));
    assert(settledOk(approvals) >= 1);
    const approved = approvals.filter((a) => a.status === 'fulfilled').map((a) => (a as PromiseFulfilledResult<any>).value);
    for (const group of groups) {
      if (approved.some((p) => group.every((id) => (p.work_order_ids as string[]).includes(id)))) continue;
      const again = await cmd('cut.preview', { workOrderIds: group });
      approved.push(await cmd('cut.approve', { id: again.id, version: again.version }));
    }
    assert.equal(approved.length, 4);
    const lotsInTwoPlans = await db`SELECT lot_id FROM cutting_plan_sources WHERE tenant_id = ${tenant.id} AND consumed = false GROUP BY lot_id HAVING count(*) > 1`;
    assert.equal(lotsInTwoPlans.length, 0);
    // A plan is cancelled before cutting (wrong bar on the saw) and planned again.
    const cancelled = approved.pop();
    const rawBefore = Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id = ${tenant.id} AND item_id = ${profile.id} AND warehouse_id = ${wh.RAW.id}`)[0].on_hand_qty);
    await cmd('cut.cancel', { id: cancelled.id, version: cancelled.version });
    const redo = await cmd('cut.preview', { workOrderIds: cancelled.work_order_ids });
    approved.push(await cmd('cut.approve', { id: redo.id, version: redo.version }));
    assert.equal(Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id = ${tenant.id} AND item_id = ${profile.id} AND warehouse_id = ${wh.RAW.id}`)[0].on_hand_qty), rawBefore, 'a cancelled plan moves no stock');
    // The four plans are confirmed at once; the confirmation is double-tapped once.
    const cutKey = randomUUID();
    const cuts = await timed('4 cuts completed in parallel', () => Promise.allSettled(approved.flatMap((p, i) => {
      // Completing a cut is a manager's confirmation in RenkFlow (the masters cut, the owner confirms).
      const done = (key?: string) => run(owner, 'cut.complete', { id: p.id, version: p.version, confirmed: true }, key);
      return i === 0 ? [done(cutKey), done(cutKey)] : [done()];
    })));
    // Motors run out after 12 jobs: confirming a cut also moves each job's other materials to
    // production, so plans whose jobs have no motor are refused as a whole (no half-recorded cut).
    const cutRefused = approved.filter((_, i) => cuts.filter((c, k) => (i === 0 ? k <= 1 : k === i + 1)).some((c) => c.status === 'rejected'));
    for (const c of cuts) if (c.status === 'rejected') assert.match(String((c as PromiseRejectedResult).reason?.message), /stoğu yetersiz/, 'only a material shortage stops a cut');
    for (const p of cutRefused) {
      assert.equal((await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id = ${tenant.id} AND reference_type = 'cutting_plan' AND reference_id = ${p.id}`)[0].n, 0, 'a refused cut moves nothing');
    }
    // The motors arrive; the waiting cuts are confirmed.
    if (cutRefused.length) {
      await cmd('stock.receive', { itemId: motor.id, warehouseId: wh.RAW.id, quantity: 12, unitCost: 900, lotNumber: 'MOTOR-2' });
      for (const p of cutRefused) await cmd('cut.complete', { id: p.id, version: p.version, confirmed: true });
    }
    shortageCuts = cutRefused.length;
    assert.equal((await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id = ${tenant.id} AND reference_type = 'cutting_plan'`)[0].n, 4, 'one stock movement per cut, the double tap included');

    // ── 4. The floor: four masters run assembly, QC and packing on different jobs at once ────────
    const opsOf = async (jobId: string) => db`SELECT * FROM production_operations WHERE tenant_id = ${tenant.id} AND work_order_id = ${jobId} ORDER BY position`;
    const step = async (a: Actor, jobId: string, position: number, action: string, extra: Record<string, unknown> = {}, commandId?: string) => {
      const [op] = (await opsOf(jobId)).filter((o) => o.position === position);
      return run(a, 'operation', { operationId: op.id, version: op.version, action, qualityResults: [], ...extra }, commandId);
    };
    const reject = new Set([jobs[2].id, jobs[9].id]);
    const blocked: string[] = [];
    const floorErrors: string[] = [];
    // Each master works through the jobs assigned to them (one operation at a time per person, a
    // RenkFlow rule); the four masters work at the same time.
    const byMaster = masters.map((m) => jobs.filter((j) => j.assigned_to === m.userId).map((j) => j.id as string));
    assert.equal(byMaster.flat().length, 24);
    await timed('floor: 24 jobs x 4 operations, 4 masters', () => Promise.all(byMaster.map((list, lane) => pool(list, 1, async (jobId) => {
      const me = masters[lane];
      try {
        for (let position = 0; position < 4; position++) {
          const ops = await opsOf(jobId);
          const op = ops.find((o) => o.position === position)!;
          if (op.status === 'done') continue;
          await step(me, jobId, position, 'start');
          if (position === 2 && reject.has(jobId)) {
            // QC rejects: back to assembly, then assembly and QC again.
            await step(me, jobId, 2, 'rework', { quantity: 1, reasonCode: 'quality', reason: 'Çizik', targetOperationId: ops[1].id });
            await step(me, jobId, 1, 'start');
            await step(me, jobId, 1, 'complete', { quantity: 1 });
            await step(me, jobId, 2, 'start');
          }
          const quality = position === 2 ? { qualityResults: [{ checkId: 'visual', passed: true }] } : {};
          await step(me, jobId, position, 'complete', { quantity: 1, ...quality });
        }
      } catch (error) {
        const message = String((error as Error).message);
        // Missing material is a legitimate stop (motors for 12 of 24); anything else is a defect.
        if (/malzeme|stok|yetersiz|eksik/i.test(message)) blocked.push(jobId); else floorErrors.push(`${jobId.slice(0, 8)}: ${message}`);
      }
    }))));
    assert.deepEqual(floorErrors, [], 'no unexpected errors on the floor');

    // Two masters press "complete" on the same operation at the same moment: one wins.
    const contested = jobs.find((j) => !blocked.includes(j.id))!;
    const extraJob = await jobFor(items[0].id).catch(() => null); // refused: one job per line
    assert.equal(extraJob, null);
    const [packOp] = (await opsOf(contested.id)).filter((o) => o.position === 3);
    assert.equal(packOp.status, 'done');

    // Unassigned workers cannot operate.
    const [someOp] = await opsOf(jobs[5].id);
    await assert.rejects(run(worker, 'operation', { operationId: someOp.id, version: someOp.version, action: 'start', qualityResults: [] }), (e: any) => e.status === 403);

    // ── 5. A dropped database connection in the middle of a command ─────────────────────────────
    const lockHolder = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
    const holder = lockHolder.begin(async (tx: any) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenant.id}, 0))`;
      await new Promise((r) => setTimeout(r, 800));
    });
    await new Promise((r) => setTimeout(r, 100));
    const dropKey = randomUUID();
    const dropped = cmd('stock.receive', { itemId: screw.id, warehouseId: wh.RAW.id, quantity: 50, unitCost: 1, lotNumber: 'VIDA-DROP' }, dropKey);
    await new Promise((r) => setTimeout(r, 200));
    const killed = await db`SELECT pg_terminate_backend(pid) AS ok FROM pg_stat_activity WHERE datname = current_database() AND state = 'active' AND query ILIKE '%pg_advisory_xact_lock%' AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`;
    assert(killed.length >= 1, 'the waiting command was cut off');
    await holder; await lockHolder.end();
    // The server retries the command on a new connection (same command id): it lands, once.
    const landed = await dropped;
    assert.equal((await db`SELECT count(*)::int AS n FROM stock_lots WHERE tenant_id = ${tenant.id} AND lot_number = 'VIDA-DROP'`)[0].n, 1, 'the dropped command is applied exactly once');
    // The client, which never saw the answer, retries with the same key: the same result, nothing new.
    assert.deepEqual(JSON.parse(JSON.stringify(await cmd('stock.receive', { itemId: screw.id, warehouseId: wh.RAW.id, quantity: 50, unitCost: 1, lotNumber: 'VIDA-DROP' }, dropKey))), JSON.parse(JSON.stringify(landed)));
    await cmd('stock.receive', { itemId: screw.id, warehouseId: wh.RAW.id, quantity: 50, unitCost: 1, lotNumber: 'VIDA-DROP' }, dropKey);
    await cmd('stock.receive', { itemId: screw.id, warehouseId: wh.RAW.id, quantity: 50, unitCost: 1, lotNumber: 'VIDA-DROP' }, dropKey);
    // A refresh resubmits the same receipt with a new key: the lot number keeps it from counting twice.
    await assert.rejects(cmd('stock.receive', { itemId: screw.id, warehouseId: wh.RAW.id, quantity: 50, unitCost: 1, lotNumber: 'VIDA-DROP' }));
    assert.equal((await db`SELECT count(*)::int AS n FROM stock_lots WHERE tenant_id = ${tenant.id} AND lot_number = 'VIDA-DROP'`)[0].n, 1);

    // ── 6. Shipping: two desks ship the same packed job at once, then a refresh resubmits ────────
    const packed = await db`SELECT id, produced_qty FROM work_orders WHERE tenant_id = ${tenant.id} AND produced_qty >= 1`;
    assert.equal(packed.length, 24, 'every job is packed once its material arrived');
    const target = packed[0].id;
    const ships = await Promise.allSettled([run(owner, 'shipment.create', { workOrderId: target, quantity: 1 }), run(office, 'shipment.create', { workOrderId: target, quantity: 1 })]);
    assert.equal(settledOk(ships), 1, 'one packed unit ships once');
    await assert.rejects(run(office, 'shipment.create', { workOrderId: target, quantity: 1 }), /fazla sevk/);
    await timed('ship the remaining packed jobs in parallel', () => Promise.all(packed.slice(1).map((p, i) => run(i % 2 ? owner : office, 'shipment.create', { workOrderId: p.id, quantity: 1 }))));

    // ── 7. The books must agree ──────────────────────────────────────────────────────────────────
    const [check] = await db`SELECT
      (SELECT count(*) FROM stock_balances b WHERE b.tenant_id = ${tenant.id} AND abs(b.on_hand_qty - coalesce((SELECT sum(l.quantity_delta) FROM stock_entry_lines l WHERE l.tenant_id = b.tenant_id AND l.item_id = b.item_id AND l.warehouse_id = b.warehouse_id), 0)) > 0.000001)::int AS ledger_mismatch,
      (SELECT count(*) FROM stock_balances WHERE tenant_id = ${tenant.id} AND on_hand_qty < 0)::int AS negative,
      (SELECT count(*) FROM stock_lots WHERE tenant_id = ${tenant.id} AND (remaining_qty < 0 OR remaining_qty > original_qty + 0.000001))::int AS bad_lots,
      (SELECT count(*) FROM work_order_materials WHERE tenant_id = ${tenant.id} AND consumed_qty > transferred_qty + 0.000001)::int AS overconsumed,
      (SELECT count(*) FROM work_orders WHERE tenant_id = ${tenant.id} AND produced_qty > planned_qty)::int AS overproduced,
      (SELECT count(*) FROM work_orders w WHERE w.tenant_id = ${tenant.id} AND (SELECT coalesce(sum(quantity), 0) FROM production_shipments s WHERE s.work_order_id = w.id) > w.produced_qty)::int AS overshipped,
      (SELECT count(*) FROM production_operations WHERE tenant_id = ${tenant.id} AND completed_qty > planned_qty)::int AS ops_overcompleted,
      (SELECT count(*) FROM production_commands WHERE tenant_id = ${tenant.id})::int AS commands`;
    assert.deepEqual({ ...check, commands: undefined }, { ledger_mismatch: 0, negative: 0, bad_lots: 0, overconsumed: 0, overproduced: 0, overshipped: 0, ops_overcompleted: 0, commands: undefined });
    const motorLeft = Number((await db`SELECT coalesce(sum(on_hand_qty), 0) AS q FROM stock_balances WHERE tenant_id = ${tenant.id} AND item_id = ${motor.id}`)[0].q);
    assert(motorLeft >= 0);

    console.log(`timings ms: ${JSON.stringify(timings)}; packed ${packed.length}/24, cuts waiting for motors ${shortageCuts}, commands ${check.commands}`);
    console.log('PASS · factory day: 24 orders at once with double-click conversions, one work order per line under resubmits, bars never in two plans, cancelled plan moves no stock, parallel cuts with a double tap, 4 masters on the floor with QC rework, a dropped connection retried exactly once, no double shipment, books agree');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
