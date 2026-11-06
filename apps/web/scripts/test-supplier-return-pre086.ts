/**
 * Local PG only (renkflow_test). Behaviour before migration 086 is applied with db:deploy.
 *
 * The integration runner applies every backend migration, so the two 086 tables are renamed out
 * of the way for this script and renamed back in finally. It runs in its own process, so the
 * schema-guard cache starts empty and sees the tables as missing.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { localTestDatabaseURL } from "./local-test-database";

const HIDDEN = [
  ["supplier_return_lines", "supplier_return_lines__pre086_hidden"],
  ["supplier_returns", "supplier_returns__pre086_hidden"],
] as const;
const PENDING = "Tedarikçi iadesi için veritabanı güncellemesi bekleniyor";

async function main() {
  process.env.AUTH_SECRET = "supplier-return-pre086-local-test-placeholder-only";
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = "1";
  const db = postgres(localTestDatabaseURL(), { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS n`)[0].n,
    "renkflow_test",
  );
  const renamed: Array<readonly [string, string]> = [];
  const t = randomUUID(),
    userId = randomUUID();
  const actor = { tenantId: t, userId, role: "owner" as const };
  const key = () => randomUUID();
  const refused = (promise: Promise<unknown>, status: number, message?: string) =>
    assert.rejects(
      promise,
      (e: { status: number; message: string }) =>
        e.status === status && (!message || e.message === message),
    );
  let sql: any;
  try {
    for (const [table, hidden] of HIDDEN) {
      const [row] =
        await db`SELECT to_regclass(${"public." + table}) IS NOT NULL AS present`;
      if (!row.present) continue;
      await db.unsafe(`ALTER TABLE public.${table} RENAME TO ${hidden}`);
      renamed.push([table, hidden]);
    }
    const s =
      await import("../lib/features/manufacturing/supplier-return.service");
    const p = await import("../lib/features/manufacturing/purchasing.service");
    const { supplierScorecards } =
      await import("../lib/features/stock/depth.server");
    const { openRecord } = await import("../lib/features/records/registry");
    const { withTransaction } = await import("../lib/db/transaction");
    ({ sql } = await import("../lib/db"));
    const command = (action: string, data: unknown) =>
      withTransaction(({ sql: tx }) =>
        p.executeProcurement(tx, actor, action, data, key()),
      );

    await db`INSERT INTO tenants(id,name,slug)VALUES(${t},'Supplier return pre-086 test',${t})`;
    await db`INSERT INTO users(id,name,email)VALUES(${userId},'Pre-086 test',${userId + "@test.local"})`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role)VALUES(${t},${userId},'owner')`;
    const [supplier] =
      await db`INSERT INTO suppliers(tenant_id,name)VALUES(${t},'Pre-086 supplier')RETURNING id`;
    const [raw] =
      await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type)VALUES(${t},'RAW','Raw','RAW')RETURNING id`;
    const [rejected] =
      await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type)VALUES(${t},'REJECT','Red','REJECTED')RETURNING id`;
    const [item] =
      await db`INSERT INTO inventory_items(tenant_id,sku,name,unit,item_type,stock_uom)VALUES(${t},'PRE086','Pre-086 vida','adet','raw_material','adet')RETURNING id`;

    assert.equal(await s.supplierReturnsReady(), false, "tables are hidden");

    // Existing flow: a receipt with a rejected line can still be reversed before 086.
    const order: any = await command("procurement.purchase.create", {
      supplierId: supplier.id,
      lines: [
        { itemId: item.id, warehouseId: raw.id, quantity: 10, unitPrice: 2 },
      ],
    });
    const submitted: any = await command("procurement.purchase.transition", {
      id: order.id,
      version: order.version,
      status: "submitted",
    });
    const [poLine] =
      await db`SELECT id FROM purchase_order_lines WHERE tenant_id=${t} AND purchase_order_id=${order.id}`;
    const receipt: any = await command("procurement.receipt.create", {
      purchaseOrderId: order.id,
      version: submitted.version,
      lines: [
        {
          lineId: poLine.id,
          acceptedQty: 4,
          rejectedQty: 2,
          rejectedWarehouseId: rejected.id,
          rejectionReason: "Hasarlı numune",
        },
      ],
    });
    const [rejectedLine] =
      await db`SELECT id FROM goods_receipt_lines WHERE tenant_id=${t} AND goods_receipt_id=${receipt.id}`;

    // Existing flow: the supplier scorecard still answers, with no returns.
    const cards = await supplierScorecards(actor);
    assert.deepEqual(cards.returns, []);
    assert.equal(cards.suppliers.length, 1);
    assert.equal(cards.suppliers[0].supplierId, supplier.id);

    // Return endpoints: empty list, clear 409 for everything else; permissions still come first.
    assert.deepEqual(await s.supplierReturns(actor), []);
    await refused(s.supplierReturns(actor, randomUUID()), 409, PENDING);
    await refused(
      s.createSupplierReturn(actor, {
        sourceLineId: rejectedLine.id,
        quantity: 1,
        idempotencyKey: key(),
      }),
      409,
      PENDING,
    );
    await refused(
      s.transitionSupplierReturn(actor, randomUUID(), { status: "sent" }),
      409,
      PENDING,
    );
    await refused(
      s.createSupplierReturn(
        { ...actor, role: "worker" },
        { sourceLineId: rejectedLine.id, quantity: 1, idempotencyKey: key() },
      ),
      403,
    );
    await refused(
      openRecord(sql, actor, "supplier_return", randomUUID()),
      404,
    );

    const [poNow] =
      await db`SELECT version FROM purchase_orders WHERE tenant_id=${t} AND id=${order.id}`;
    await command("procurement.receipt.reverse", {
      id: receipt.id,
      version: poNow.version,
      reason: "Pre-086 tersleme",
    });
    assert.equal(
      (
        await db`SELECT status FROM goods_receipts WHERE tenant_id=${t} AND id=${receipt.id}`
      )[0].status,
      "reversed",
    );
    assert.equal(
      (
        await db`SELECT to_regclass('public.supplier_returns') IS NULL AS missing`
      )[0].missing,
      true,
      "nothing recreated the tables",
    );
    console.log(
      "PASS · supplier return before 086: receipt with rejected line reversed; scorecard returns []; list []; get/create/transition 409 with pending message; 403 before schema state; record 404",
    );
  } finally {
    try {
      await db.begin(async (tx) => {
        // Test DB only: immutable ledger/audit fixtures are removed, never production data.
        await tx`SET LOCAL session_replication_role = replica`;
        for (const table of [
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
          await tx`DELETE FROM ${tx(table)} WHERE tenant_id=${t}`;
        await tx`DELETE FROM tenants WHERE id=${t}`;
        await tx`DELETE FROM users WHERE id=${userId}`;
      });
    } finally {
      try {
        for (const [table, hidden] of renamed.reverse())
          await db.unsafe(`ALTER TABLE public.${hidden} RENAME TO ${table}`);
      } finally {
        await db.end();
        await sql?.end?.();
      }
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
