/** Real stock tests, exclusively against the isolated local database. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import bcrypt from "bcryptjs";
async function main() {
  process.env.AUTH_SECRET =
    "warehouse-integration-local-test-secret-1234567890";
  process.env.DATABASE_URL =
    "postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test";
  process.env.NATIVE_INVENTORY_ENABLED = "1";
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS name`)[0].name,
    "renkflow_test",
  );
  await db.unsafe(
    readFileSync("lib/db/migrations/021_warehouse_barcodes.sql", "utf8"),
  );
  await db.unsafe(readFileSync("lib/db/migrations/031_stock_model.sql", "utf8"));
  const { productionCommand } =
    await import("../lib/features/manufacturing/platform.service");
  const { warehouseOverview, resolveLabel } =
    await import("../lib/features/warehouse/service");
  const [tenant] =
    await db`INSERT INTO tenants(name,slug)VALUES('Warehouse integration',${"warehouse-" + randomUUID()})RETURNING id`;
  const ownerEmail = randomUUID() + "@example.invalid",
    password = "Warehouse-Test-Local-Only-2026!";
  const [owner] =
    await db`INSERT INTO users(name,email,password,email_verified)VALUES('Warehouse owner',${ownerEmail},${await bcrypt.hash(password, 12)},now())RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role)VALUES(${tenant.id},${owner.id},'owner')`;
  const actor = {
    tenantId: tenant.id,
    userId: owner.id,
    role: "owner" as const,
  };
  const cmd = (action: string, data: any, id = randomUUID()) =>
    productionCommand(actor, { action, commandId: id, data });
  const raw = await cmd("warehouse.save", {
    code: "RAW",
    name: "Raw warehouse",
    type: "RAW",
  });
  const raw2 = await cmd("warehouse.save", {
    code: "RAW2",
    name: "Raw second",
    type: "RAW",
  });
  const wip = await cmd("warehouse.save", {
    code: "WIP",
    name: "Production",
    type: "WIP",
  });
  const part = await cmd("material.save", {
    sku: "SCR",
    name: "Warehouse screws",
    itemType: "consumable",
    uom: "adet",
  });
  const profile = await cmd("material.save", {
    sku: "PRF",
    name: "Physical profile",
    itemType: "raw_material",
    uom: "m",
    standardLengthMm: 6000,
    weightPerMeterKg: 1.2,
  });
  const a = await cmd("warehouse.location.create", {
    warehouseId: raw.id,
    code: "A-01",
    name: "Raw shelf A",
  });
  const b = await cmd("warehouse.location.create", {
    warehouseId: raw.id,
    code: "B-01",
    name: "Raw shelf B",
  });
  const c = await cmd("warehouse.location.create", {
    warehouseId: raw2.id,
    code: "C-01",
    name: "Raw shelf C",
  });
  const [unassigned] =
    await db`SELECT id FROM warehouse_locations WHERE tenant_id=${tenant.id} AND warehouse_id=${raw.id} AND location_type='unassigned'`;
  const [wipLoc] =
    await db`SELECT id FROM warehouse_locations WHERE tenant_id=${tenant.id} AND warehouse_id=${wip.id} AND location_type='unassigned'`;
  const { postStockEntry } = await import("../lib/features/manufacturing/inventory.service");
  // Historical aggregate stock remains supported without inventing lot provenance.
  await postStockEntry(actor, {entryType:"MATERIAL_RECEIPT",idempotencyKey:randomUUID(),lines:[{itemId:part.id,warehouseId:raw.id,quantityDelta:100,uom:"adet",metadata:{}}]});
  const trackedPart = await cmd("material.save", {sku:"LOT-SCR",name:"Tracked screws",itemType:"consumable",uom:"adet"});
  await cmd("stock.receive", {
    itemId: trackedPart.id,
    warehouseId: raw.id,
    lotNumber: "SCREW",
    quantity: 100,
    lengthMm: 0,
    color: "",
    unitCost: 2,
  });
  await cmd("stock.receive", {
    itemId: profile.id,
    warehouseId: raw.id,
    lotNumber: "PROFILE",
    quantity: 2,
    lengthMm: 6000,
    color: "Beyaz",
    unitCost: 100,
  });
  const balance = async (item: string, loc: string) =>
    (
      await db`SELECT * FROM warehouse_location_balances WHERE tenant_id=${tenant.id} AND item_id=${item} AND location_id=${loc}`
    )[0];
  const move = async (
    item: string,
    source: string,
    target: string,
    q: number,
    extra: any = {},
    id = randomUUID(),
  ) =>
    cmd(
      "warehouse.transfer",
      {
        itemId: item,
        sourceId: source,
        targetId: target,
        quantity: q,
        version: (await balance(item, source)).version,
        note: "Integration transfer",
        ...extra,
      },
      id,
    );
  const [consumableLot] = await db`SELECT * FROM stock_lots WHERE tenant_id=${tenant.id} AND item_id=${trackedPart.id}`;
  await assert.rejects(()=>move(trackedPart.id,unassigned.id,a.id,60),/lot etiketini/);
  await move(trackedPart.id,unassigned.id,a.id,60,{lotId:consumableLot.id});
  const [child] = await db`SELECT * FROM stock_lots WHERE tenant_id=${tenant.id} AND metadata->>'parentLotId'=${consumableLot.id}`;
  assert.equal(Number(child.remaining_qty),60);
  assert.equal(Number((await db`SELECT remaining_qty FROM stock_lots WHERE id=${consumableLot.id}`)[0].remaining_qty),40);
  assert.equal(child.metadata.batchLotNumber,consumableLot.lot_number);
  assert.equal(child.location_id,a.id);
  await move(trackedPart.id,a.id,c.id,60,{lotId:child.id});
  assert.equal(Number((await balance(trackedPart.id,c.id)).quantity),60);
  console.log("PASS: consumable partial-lot transfer preserves batch lineage, balances and cross-warehouse trace");
  const first = await balance(part.id, unassigned.id);
  const transfer = {
    itemId: part.id,
    sourceId: unassigned.id,
    targetId: a.id,
    quantity: 60,
    version: first.version,
    note: "Put away",
  };
  const key = randomUUID();
  await cmd("warehouse.transfer", transfer, key);
  await cmd("warehouse.transfer", transfer, key);
  assert.equal(Number((await balance(part.id, a.id)).quantity), 60);
  assert.equal(Number((await balance(part.id, unassigned.id)).quantity), 40);
  assert.equal(
    Number(
      (
        await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${tenant.id} AND item_id=${part.id} AND warehouse_id=${raw.id}`
      )[0].on_hand_qty,
    ),
    100,
  );
  await assert.rejects(
    () => cmd("warehouse.transfer", { ...transfer, quantity: 1 }, key),
    /anahtarı/,
  );
  await assert.rejects(
    () => cmd("warehouse.transfer", transfer),
    /stoğu değişti/,
  );
  await assert.rejects(
    () => move(part.id, a.id, wipLoc.id, 1),
    /ilgili iş emrinden/,
  );
  await assert.rejects(() => move(part.id, a.id, b.id, 1.5), /tam sayı/);
  await assert.rejects(() => move(part.id, a.id, b.id, 61), /yeterli stok/);
  console.log(
    "PASS: put-away, replay, command mismatch, stale version, whole units, insufficient shelf stock and production boundary",
  );
  // Another tenant must not resolve or move this company's labels or shelves.
  const issued = await cmd("warehouse.label.issue", {
    kind: "location",
    id: a.id,
  });
  const repeat = await cmd("warehouse.label.issue", {
    kind: "location",
    id: a.id,
  });
  assert.equal(issued.code, repeat.code);
  assert.equal((await resolveLabel(actor, issued.code)).id, a.id);
  assert.equal(
    (
      await resolveLabel(
        actor,
        "https://renkflow.example/warehouse/scan?code=" + issued.code,
      )
    ).id,
    a.id,
  );
  await assert.rejects(
    () => resolveLabel({ ...actor, tenantId: randomUUID() }, issued.code),
    /bulunamadı/,
  );
  await assert.rejects(
    () => cmd("warehouse.label.issue", { kind: "product", id: a.id }),
    /bulunamadı/,
  );
  await assert.rejects(
    () =>
      productionCommand(
        { ...actor, role: "worker" },
        {
          commandId: randomUUID(),
          action: "warehouse.transfer",
          data: transfer,
        },
      ),
    /yetkiniz/,
  );
  const workerData = await warehouseOverview({ ...actor, role: "worker" });
  assert.ok(!JSON.stringify(workerData).includes("unitCost"));
  assert.ok(!JSON.stringify(workerData).includes("unit_cost"));
  const [lot] =
    await db`SELECT * FROM stock_lots WHERE tenant_id=${tenant.id} AND item_id=${profile.id} ORDER BY lot_number LIMIT 1`;
  await move(profile.id, unassigned.id, a.id, 6, { lotId: lot.id });
  assert.equal(
    (
      await db`SELECT location_id FROM stock_lots WHERE tenant_id=${tenant.id} AND id=${lot.id}`
    )[0].location_id,
    a.id,
  );
  await assert.rejects(
    () => move(profile.id, a.id, b.id, 3, { lotId: lot.id }),
    /tam boyuyla/,
  );
  await assert.rejects(() => move(profile.id, a.id, b.id, 1), /lot etiketini/);
  await db`UPDATE stock_lots SET status='reserved' WHERE tenant_id=${tenant.id} AND id=${lot.id}`;
  await assert.rejects(
    () => move(profile.id, a.id, b.id, 6, { lotId: lot.id }),
    /rezerve/,
  );
  await db`UPDATE stock_lots SET status='available' WHERE tenant_id=${tenant.id} AND id=${lot.id}`;
  await move(profile.id, a.id, c.id, 6, { lotId: lot.id });
  assert.equal(Number((await balance(profile.id, c.id)).quantity), 6);
  assert.equal(
    (
      await db`SELECT warehouse_id FROM stock_lots WHERE tenant_id=${tenant.id} AND id=${lot.id}`
    )[0].warehouse_id,
    raw2.id,
  );
  console.log(
    "PASS: stable barcode/QR identity, tenant/role isolation, full lot put-away and transfer, reservation and partial-cut guards",
  );
  const snapshot = await balance(part.id, a.id);
  const count = await cmd("warehouse.count.submit", {
    itemId: part.id,
    locationId: a.id,
    quantity: 58,
    version: snapshot.version,
    reason: "Blind physical count",
  });
  assert.equal(Number((await balance(part.id, a.id)).quantity), 60);
  await assert.rejects(
    () =>
      productionCommand(
        { ...actor, role: "office" },
        {
          commandId: randomUUID(),
          action: "warehouse.count.review",
          data: { id: count.id, approve: true, note: "Verified recount" },
        },
      ),
    /yönetici/,
  );
  await cmd("warehouse.count.review", {
    id: count.id,
    approve: true,
    note: "Verified recount",
  });
  assert.equal(Number((await balance(part.id, a.id)).quantity), 58);
  const stale = await cmd("warehouse.count.submit", {
    itemId: part.id,
    locationId: a.id,
    quantity: 58,
    version: (await balance(part.id, a.id)).version,
    reason: "Physical recount",
  });
  await move(part.id, a.id, b.id, 1);
  await assert.rejects(
    () =>
      cmd("warehouse.count.review", {
        id: stale.id,
        approve: true,
        note: "Approve stale",
      }),
    /stok değişti/,
  );
  await cmd("warehouse.count.review", {
    id: stale.id,
    approve: false,
    note: "Stock moved during review",
  });
  const pcount = await cmd("warehouse.count.submit", {
    itemId: profile.id,
    locationId: c.id,
    quantity: 5,
    version: (await balance(profile.id, c.id)).version,
    reason: "Profile discrepancy",
  });
  await assert.rejects(
    () =>
      cmd("warehouse.count.review", {
        id: pcount.id,
        approve: true,
        note: "Quantity differs",
      }),
    /lot veya mamul/,
  );
  console.log(
    "PASS: count is pending until manager approval; stale snapshots and profile adjustment are blocked",
  );
  const parallel = {
    itemId: part.id,
    sourceId: a.id,
    targetId: b.id,
    quantity: 1,
    version: (await balance(part.id, a.id)).version,
    note: "Concurrent transfer",
  };
  const races = await Promise.allSettled([
    cmd("warehouse.transfer", parallel),
    cmd("warehouse.transfer", parallel),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  // Both warehouse-level and location-level balances must still match exactly.
  const mismatches =
    await db`SELECT b.item_id,b.warehouse_id FROM stock_balances b LEFT JOIN LATERAL(SELECT COALESCE(SUM(x.quantity),0) AS quantity FROM warehouse_location_balances x JOIN warehouse_locations l ON l.id=x.location_id AND l.tenant_id=x.tenant_id WHERE x.tenant_id=b.tenant_id AND x.item_id=b.item_id AND l.warehouse_id=b.warehouse_id)s ON true WHERE b.tenant_id=${tenant.id} AND b.on_hand_qty<>s.quantity`;
  assert.equal(mismatches.length, 0);
  await db.unsafe(
    readFileSync("lib/db/migrations/021_warehouse_barcodes.sql", "utf8"),
  );
  assert.equal(Number((await balance(profile.id, c.id)).quantity), 6);
  writeFileSync(
    ".data/warehouse-test-fixture.json",
    JSON.stringify({
      ownerEmail,
      password,
      tenantId: tenant.id,
      ownerId: owner.id,
      partId: part.id,
      profileId: profile.id,
      aId: a.id,
      bId: b.id,
      locationCode: issued.code,
    }),
    { mode: 0o600 },
  );
  console.log(
    "PASS: concurrent transfer serialization, exact warehouse/shelf balance and repeat migration preservation",
  );
  await db.end();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
