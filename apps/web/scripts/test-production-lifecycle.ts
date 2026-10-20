/**
 * Integration test for the order/inventory production lifecycle, on the isolated local test
 * database only (run through `npm run test:integration -- production-lifecycle`).
 *
 * Covers, against real PostgreSQL:
 *   A. productionCommand idempotency: replay returns the stored result without re-executing,
 *      a reused command id with a different payload is refused, command ids are tenant-scoped,
 *      and a permission failure writes nothing.
 *   B. production stage transitions: QC rejection blocks the operation without crediting
 *      quantity, replay/payload-mismatch/stale-version guards, worker assignment permission,
 *      rework resets the stage, start/partial/done transitions release the next stage, a
 *      cancelled job refuses further commands, and the null-bom_snapshot start crash (D4).
 *   C. reserve -> transfer -> partial production run -> completion, with idempotent replays,
 *      over-production/WIP guards, tenant isolation of reserve/release, and release after
 *      completion freeing nothing; finally the release/reserve reservation_status guard
 *      defects D1 and D2 are characterised at the end of the section.
 *
 * Complements scripts/test-reservation-integrity.ts (reservation arithmetic, races) and
 * scripts/test-production-platform.ts (happy-path platform commands).
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';

const normalize = (value: unknown) => JSON.parse(JSON.stringify(value));

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of [
    '010_work_orders.sql',
    '012_native_manufacturing.sql',
    '014_production_platform.sql',
    '016_quality_inspections.sql',
    '021_warehouse_barcodes.sql',
    '025_production_resources.sql',
    '027_quality_traceability.sql',
    '031_stock_model.sql',
  ]) await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const { reserveWorkOrderMaterials, releaseWorkOrderReservation } = await import(
    '../lib/features/manufacturing/reservation.service'
  );
  const { transferWorkOrderMaterials, completeProductionRun } = await import(
    '../lib/features/manufacturing/manufacturing.service'
  );
  const { productionCommand } = await import('../lib/features/manufacturing/platform.service');

  const key = () => 'life-' + randomUUID();
  const mkTenant = async (label: string) => {
    const tenantId = randomUUID(), ownerId = randomUUID(), workerId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, ${label}, ${'life-' + tenantId.slice(0, 8)})`;
    for (const [id, role] of [[ownerId, 'owner'], [workerId, 'worker']] as const) {
      await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${id}@test.local`}, 'Test')`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
    }
    return {
      tenantId,
      owner: { tenantId, userId: ownerId, role: 'owner' as const },
      worker: { tenantId, userId: workerId, role: 'worker' as const },
    };
  };
  const balance = async (tenantId: string, itemId: string, warehouseId: string) =>
    Number(
      (await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${tenantId} AND item_id=${itemId} AND warehouse_id=${warehouseId}`)[0]
        ?.on_hand_qty ?? -1,
    );
  const jobRow = async (id: string) =>
    (await db`SELECT status, reservation_status, produced_qty, planned_qty FROM work_orders WHERE id=${id}`)[0];
  const opRow = async (id: string) =>
    (await db`SELECT status, version, attempt, completed_qty, reason FROM production_operations WHERE id=${id}`)[0];

  // =============================================================================================
  // C. reserve -> transfer -> partial run -> completion (order / inventory lifecycle)
  // =============================================================================================
  const life = await mkTenant('Lifecycle');
  const T = life.tenantId;
  const warehouse = async (code: string, type: string) => {
    const [row] = await db`INSERT INTO warehouses (tenant_id, code, name, warehouse_type) VALUES (${T}, ${code}, ${code}, ${type}::text) RETURNING id`;
    return row.id as string;
  };
  const raw = await warehouse('HAM', 'RAW');
  const wip = await warehouse('WIP', 'WIP');
  const finished = await warehouse('TLS', 'FINISHED');
  const item = async (sku: string) => {
    const [row] = await db`INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom) VALUES (${T}, ${sku}, ${'Test ' + sku}, 'adet', 'raw_material', 'adet') RETURNING id`;
    return row.id as string;
  };
  const material = await item('MLZ-LIFE');
  const product = await item('MAMUL-LIFE');
  const otherItem = await item('DIGER-LIFE');
  // Seed both ledgers: warehouse balance and the shelf ledger the rf_sync_location_ledger
  // trigger (021) allocates negative entry lines from.
  await db`INSERT INTO stock_balances (tenant_id, item_id, warehouse_id, on_hand_qty) VALUES (${T}, ${material}, ${raw}, 10)`;
  await db`INSERT INTO warehouse_location_balances (tenant_id, item_id, location_id, quantity)
    SELECT ${T}, ${material}, id, 10 FROM warehouse_locations
    WHERE tenant_id=${T} AND warehouse_id=${raw} AND location_type='unassigned'
    ON CONFLICT DO NOTHING`;
  const [order] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency)
    VALUES (${T}, 'LIFE-1', 'Test Müşterisi', 'Pergola', 10, 'pending', 100, 'TRY') RETURNING id`;
  const [job] = await db`INSERT INTO work_orders (tenant_id, title, category, status, order_id, created_by, production_item_id, planned_qty, produced_qty, production_uom, source_warehouse_id, wip_warehouse_id, target_warehouse_id, reservation_status)
    VALUES (${T}, 'LIFE-1 iş', 'production', 'open', ${order.id}, ${life.owner.userId}, ${product}, 10, 0, 'adet', ${raw}, ${wip}, ${finished}, 'not_reserved') RETURNING id`;
  await db`INSERT INTO work_order_materials (tenant_id, work_order_id, item_id, source_warehouse_id, required_qty, uom)
    VALUES (${T}, ${job.id}, ${material}, ${raw}, 6, 'adet')`;

  // Reserve: creates the active reservation and reserves exactly the shortfall.
  const r1: any = await reserveWorkOrderMaterials(life.owner, job.id, key());
  assert.equal(r1.status, 'active');
  assert.equal(Number(r1.lines[0].reserved_qty), 6);
  assert.equal((await jobRow(job.id)).reservation_status, 'reserved');

  // Replaying the same key returns the same reservation and reserves nothing more.
  const r2: any = await reserveWorkOrderMaterials(life.owner, job.id, r1.idempotency_key);
  assert.equal(r2.id, r1.id);
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM stock_reservations WHERE work_order_id=${job.id}`)[0].n), 1);
  assert.equal(Number((await db`SELECT reserved_qty FROM work_order_materials WHERE work_order_id=${job.id}`)[0].reserved_qty), 6);

  // A done job is closed for reservations, another tenant does not see the job at all.
  const [closedJob] = await db`INSERT INTO work_orders (tenant_id, title, category, status, created_by) VALUES (${T}, 'Kapalı', 'production', 'done', ${life.owner.userId}) RETURNING id`;
  await assert.rejects(reserveWorkOrderMaterials(life.owner, closedJob.id, key()), /Kapalı üretim emri/);
  const foreign = await mkTenant('Foreign');
  await assert.rejects(reserveWorkOrderMaterials(foreign.owner, job.id, key()), /Üretim emri bulunamadı/);
  await assert.rejects(releaseWorkOrderReservation(foreign.owner, job.id), /Üretim emri bulunamadı/);
  assert.equal((await jobRow(job.id)).reservation_status, 'reserved');

  // Transfer: stock moves source -> WIP, the reservation line follows, the order enters production.
  const t1: any = await transferWorkOrderMaterials(life.owner, job.id, key());
  assert.equal(await balance(T, material, raw), 4);
  assert.equal(await balance(T, material, wip), 6);
  assert.equal((await jobRow(job.id)).reservation_status, 'transferred');
  assert.equal((await db`SELECT status FROM orders WHERE id=${order.id}`)[0].status, 'in_production');
  const [movedLine] = await db`SELECT warehouse_id FROM stock_reservation_lines WHERE tenant_id=${T} AND item_id=${material} AND reservation_id=${r1.id}`;
  assert.equal(movedLine.warehouse_id, wip);

  // Replaying the transfer key returns the same stock entry; a new key has nothing left to move.
  const t2: any = await transferWorkOrderMaterials(life.owner, job.id, t1.idempotency_key);
  assert.equal(t2.id, t1.id);
  assert.equal(await balance(T, material, raw), 4);
  assert.equal(await balance(T, material, wip), 6);
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM stock_entries WHERE idempotency_key=${t1.idempotency_key}`)[0].n), 1);
  await assert.rejects(transferWorkOrderMaterials(life.owner, job.id, key()), /Aktarılacak rezerve malzeme yok/);

  // Partial completion: 4 of 10, proportionally consuming WIP material.
  const run1: any = await completeProductionRun(life.owner, { workOrderId: job.id, producedQty: 4, idempotencyKey: key() });
  assert.equal(run1.workOrderCompleted, false);
  let current = await jobRow(job.id);
  assert.equal(Number(current.produced_qty), 4);
  assert.equal(current.status, 'in_progress');
  assert.equal(current.reservation_status, 'transferred');
  assert.equal(await balance(T, material, wip), 3.6); // 6 - 6*4/10
  assert.equal(await balance(T, product, finished), 4);
  assert.equal(Number((await db`SELECT consumed_qty FROM work_order_materials WHERE work_order_id=${job.id}`)[0].consumed_qty), 2.4);
  assert.equal(Number((await db`SELECT consumed_qty FROM stock_reservation_lines WHERE reservation_id=${r1.id}`)[0].consumed_qty), 2.4);

  // Replaying the run key is a no-op; the guards refuse over-production and impossible consumption.
  const replayRun: any = await completeProductionRun(life.owner, { workOrderId: job.id, producedQty: 4, idempotencyKey: run1.idempotency_key });
  assert.equal(replayRun.id, run1.id);
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM production_runs WHERE work_order_id=${job.id}`)[0].n), 1);
  assert.equal(await balance(T, material, wip), 3.6);
  await assert.rejects(
    completeProductionRun(life.owner, { workOrderId: job.id, producedQty: 7, idempotencyKey: key() }),
    /planlanan miktarı aşamaz/,
  );
  await assert.rejects(
    completeProductionRun(life.owner, { workOrderId: job.id, producedQty: 1, idempotencyKey: key(), actualMaterials: [{ itemId: otherItem, quantity: 1 }] }),
    /BOM dışı tüketim kalemi/,
  );
  await assert.rejects(
    completeProductionRun(life.owner, { workOrderId: job.id, producedQty: 1, idempotencyKey: key(), actualMaterials: [{ itemId: material, quantity: 1 }, { itemId: material, quantity: 2 }] }),
    /tekrar edemez/,
  );
  await assert.rejects(
    completeProductionRun(life.owner, { workOrderId: job.id, producedQty: 1, idempotencyKey: key(), actualMaterials: [{ itemId: material, quantity: 99 }] }),
    /WIP malzemesi yetersiz/,
  );
  assert.equal(Number((await jobRow(job.id)).produced_qty), 4);

  // Final run closes the job: reservation consumed, WIP emptied, nothing left reserved.
  const run2: any = await completeProductionRun(life.owner, { workOrderId: job.id, producedQty: 6, idempotencyKey: key() });
  assert.equal(run2.workOrderCompleted, true);
  current = await jobRow(job.id);
  assert.equal(current.status, 'done');
  assert.equal(current.reservation_status, 'consumed');
  assert.equal(await balance(T, material, wip), 0);
  assert.equal(await balance(T, product, finished), 10);
  assert.equal(await balance(T, material, raw), 4);
  assert.equal((await db`SELECT status FROM stock_reservations WHERE id=${r1.id}`)[0].status, 'consumed');
  const doneMaterial = (await db`SELECT reserved_qty, consumed_qty FROM work_order_materials WHERE work_order_id=${job.id}`)[0];
  assert.equal(Number(doneMaterial.reserved_qty), Number(doneMaterial.consumed_qty));

  // Releasing after completion frees nothing: consumed reservations stay consumed.
  const released: any = await releaseWorkOrderReservation(life.owner, job.id);
  assert.equal(released.released, true);
  assert.equal((await db`SELECT status FROM stock_reservations WHERE id=${r1.id}`)[0].status, 'consumed');
  assert.equal(await balance(T, material, raw), 4);
  assert.equal(await balance(T, material, wip), 0);
  assert.equal(await balance(T, product, finished), 10);
  await assert.rejects(reserveWorkOrderMaterials(life.owner, job.id, key()), /Kapalı üretim emri/);

  // D2 characterisation (defect: reserve has no reservation_status guard): a fresh key on an
  // already-transferred, mid-production job downgrades reservation_status back to 'reserved'
  // and writes an empty active header instead of refusing the reservation.
  const [jobT] = await db`INSERT INTO work_orders (tenant_id, title, category, status, created_by, production_item_id, planned_qty, produced_qty, production_uom, source_warehouse_id, wip_warehouse_id, target_warehouse_id, reservation_status)
    VALUES (${T}, 'Transfer sonrası rezerv', 'production', 'in_progress', ${life.owner.userId}, ${product}, 5, 0, 'adet', ${raw}, ${wip}, ${finished}, 'transferred') RETURNING id`;
  await db`INSERT INTO work_order_materials (tenant_id, work_order_id, item_id, source_warehouse_id, required_qty, uom)
    VALUES (${T}, ${jobT.id}, ${material}, ${raw}, 2, 'adet')`;
  await db`UPDATE work_order_materials SET reserved_qty=2, transferred_qty=2 WHERE work_order_id=${jobT.id}`;
  const d2: any = await reserveWorkOrderMaterials(life.owner, jobT.id, key());
  assert.equal(d2.status, 'active');
  assert.equal(d2.lines.length, 0, 'nothing was left to reserve on the transferred job');
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM stock_reservation_lines WHERE reservation_id=${d2.id}`)[0].n), 0, 'the empty header holds no lines');
  assert.equal((await jobRow(jobT.id)).reservation_status, 'reserved', 'DEFECT D2 characterisation: the transferred state is downgraded to reserved');
  assert.equal(Number((await db`SELECT reserved_qty FROM work_order_materials WHERE work_order_id=${jobT.id}`)[0].reserved_qty), 2, 'reserved quantities are untouched');

  // D1 characterisation (defect: release has no reservation_status guard): releasing a
  // transferred, mid-production job frees the hold and marks the job 'released'; the job is
  // then stranded — neither completion nor transfer accepts that reservation state.
  const [jobT2] = await db`INSERT INTO work_orders (tenant_id, title, category, status, created_by, production_item_id, planned_qty, produced_qty, production_uom, source_warehouse_id, wip_warehouse_id, target_warehouse_id, reservation_status)
    VALUES (${T}, 'Rezervasyonu bırakılan iş', 'production', 'open', ${life.owner.userId}, ${product}, 5, 0, 'adet', ${raw}, ${wip}, ${finished}, 'not_reserved') RETURNING id`;
  await db`INSERT INTO work_order_materials (tenant_id, work_order_id, item_id, source_warehouse_id, required_qty, uom)
    VALUES (${T}, ${jobT2.id}, ${material}, ${raw}, 2, 'adet')`;
  await reserveWorkOrderMaterials(life.owner, jobT2.id, key());
  await transferWorkOrderMaterials(life.owner, jobT2.id, key());
  assert.equal((await jobRow(jobT2.id)).reservation_status, 'transferred');
  assert.equal(await balance(T, material, raw), 2);
  const d1: any = await releaseWorkOrderReservation(life.owner, jobT2.id);
  assert.equal(d1.released, true);
  assert.equal((await jobRow(jobT2.id)).reservation_status, 'released', 'DEFECT D1 characterisation: release is allowed mid-production');
  assert.equal((await db`SELECT status FROM stock_reservations WHERE work_order_id=${jobT2.id}`)[0].status, 'released');
  await assert.rejects(
    completeProductionRun(life.owner, { workOrderId: jobT2.id, producedQty: 1, idempotencyKey: key() }),
    /yalnız WIP transferinden sonra/,
    'DEFECT D1: after the release the job can no longer complete',
  );
  await assert.rejects(
    transferWorkOrderMaterials(life.owner, jobT2.id, key()),
    /Malzemeler önce rezerve edilmelidir/,
    'DEFECT D1: nor can it transfer again — the job is stranded',
  );

  // =============================================================================================
  // A. productionCommand idempotency (tenant-scoped command ids)
  // =============================================================================================
  const cmds = await mkTenant('Commands');
  const other = await mkTenant('Commands-B');
  const commandId = randomUUID();
  const costSettings = {
    commandId,
    action: 'quality.cost-settings',
    data: { revision: 1, laborCostPerHour: 150, laborCurrency: 'TRY' },
  };
  const first = await productionCommand(cmds.owner, costSettings);
  assert.deepEqual(first, { ok: true });
  const prefs = async (tenantId: string) =>
    (await db`SELECT quality_revision, labor_cost_per_hour FROM manufacturing_preferences WHERE tenant_id=${tenantId}`)[0];
  assert.equal(Number((await prefs(cmds.tenantId)).quality_revision), 1);

  // Replay: the stored result comes back, nothing executes twice (revision stays 1).
  const replay = await productionCommand(cmds.owner, costSettings);
  assert.deepEqual(replay, first);
  assert.equal(Number((await prefs(cmds.tenantId)).quality_revision), 1);
  assert.equal(Number((await prefs(cmds.tenantId)).labor_cost_per_hour), 150);
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM production_commands WHERE command_id=${commandId}`)[0].n), 1);

  // Same id, different payload: refused, and the stored preference is untouched.
  await assert.rejects(
    productionCommand(cmds.owner, { ...costSettings, data: { revision: 1, laborCostPerHour: 999, laborCurrency: 'TRY' } }),
    /başka bir işlemde kullanılmış/,
  );
  assert.equal(Number((await prefs(cmds.tenantId)).labor_cost_per_hour), 150);

  // The same command id belongs to the other tenant's namespace: it runs there, not here.
  await productionCommand(other.owner, { ...costSettings, data: { revision: 1, laborCostPerHour: 200, laborCurrency: 'TRY' } });
  assert.equal(Number((await prefs(other.tenantId)).labor_cost_per_hour), 200);
  assert.equal(Number((await prefs(cmds.tenantId)).labor_cost_per_hour), 150);
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM production_commands WHERE command_id=${commandId}`)[0].n), 2);

  // A permission failure writes neither a preference nor a command row.
  const refusedId = randomUUID();
  await assert.rejects(
    productionCommand(cmds.worker, { commandId: refusedId, action: 'quality.cost-settings', data: { revision: 1, laborCostPerHour: 1, laborCurrency: 'TRY' } }),
    (e: any) => e.status === 403,
  );
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM production_commands WHERE command_id=${refusedId}`)[0].n), 0);

  // =============================================================================================
  // B. stage transitions: QC rejection, replay/version guards, rework, cancellation
  // =============================================================================================
  const stage = await mkTenant('Stages');
  const S = stage.tenantId;
  const [stageOrder] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency)
    VALUES (${S}, 'STG-1', 'Test Müşterisi', 'Tente', 10, 'pending', 100, 'TRY') RETURNING id`;
  // reservation_status 'transferred': material transfer itself is exercised in section C; the
  // platform's start path requires it when bom_snapshot is NULL (see the D4 probe below).
  const [job2] = await db`INSERT INTO work_orders (tenant_id, title, category, status, order_id, created_by, planned_qty, produced_qty, reservation_status)
    VALUES (${S}, 'STG-1 iş', 'production', 'open', ${stageOrder.id}, ${stage.owner.userId}, 10, 0, 'transferred') RETURNING id`;
  const qualityChecks = JSON.stringify([
    { id: 'width', name: 'En kontrolü', kind: 'measurement', unit: 'mm', minimum: 1, maximum: 2 },
  ]);
  const [op1] = await db`INSERT INTO production_operations (tenant_id, work_order_id, position, name, work_center_code, planned_minutes, status, planned_qty, quality_checks)
    VALUES (${S}, ${job2.id}, 0, 'Kesim', 'KESIM', 30, 'running', 10, ${qualityChecks}::text::jsonb) RETURNING id, version`;
  const [op2] = await db`INSERT INTO production_operations (tenant_id, work_order_id, position, name, work_center_code, planned_minutes, status, planned_qty)
    VALUES (${S}, ${job2.id}, 1, 'Montaj', 'MONTAJ', 20, 'waiting', 10) RETURNING id`;
  const operate = (data: Record<string, unknown>, commandId = randomUUID()) =>
    productionCommand(stage.owner, { commandId, action: 'operation', data });

  // QC rejection: the operation is blocked, nothing is credited, the failure is recorded.
  const rejectPayload: Record<string, unknown> = {
    operationId: op1.id,
    version: op1.version,
    action: 'complete',
    quantity: 1,
    qualityResults: [{ checkId: 'width', value: 99 }],
  };
  const rejectionCommandId = randomUUID();
  const rejection: any = await operate(rejectPayload, rejectionCommandId);
  assert.equal(rejection.qualityRejected, true);
  let op = await opRow(op1.id);
  assert.equal(op.status, 'blocked');
  assert.equal(Number(op.completed_qty), 0);
  assert.equal(op.reason, 'Kalite kontrol başarısız');
  assert.equal(Number((await jobRow(job2.id)).produced_qty), 0);
  const [inspection] = await db`SELECT passed FROM quality_inspections WHERE operation_id=${op1.id}`;
  assert.equal(inspection.passed, false);
  assert.equal(
    Number((await db`SELECT count(*)::int AS n FROM production_events WHERE operation_id=${op1.id} AND event_type='quality.failed'`)[0].n),
    1,
  );
  const inspectionCount = async () =>
    Number((await db`SELECT count(*)::int AS n FROM quality_inspections WHERE operation_id=${op1.id}`)[0].n);
  assert.equal(
    Number((await db`SELECT count(*)::int AS n FROM production_commands WHERE tenant_id=${S} AND command_id=${rejectionCommandId}`)[0].n),
    1,
    'the first command outcome is stored for replay',
  );

  // (b) Replaying the command id returns the stored outcome and re-runs nothing.
  const blockedVersion = Number(op.version);
  const replayed: any = await operate(rejectPayload, rejectionCommandId);
  assert.deepEqual(normalize(replayed), normalize(rejection), 'replay returns the stored result');
  assert.equal(Number((await opRow(op1.id)).version), blockedVersion, 'replay does not re-execute the operation');
  assert.equal(await inspectionCount(), 1, 'replay adds no second inspection');

  // (c) The same command id with a different payload is refused and executes nothing.
  await assert.rejects(operate({ ...rejectPayload, quantity: 2 }, rejectionCommandId), /başka bir işlemde kullanılmış/);
  assert.equal(Number((await opRow(op1.id)).version), blockedVersion, 'the refused replay changed nothing');
  assert.equal(await inspectionCount(), 1);

  // (d) A stale operation version is refused with the platform conflict message.
  await assert.rejects(
    operate({ ...rejectPayload, version: blockedVersion - 1 }, randomUUID()),
    /Operasyon başka cihazda değişti/,
  );

  // (e) A BLOCKED operation refuses completion: the state machine demands a start first.
  await assert.rejects(
    operate({ ...rejectPayload, version: blockedVersion }, randomUUID()),
    /Tamamlamadan önce işi başlatın/,
  );
  assert.equal(Number((await opRow(op1.id)).version), blockedVersion, 'the refused completion changed nothing');
  assert.equal(await inspectionCount(), 1, 'the refused completion recorded no inspection');

  // (f) A worker may only touch their own assignment; both stages are unassigned.
  await assert.rejects(
    productionCommand(stage.worker, {
      commandId: randomUUID(),
      action: 'operation',
      data: { operationId: op2.id, version: Number((await opRow(op2.id)).version), action: 'start' },
    }),
    (e: any) => e.status === 403 && /Bu iş size atanmadı/.test(String(e.message)),
  );

  // (g) Rework after the QC failure: stage ready again, attempt+1 down the line, job in_progress.
  const reworked: any = await operate({
    operationId: op1.id,
    version: blockedVersion,
    action: 'rework',
    quantity: 1,
    targetOperationId: op1.id,
    reasonCode: 'quality',
    reason: 'En ölçüsü limitin dışında',
  });
  assert.ok(reworked.id, 'the rework request is recorded');
  const [reworkRow] = await db`SELECT inspection_id FROM production_rework WHERE id=${reworked.id}`;
  assert.ok(reworkRow.inspection_id, 'the failed inspection is linked to the rework');
  op = await opRow(op1.id);
  assert.equal(op.status, 'ready');
  assert.equal(Number(op.attempt), 2);
  assert.equal(Number(op.completed_qty), 0);
  const op2AfterRework = await opRow(op2.id);
  assert.equal(op2AfterRework.status, 'waiting');
  assert.equal(Number(op2AfterRework.attempt), 2, 'every stage from the target onwards is re-attempted');
  assert.equal((await jobRow(job2.id)).status, 'in_progress');

  // (h) Start: the work centre exists, nothing else runs there, and the stage begins.
  await db`INSERT INTO work_centers (tenant_id, code, name, parallel_capacity) VALUES (${S}, 'KESIM', 'Kesim', 1)`;
  const started: any = await operate({ operationId: op1.id, version: Number(op.version), action: 'start' });
  assert.equal(started.status, 'running');
  assert.equal((await jobRow(job2.id)).status, 'in_progress');
  assert.equal((await db`SELECT status FROM orders WHERE id=${stageOrder.id}`)[0].status, 'in_production');

  // (i) Passing QC credits the quantity; a partial stage pauses, never completes early.
  const partial: any = await operate({
    operationId: op1.id,
    version: Number((await opRow(op1.id)).version),
    action: 'complete',
    quantity: 4,
    qualityResults: [{ checkId: 'width', value: 1.5 }],
  });
  assert.equal(partial.status, 'paused');
  assert.equal(Number(partial.completed_qty), 4);
  assert.equal(
    Number((await db`SELECT count(*)::int AS n FROM quality_inspections WHERE operation_id=${op1.id} AND passed`)[0].n),
    1,
    'the passing inspection is recorded',
  );

  // (j) Finish the stage: 4 + 6 = planned 10 -> done, the next stage becomes ready.
  const restarted: any = await operate({ operationId: op1.id, version: Number((await opRow(op1.id)).version), action: 'start' });
  assert.equal(restarted.status, 'running');
  const finishedStage: any = await operate({
    operationId: op1.id,
    version: Number((await opRow(op1.id)).version),
    action: 'complete',
    quantity: 6,
    qualityResults: [{ checkId: 'width', value: 1.5 }],
  });
  assert.equal(finishedStage.status, 'done');
  assert.equal(Number(finishedStage.completed_qty), 10);
  assert.equal((await opRow(op2.id)).status, 'ready', 'the next stage is released');
  // finishQuantity only runs for the LAST stage; op2 is still open, so the job credited nothing.
  assert.equal(Number((await jobRow(job2.id)).produced_qty), 0);

  // (k) op2's version moved with the cascade: the insert-time version is stale now.
  await assert.rejects(
    operate({ operationId: op2.id, version: 1, action: 'start' }, randomUUID()),
    /Operasyon başka cihazda değişti/,
  );

  // (l) A cancelled job refuses further commands without touching its stages.
  await db`UPDATE work_orders SET status='cancelled' WHERE id=${job2.id}`;
  await assert.rejects(
    operate({ operationId: op2.id, version: Number((await opRow(op2.id)).version), action: 'start' }, randomUUID()),
    /Üretim iptal edilmiş/,
  );
  assert.equal((await opRow(op2.id)).status, 'ready', 'the refused command left the stage untouched');

  // (m) DEFECT D4, characterised: starting a work order with bom_snapshot NULL crashes with a
  // TypeError instead of a clean business error (legacy/plain work orders have it NULL).
  const [job3] = await db`INSERT INTO work_orders (tenant_id, title, category, status, created_by, planned_qty, produced_qty, reservation_status)
    VALUES (${S}, 'BOM-sız iş', 'production', 'open', ${stage.owner.userId}, 10, 0, 'not_reserved') RETURNING id`;
  const [op3] = await db`INSERT INTO production_operations (tenant_id, work_order_id, position, name, work_center_code, planned_minutes, status, planned_qty)
    VALUES (${S}, ${job3.id}, 0, 'Boya', 'KESIM', 15, 'ready', 10) RETURNING id, version`;
  await assert.rejects(
    operate({ operationId: op3.id, version: op3.version, action: 'start' }, randomUUID()),
    (e: any) => e instanceof TypeError && /cuts/.test(String(e.message)),
    'D4 characterisation: a null bom_snapshot on start must be reported; update this check when the defect is fixed',
  );
  assert.equal((await opRow(op3.id)).status, 'ready', 'the crashed start changed nothing');

  await db.end();
  console.log(
    'PASS · production lifecycle: command idempotency (replay deep-equal, payload mismatch, tenant-scoped command ids, 403 writes nothing), QC rejection -> blocked -> rework -> start -> partial/done stage transitions with stale-version and cancellation guards, worker assignment permission, reserve->transfer->run chain with replays and consumption guards, tenant isolation, D1/D2/D4 defects characterised',
  );
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
