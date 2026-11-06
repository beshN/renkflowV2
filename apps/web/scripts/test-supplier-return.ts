/** Local PG only. All fixtures are removed in finally, including failed runs. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { localTestDatabaseURL } from "./local-test-database";

async function main() {
  process.env.AUTH_SECRET = "supplier-return-local-test-placeholder-only";
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = "1";
  const db = postgres(localTestDatabaseURL(), { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS n`)[0].n,
    "renkflow_test",
  );
  const migration = readFileSync(
    "lib/db/migrations/086_supplier_returns.sql",
    "utf8",
  );
  await db.unsafe(migration);
  await db.unsafe(migration);
  const s =
    await import("../lib/features/manufacturing/supplier-return.service");
  const p = await import("../lib/features/manufacturing/purchasing.service");
  const { supplierScorecards } =
    await import("../lib/features/stock/depth.server");
  const { withTransaction } = await import("../lib/db/transaction");
  const { postStockEntry } =
    await import("../lib/features/manufacturing/inventory.service");
  const { sql } = await import("../lib/db");
  const t = randomUUID(),
    other = randomUUID(),
    userId = randomUUID(),
    officeId = randomUUID();
  const actor = { tenantId: t, userId, role: "owner" as const },
    foreign = { ...actor, tenantId: other };
  const office = { tenantId: t, userId: officeId, role: "office" as const };
  const key = () => randomUUID();
  const create = (
    sourceLineId: string,
    quantity: number,
    idempotencyKey = key(),
  ) =>
    s.createSupplierReturn(actor, { sourceLineId, quantity, idempotencyKey });
  const refused = (promise: Promise<unknown>, status: number) =>
    assert.rejects(promise, (e: { status: number }) => e.status === status);
  try {
    for (const id of [t, other])
      await db`INSERT INTO tenants(id,name,slug)VALUES(${id},'Supplier return test',${id})`;
    for (const id of [userId, officeId])
      await db`INSERT INTO users(id,name,email)VALUES(${id},'Return test',${id + "@test.local"})`;
    for (const id of [t, other])
      await db`INSERT INTO tenant_members(tenant_id,user_id,role)VALUES(${id},${userId},'owner')`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role)VALUES(${t},${officeId},'office')`;
    const [supplier] =
      await db`INSERT INTO suppliers(tenant_id,name)VALUES(${t},'Supplier test')RETURNING id`;
    const [raw] =
      await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type)VALUES(${t},'RAW','Raw','RAW')RETURNING id`;
    const [rejected] =
      await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type)VALUES(${t},'REJECT','Red','REJECTED')RETURNING id`;
    const fixtures: Array<{
      lineId: string;
      receiptId: string;
      orderId: string;
      itemId: string;
      uom: string;
      lotId: string;
    }> = [];
    for (const uom of ["adet", "kg", "m"]) {
      const [item] =
        await db`INSERT INTO inventory_items(tenant_id,sku,name,unit,item_type,stock_uom)VALUES(${t},${uom},${"Test " + uom},${uom},'raw_material',${uom})RETURNING id`;
      const [po] =
        await db`INSERT INTO purchase_orders(tenant_id,purchase_order_number,supplier_id,status,currency)VALUES(${t},${key()},${supplier.id},'submitted','TRY')RETURNING id`;
      const [pol] =
        await db`INSERT INTO purchase_order_lines(tenant_id,purchase_order_id,item_id,warehouse_id,ordered_qty,received_qty,uom,position)VALUES(${t},${po.id},${item.id},${raw.id},10,0,${uom},0)RETURNING id`;
      const [receipt] =
        await db`INSERT INTO goods_receipts(tenant_id,receipt_number,purchase_order_id,status,idempotency_key)VALUES(${t},${key()},${po.id},'submitted',${key()})RETURNING id`;
      const [line] =
        await db`INSERT INTO goods_receipt_lines(tenant_id,goods_receipt_id,purchase_order_line_id,item_id,accepted_warehouse_id,rejected_warehouse_id,accepted_qty,rejected_qty,uom)VALUES(${t},${receipt.id},${pol.id},${item.id},${raw.id},${rejected.id},0,10,${uom})RETURNING id`;
      const [lot] =
        await db`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,length_m,metadata)VALUES(${t},${item.id},${rejected.id},${key()},10,10,${uom === "m" ? 10 : null},'{}')RETURNING id`;
      const entry = await postStockEntry(actor, {
        entryType: "MATERIAL_RECEIPT",
        idempotencyKey: key(),
        referenceType: "goods_receipt",
        referenceId: receipt.id,
        lines: [
          {
            itemId: item.id,
            warehouseId: rejected.id,
            lotId: lot.id,
            quantityDelta: 10,
            uom,
            metadata: { disposition: "rejected", purchaseOrderLineId: pol.id },
          },
        ],
      });
      await db`UPDATE goods_receipts SET stock_entry_id=${entry.id} WHERE tenant_id=${t} AND id=${receipt.id}`;
      fixtures.push({
        lineId: line.id,
        receiptId: receipt.id,
        orderId: po.id,
        itemId: item.id,
        uom,
        lotId: lot.id,
      });
    }
    const [a, k, m] = fixtures;
    await refused(create(a.lineId, 11), 409);
    await refused(create(a.lineId, 1.5), 400);
    await refused(
      s.createSupplierReturn(foreign, {
        sourceLineId: a.lineId,
        quantity: 1,
        idempotencyKey: key(),
      }),
      404,
    );
    await refused(
      s.createSupplierReturn(
        { ...actor, role: "worker" },
        { sourceLineId: a.lineId, quantity: 1, idempotencyKey: key() },
      ),
      403,
    );
    const idem = key(),
      draft = await create(a.lineId, 4, idem);
    assert.equal((await create(a.lineId, 4, idem)).id, draft.id);
    await refused(create(a.lineId, 3, idem), 409);
    assert.equal(
      (
        await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id=${t} AND reference_type='supplier_return'`
      )[0].n,
      0,
    );
    assert.equal(
      Number(
        (
          await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${t} AND item_id=${a.itemId} AND warehouse_id=${rejected.id}`
        )[0].on_hand_qty,
      ),
      10,
    );
    await refused(
      s.transitionSupplierReturn(actor, draft.id, { status: "closed" }),
      409,
    );
    await refused(
      s.transitionSupplierReturn(office, draft.id, { status: "sent" }),
      403,
    );
    await refused(
      s.transitionSupplierReturn(foreign, draft.id, { status: "sent" }),
      404,
    );
    assert.equal((await s.supplierReturns(foreign)).length, 0);
    assert.equal((await p.procurementReceipts(foreign)).length, 0);
    await refused(s.supplierReturns(foreign, draft.id), 404);
    const raced = await Promise.allSettled([
      create(a.lineId, 4),
      create(a.lineId, 4),
    ]);
    assert.equal(
      raced.filter((x) => x.status === "fulfilled").length,
      1,
      "concurrent drafts cannot over-reserve",
    );
    await refused(create(a.lineId, 3), 409);
    await s.transitionSupplierReturn(actor, draft.id, { status: "sent" });
    await Promise.all([
      s.transitionSupplierReturn(actor, draft.id, { status: "sent" }),
      s.transitionSupplierReturn(actor, draft.id, { status: "sent" }),
    ]);
    await s.transitionSupplierReturn(actor, draft.id, { status: "closed" });
    await s.transitionSupplierReturn(actor, draft.id, { status: "closed" });
    await refused(
      s.transitionSupplierReturn(actor, draft.id, { status: "sent" }),
      409,
    );
    assert.equal(
      (
        await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id=${t} AND reference_type='supplier_return' AND reference_id=${draft.id}`
      )[0].n,
      1,
    );
    assert.equal(
      Number(
        (
          await db`SELECT remaining_qty FROM stock_lots WHERE tenant_id=${t} AND id=${a.lotId}`
        )[0].remaining_qty,
      ),
      6,
    );
    assert.equal(
      Number(
        (
          await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${t} AND item_id=${a.itemId} AND warehouse_id=${rejected.id}`
        )[0].on_hand_qty,
      ),
      6,
    );
    await refused(
      withTransaction(({ sql: tx }) =>
        p.executeProcurement(
          tx,
          actor,
          "procurement.receipt.reverse",
          { id: a.receiptId, version: 1, reason: "Test reversal" },
          key(),
        ),
      ),
      409,
    );
    const kg = await create(k.lineId, 2.5);
    await s.transitionSupplierReturn(actor, kg.id, { status: "sent" });
    const meters = await create(m.lineId, 10);
    await db`UPDATE stock_lots SET remaining_qty=0,status='consumed' WHERE tenant_id=${t} AND id=${m.lotId}`;
    await refused(
      s.transitionSupplierReturn(actor, meters.id, { status: "sent" }),
      409,
    );
    assert.equal(
      (await s.supplierReturns(actor, meters.id))[0].status,
      "draft",
      "failed send rolls back",
    );
    await db`UPDATE stock_lots SET remaining_qty=10,status='available' WHERE tenant_id=${t} AND id=${m.lotId}`;
    await s.transitionSupplierReturn(actor, meters.id, { status: "sent" });
    const cards = await supplierScorecards(actor);
    assert.deepEqual(
      cards.returns.map((r) => [r.uom, r.documentCount, r.quantity]).sort(),
      [
        ["adet", 1, 4],
        ["kg", 1, 2.5],
        ["m", 1, 10],
      ],
    );
    const [event] =
      await db`SELECT count(*)::int AS n FROM activity_logs WHERE tenant_id=${t} AND entity_type='supplier_return' AND entity_id=${draft.id}`;
    assert.equal(event.n, 3, "one audit event per successful state change");
    console.log(
      "PASS · supplier return: migration twice; quantity and concurrent draft reservations; forward-only states; role and tenant isolation; draft has no movement; sent/closed issue exactly once; source lots and balances; receipt reversal blocked; raw counts/quantities separated by adet, kg, m; audit trail",
    );
  } finally {
    try {
      await db.begin(async (tx) => {
        // Test DB only: immutable ledger/audit fixtures are removed, never production data.
        await tx`SET LOCAL session_replication_role = replica`;
        for (const table of [
          "supplier_return_lines",
          "supplier_returns",
          "stock_entry_lines",
          "stock_entries",
          "stock_balances",
          "stock_lots",
          "goods_receipt_lines",
          "goods_receipts",
          "purchase_order_lines",
          "purchase_orders",
          "suppliers",
          "inventory_items",
          "warehouses",
          "activity_logs",
          "tenant_members",
        ])
          await tx`DELETE FROM ${tx(table)} WHERE tenant_id IN (${t},${other})`;
        await tx`DELETE FROM tenants WHERE id IN (${t},${other})`;
        await tx`DELETE FROM users WHERE id IN (${userId},${officeId})`;
      });
    } finally {
      await db.end();
      await (sql as any).end?.();
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
