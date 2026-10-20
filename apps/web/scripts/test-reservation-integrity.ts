/**
 * Integration tests for work-order material reservation integrity, on the isolated local test
 * database only (run through `npm run test:integration -- reservation-integrity`).
 *
 * Invariants under test (lib/features/manufacturing/reservation.service.ts):
 *   1. over-reservation (availability loop vs. the schema's per-work-order uniqueness),
 *   2. idempotency-key replay semantics,
 *   3. release arithmetic (released = reserved - consumed, material.reserved = consumed),
 *   4. tenant isolation of reserve and release,
 *   5. two concurrent reservations competing for the same (item, warehouse).
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['010_work_orders.sql', '012_native_manufacturing.sql', '031_stock_model.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const { reserveWorkOrderMaterials, releaseWorkOrderReservation } = await import(
    '../lib/features/manufacturing/reservation.service'
  );
  const { sql } = await import('../lib/db');

  // ---- fixtures ------------------------------------------------------------------------------
  const mkTenant = async (label: string) => {
    const tenantId = randomUUID(), ownerId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, ${label}, ${'res-' + tenantId.slice(0, 8)})`;
    await db`INSERT INTO users (id, email, name) VALUES (${ownerId}, ${`owner-${ownerId}@test.local`}, 'Owner')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ownerId}, 'owner')`;
    return { tenantId, actor: { tenantId, userId: ownerId, role: 'owner' as const } };
  };
  const mkWarehouse = async (tenantId: string, code: string) =>
    (await db`INSERT INTO warehouses (id, tenant_id, code, name, warehouse_type) VALUES (${randomUUID()}, ${tenantId}, ${code}, ${code}, 'RAW') RETURNING id`)[0].id;
  const mkItem = async (tenantId: string, sku: string, uom = 'm') =>
    (await db`INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom, min_stock) VALUES (${tenantId}, ${sku}, ${sku}, ${uom}, 'raw_material', ${uom}, 0) RETURNING id`)[0].id;
  const stock = async (tenantId: string, itemId: string, warehouseId: string, qty: number) =>
    db`INSERT INTO stock_balances (tenant_id, item_id, warehouse_id, on_hand_qty) VALUES (${tenantId}, ${itemId}, ${warehouseId}, ${qty})`;
  const mkWorkOrder = async (tenantId: string, title: string) =>
    (await db`INSERT INTO work_orders (tenant_id, title, status) VALUES (${tenantId}, ${title}, 'open') RETURNING id`)[0].id;
  const addMaterial = async (tenantId: string, workOrderId: string, itemId: string, warehouseId: string, qty: number) =>
    db`INSERT INTO work_order_materials (tenant_id, work_order_id, item_id, source_warehouse_id, required_qty, uom) VALUES (${tenantId}, ${workOrderId}, ${itemId}, ${warehouseId}, ${qty}, 'm')`;
  const onHand = async (tenantId: string, itemId: string, warehouseId: string) =>
    Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${tenantId} AND item_id=${itemId} AND warehouse_id=${warehouseId}`)[0].on_hand_qty);
  /** Exactly the availability figure the service computes. */
  const held = async (tenantId: string, itemId: string, warehouseId: string) =>
    Number((await db`SELECT COALESCE(SUM(rl.reserved_qty - rl.consumed_qty - rl.released_qty), 0) AS qty
      FROM stock_reservation_lines rl JOIN stock_reservations rh ON rh.id = rl.reservation_id
      WHERE rl.tenant_id=${tenantId} AND rl.item_id=${itemId} AND rl.warehouse_id=${warehouseId} AND rh.status='active'`)[0].qty);
  const headers = async (workOrderId: string) =>
    db`SELECT id, status, idempotency_key FROM stock_reservations WHERE work_order_id=${workOrderId} ORDER BY created_at`;
  const materials = async (workOrderId: string) =>
    db`SELECT id, item_id, required_qty, reserved_qty, consumed_qty FROM work_order_materials WHERE work_order_id=${workOrderId} ORDER BY item_id`;

  const A = await mkTenant('Rezervasyon A');
  const B = await mkTenant('Rezervasyon B');
  const raw = await mkWarehouse(A.tenantId, 'HAM-' + A.tenantId.slice(0, 4));

  // ---- 1. over-reservation -------------------------------------------------------------------
  {
    const item = await mkItem(A.tenantId, 'OVR-' + itemSku());
    await stock(A.tenantId, item, raw, 100);

    const wo1 = await mkWorkOrder(A.tenantId, 'OVR-1');
    await addMaterial(A.tenantId, wo1, item, raw, 60);
    const first = await reserveWorkOrderMaterials(A.actor, wo1, 'ovr-' + randomUUID());
    assert.equal(Number(first.lines[0].reserved_qty), 60);
    assert.equal(Number((await materials(wo1))[0].reserved_qty), 60);
    assert.equal((await db`SELECT reservation_status FROM work_orders WHERE id=${wo1}`)[0].reservation_status, 'reserved');
    assert.equal(await held(A.tenantId, item, raw), 60);

    // The scenario the availability loop looks vulnerable to: a second row for the SAME
    // (work order, item, source warehouse) whose need also fits alone. The schema refuses it,
    // so the loop's per-material check is equivalent to an aggregate check per stock bucket.
    await assert.rejects(
      addMaterial(A.tenantId, wo1, item, raw, 60),
      (e: any) => /duplicate key/i.test(String(e.message)) && /work_order_materials/i.test(String(e.message)),
      'UNIQUE (tenant_id, work_order_id, item_id, source_warehouse_id) refuses a second row for the same stock bucket',
    );
    const uniqueKeys = await db`SELECT conname FROM pg_constraint WHERE conrelid='work_order_materials'::regclass AND contype='u'`;
    // PostgreSQL truncates identifiers at 63 bytes, so the generated name ends "..._source_key".
    assert.ok(
      uniqueKeys.some((c: any) => /^work_order_materials_/.test(c.conname) && c.conname.includes('work_order_id_item_id_source')),
      `expected the (work_order, item, source warehouse) uniqueness constraint, got ${JSON.stringify(uniqueKeys)}`,
    );

    // A different work order that fits alone (60 <= 100) but not combined (60 + 60 > 100) is refused,
    // and the refusal leaves nothing behind: no header, no lines, reserved_qty untouched.
    const wo2 = await mkWorkOrder(A.tenantId, 'OVR-2');
    await addMaterial(A.tenantId, wo2, item, raw, 60);
    await assert.rejects(reserveWorkOrderMaterials(A.actor, wo2, 'ovr-' + randomUUID()), /Yetersiz kullanılabilir stok/);
    assert.equal((await headers(wo2)).length, 0, 'a refused reservation leaves no header');
    assert.equal(Number((await materials(wo2))[0].reserved_qty), 0, 'a refused reservation touches no material');
    assert.equal(await held(A.tenantId, item, raw), 60, 'the refusal leaves the first hold intact');

    // Exact boundary: the remaining 40 is reserved, filling the bucket to precisely on-hand.
    const wo3 = await mkWorkOrder(A.tenantId, 'OVR-3');
    await addMaterial(A.tenantId, wo3, item, raw, 40);
    const exact = await reserveWorkOrderMaterials(A.actor, wo3, 'ovr-' + randomUUID());
    assert.equal(exact.lines.length, 1);
    assert.equal(await held(A.tenantId, item, raw), await onHand(A.tenantId, item, raw));
    console.log('PASS · over-reservation: schema refuses a second row per (work order, item, warehouse), a lone-fitting work order is refused atomically, exact boundary fills the bucket to on-hand');
  }

  // ---- 2. idempotency ------------------------------------------------------------------------
  {
    const item = await mkItem(A.tenantId, 'IDM-' + itemSku());
    await stock(A.tenantId, item, raw, 50);
    const wo = await mkWorkOrder(A.tenantId, 'IDEM-1');
    const woOther = await mkWorkOrder(A.tenantId, 'IDEM-2');
    await addMaterial(A.tenantId, wo, item, raw, 30);
    await addMaterial(A.tenantId, woOther, item, raw, 10);

    const key = 'idem-' + randomUUID();
    const created = await reserveWorkOrderMaterials(A.actor, wo, key);
    assert.equal(created.lines.length, 1);

    // Same key + same work order: the existing reservation comes back, nothing is written twice.
    const replay = await reserveWorkOrderMaterials(A.actor, wo, key);
    assert.equal(replay.id, created.id, 'replay returns the same reservation');
    assert.equal((await headers(wo)).length, 1, 'replay creates no second header');
    assert.equal((await db`SELECT count(*)::int AS n FROM stock_reservation_lines WHERE reservation_id=${created.id}`)[0].n, 1, 'replay adds no second line');
    assert.equal(Number((await materials(wo))[0].reserved_qty), 30, 'replay does not re-reserve');

    // Same key + different work order: refused, and the other work order stays unreserved.
    await assert.rejects(
      reserveWorkOrderMaterials(A.actor, woOther, key),
      /farklı bir rezervasyonda kullanılmış/,
    );
    assert.equal((await headers(woOther)).length, 0, 'the key collision reserves nothing for the other work order');
    assert.equal(await held(A.tenantId, item, raw), 30);

    // Too short a key is refused before any database work.
    await assert.rejects(reserveWorkOrderMaterials(A.actor, wo, 'short'), /idempotency anahtarı/);

    // Characterisation (minor gap, not an integrity breach): a NEW key on an already fully
    // reserved work order writes an empty active header instead of pointing at the first one.
    const again = await reserveWorkOrderMaterials(A.actor, wo, 'idem-' + randomUUID());
    assert.notEqual(again.id, created.id, 'characterisation: a fresh key yields a fresh header');
    assert.equal(again.lines.length, 0, 'characterisation: with nothing left to reserve, that header carries no lines');
    assert.equal(await held(A.tenantId, item, raw), 30, 'the empty header holds no stock');
    console.log('PASS · idempotency: replay returns the same reservation without writing, a key bound to another work order is refused with no side effects, short keys refused, empty-header characterisation recorded');
  }

  // ---- 3. release integrity ------------------------------------------------------------------
  {
    const bar = await mkItem(A.tenantId, 'REL-' + itemSku(), 'm');
    const screw = await mkItem(A.tenantId, 'REL-S-' + itemSku(), 'adet');
    await stock(A.tenantId, bar, raw, 30);
    await stock(A.tenantId, screw, raw, 100);
    const wo = await mkWorkOrder(A.tenantId, 'RELEASE-1');
    await addMaterial(A.tenantId, wo, bar, raw, 20);
    await addMaterial(A.tenantId, wo, screw, raw, 5);
    const reservation = await reserveWorkOrderMaterials(A.actor, wo, 'rel-' + randomUUID());
    assert.equal(reservation.lines.length, 2);

    // Partial consumption of one line (as production would record).
    await db`UPDATE stock_reservation_lines SET consumed_qty = 8 WHERE reservation_id=${reservation.id} AND item_id=${bar}`;
    await db`UPDATE work_order_materials SET consumed_qty = 8 WHERE work_order_id=${wo} AND item_id=${bar}`;

    assert.deepEqual(await releaseWorkOrderReservation(A.actor, wo), { released: true, workOrderId: wo });

    const lines = await db`SELECT item_id, reserved_qty, consumed_qty, released_qty FROM stock_reservation_lines WHERE reservation_id=${reservation.id} ORDER BY item_id`;
    const lineBar = lines.find((l: any) => l.item_id === bar)!;
    const lineScrew = lines.find((l: any) => l.item_id === screw)!;
    assert.equal(Number(lineBar.released_qty), Number(lineBar.reserved_qty) - Number(lineBar.consumed_qty), 'released = reserved - consumed (20 - 8)');
    assert.equal(Number(lineBar.released_qty), 12);
    assert.equal(Number(lineScrew.released_qty), Number(lineScrew.reserved_qty) - Number(lineScrew.consumed_qty), 'released = reserved - consumed (5 - 0)');
    assert.equal(Number(lineScrew.released_qty), 5);
    assert.ok(Number(lineBar.consumed_qty) + Number(lineBar.released_qty) <= Number(lineBar.reserved_qty), 'the CHECK (consumed + released <= reserved) still holds');

    const after = await materials(wo);
    const matBar = after.find((m: any) => m.item_id === bar)!;
    const matScrew = after.find((m: any) => m.item_id === screw)!;
    assert.equal(Number(matBar.reserved_qty), Number(matBar.consumed_qty), 'material reserved_qty collapses to consumed_qty');
    assert.equal(Number(matBar.reserved_qty), 8);
    assert.equal(Number(matScrew.reserved_qty), 0);

    assert.equal((await headers(wo))[0].status, 'released');
    assert.equal((await db`SELECT reservation_status FROM work_orders WHERE id=${wo}`)[0].reservation_status, 'released');

    // The bucket is free again: everything still active is zero, so the full on-hand is reservable.
    assert.equal(await held(A.tenantId, bar, raw), 0, 'a released hold no longer counts as held');
    const wo2 = await mkWorkOrder(A.tenantId, 'RELEASE-2');
    await addMaterial(A.tenantId, wo2, bar, raw, 30);
    await reserveWorkOrderMaterials(A.actor, wo2, 'rel-' + randomUUID());
    assert.equal(await held(A.tenantId, bar, raw), 30);

    // Releasing again is safe: nothing active is touched, quantities stay where they were.
    await releaseWorkOrderReservation(A.actor, wo);
    const settled = await materials(wo);
    assert.equal(Number(settled.find((m: any) => m.item_id === bar)!.reserved_qty), 8, 'a second release does not move the consumed figure');
    assert.equal(Number(settled.find((m: any) => m.item_id === screw)!.reserved_qty), 0);
    console.log('PASS · release integrity: released = reserved - consumed per line, material reserved collapses to consumed, header/work order marked released, bucket freed, repeat release inert');
  }

  // ---- 4. tenant isolation -------------------------------------------------------------------
  {
    const item = await mkItem(A.tenantId, 'TEN-' + itemSku());
    await stock(A.tenantId, item, raw, 40);
    const woReserve = await mkWorkOrder(A.tenantId, 'TENANT-1');
    await addMaterial(A.tenantId, woReserve, item, raw, 10);
    const woHeld = await mkWorkOrder(A.tenantId, 'TENANT-2');
    await addMaterial(A.tenantId, woHeld, item, raw, 10);
    const heldKey = 'ten-' + randomUUID();
    const heldRes = await reserveWorkOrderMaterials(A.actor, woHeld, heldKey);
    assert.equal(heldRes.lines.length, 1);

    const stranger = { tenantId: B.tenantId, userId: B.actor.userId, role: 'owner' as const };

    // Tenant B cannot reserve tenant A's work order, and nothing is written.
    await assert.rejects(reserveWorkOrderMaterials(stranger, woReserve, 'ten-' + randomUUID()), /Üretim emri bulunamadı/);
    assert.equal((await headers(woReserve)).length, 0, 'no reservation for a foreign work order');
    assert.equal(Number((await materials(woReserve))[0].reserved_qty), 0);

    // Tenant B cannot release tenant A's reservation: the call fails and the hold survives.
    await assert.rejects(releaseWorkOrderReservation(stranger, woHeld), /Üretim emri bulunamadı/);
    assert.equal((await headers(woHeld))[0].status, 'active', 'the foreign release left the hold active');
    assert.equal(await held(A.tenantId, item, raw), 10, 'the foreign release freed no stock');

    // The idempotency lookup is tenant-scoped: tenant B replaying tenant A's key learns nothing
    // and reserves nothing; tenant A's reservation is untouched.
    await assert.rejects(reserveWorkOrderMaterials(stranger, woHeld, heldKey), /Üretim emri bulunamadı/);
    assert.equal((await headers(woHeld)).length, 1, 'tenant B did not adopt tenant A\'s reservation');
    assert.equal((await headers(woHeld))[0].id, heldRes.id);
    console.log('PASS · tenant isolation: foreign reserve and release both refused with no writes, idempotency keys never cross tenants');
  }

  // ---- 5. concurrency ------------------------------------------------------------------------
  {
    const outcomes: string[] = [];
    let roundsWithSuccess = 0;
    for (let round = 1; round <= 3; round++) {
      const item = await mkItem(A.tenantId, `CONC-${round}-${itemSku()}`);
      await stock(A.tenantId, item, raw, 100);
      const woA = await mkWorkOrder(A.tenantId, `CONC-A-${round}`);
      const woB = await mkWorkOrder(A.tenantId, `CONC-B-${round}`);
      await addMaterial(A.tenantId, woA, item, raw, 80); // each fits alone, 160 > 100 together
      await addMaterial(A.tenantId, woB, item, raw, 80);

      const results = await Promise.allSettled([
        reserveWorkOrderMaterials(A.actor, woA, `conc-a-${round}-${randomUUID()}`),
        reserveWorkOrderMaterials(A.actor, woB, `conc-b-${round}-${randomUUID()}`),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => String((r.reason as Error)?.message || r.reason));
      const heldNow = await held(A.tenantId, item, raw);
      const onHandNow = await onHand(A.tenantId, item, raw);

      assert.ok(ok <= 1, `round ${round}: two winners for one bucket (${ok})`);
      assert.ok(heldNow <= onHandNow, `round ${round}: over-allocation ${heldNow} > ${onHandNow}`);
      for (const message of errors) {
        assert.ok(
          /Yetersiz kullanılabilir stok/.test(message) || /could not serialize/i.test(message),
          `round ${round}: unexpected loser error: ${message}`,
        );
      }
      if (ok === 1) {
        roundsWithSuccess += 1;
        assert.equal(heldNow, 80, `round ${round}: exactly one work order's 80 is held`);
      }
      outcomes.push(`round ${round}: ${ok} winner(s), ${errors.length} refused [${errors.map((e) => e.slice(0, 40)).join(' | ')}], held ${heldNow}/${onHandNow}`);
    }
    assert.ok(roundsWithSuccess >= 1, `no round produced a winner:\n${outcomes.join('\n')}`);

    // Control: two concurrent reservations that both fit must both land.
    const controlItem = await mkItem(A.tenantId, 'CONC-OK-' + itemSku());
    await stock(A.tenantId, controlItem, raw, 200);
    const ctlA = await mkWorkOrder(A.tenantId, 'CONC-OK-A');
    const ctlB = await mkWorkOrder(A.tenantId, 'CONC-OK-B');
    await addMaterial(A.tenantId, ctlA, controlItem, raw, 80);
    await addMaterial(A.tenantId, ctlB, controlItem, raw, 80);
    const control = await Promise.allSettled([
      reserveWorkOrderMaterials(A.actor, ctlA, 'conc-ok-a-' + randomUUID()),
      reserveWorkOrderMaterials(A.actor, ctlB, 'conc-ok-b-' + randomUUID()),
    ]);
    assert.equal(
      control.filter((r) => r.status === 'fulfilled').length,
      2,
      `both fitting reservations must land: ${control.map((r) => (r.status === 'rejected' ? String((r.reason as Error).message) : 'ok')).join(' | ')}`,
    );
    assert.equal(await held(A.tenantId, controlItem, raw), 160);

    console.log(`PASS · concurrency: competing reservations never over-allocate (${outcomes.join('; ')}); control round lets two fitting reservations land`);
  }

  // ---- 6. same idempotency key racing --------------------------------------------------------
  {
    const item = await mkItem(A.tenantId, 'RACE-' + itemSku());
    await stock(A.tenantId, item, raw, 50);
    const wo = await mkWorkOrder(A.tenantId, 'RACE-1');
    await addMaterial(A.tenantId, wo, item, raw, 20);
    const key = 'race-' + randomUUID();

    const results = await Promise.allSettled([
      reserveWorkOrderMaterials(A.actor, wo, key),
      reserveWorkOrderMaterials(A.actor, wo, key),
    ]);
    const winners = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
    const losers = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String((r.reason as any)?.message || r.reason));

    assert.ok(winners.length >= 1, `at least one racing call must land: ${losers.join(' | ')}`);
    if (winners.length === 2) assert.equal(winners[0].value.id, winners[1].value.id, 'racing winners agree on the reservation');
    assert.equal(
      (await headers(wo)).filter((h: any) => h.idempotency_key === key).length,
      1,
      'the racing key produces exactly one header (UNIQUE (tenant_id, idempotency_key))',
    );
    assert.equal(Number((await materials(wo))[0].reserved_qty), 20, 'the material is reserved exactly once, never doubled');
    assert.ok(await held(A.tenantId, item, raw) <= 50, 'the racing key never over-allocates the bucket');
    for (const message of losers) {
      assert.ok(
        /duplicate key/i.test(message) || /could not serialize/i.test(message),
        `unexpected racing loser error: ${message}`,
      );
    }
    console.log(
      `PASS · idempotency race: ${winners.length}/2 landed, 1 header, reserved once; loser reported [${losers.map((m) => m.slice(0, 60)).join(' | ') || 'none'}]`,
    );
  }

  await db.end();
  await (sql as any).end?.();
  console.log(
    'PASS · reservation integrity: over-reservation blocked by schema + atomic refusal, idempotency replay/collision/short-key, release arithmetic and bucket freeing, tenant isolation of reserve and release with tenant-scoped keys, concurrent same-bucket reservations never over-allocate',
  );
}

let skuCounter = 0;
function itemSku(): string {
  skuCounter += 1;
  return `R${skuCounter}${randomUUID().slice(0, 6)}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
