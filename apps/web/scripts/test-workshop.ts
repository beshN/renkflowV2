import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { localTestDatabaseURL } from "./local-test-database";
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = "integration-test-secret-local-only-1234567890";
  process.env.NATIVE_INVENTORY_ENABLED = "1";
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS name`)[0].name,
    "renkflow_test",
  );
  const { productionCommand } =
    await import("../lib/features/manufacturing/platform.service");
  const service = await import("../lib/features/manufacturing/workshop.server");
  const [t] =
    await db`INSERT INTO tenants(name,slug) VALUES('Workshop test',${randomUUID()}) RETURNING id`;
  const [owner] =
    await db`INSERT INTO users(name,email) VALUES('Owner',${randomUUID() + "@test.invalid"}) RETURNING id`;
  const [worker] =
    await db`INSERT INTO users(name,email) VALUES('Worker',${randomUUID() + "@test.invalid"}) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t.id},${owner.id},'owner'),(${t.id},${worker.id},'worker')`;
  const a = { tenantId: t.id, userId: owner.id, role: "owner" as const },
    w = { tenantId: t.id, userId: worker.id, role: "worker" as const };
  const cmd = (action: string, data: any) =>
    productionCommand(a, { commandId: randomUUID(), action, data });
  const warehouses: Record<string, string> = {};
  for (const type of ["RAW", "REJECTED"]) {
    const [row] =
      await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type) VALUES(${t.id},${type},${type},${type}) RETURNING id`;
    warehouses[type] = row.id;
  }
  const item = await cmd("material.save", {
    sku: "108",
    name: "108 40x60",
    itemType: "raw_material",
    uom: "m",
    profileCode: "108",
    sizeLabel: "40x60",
    processedStates: ["boyasiz"],
    standardLengthMm: 6000,
    weightPerMeterKg: 0.897,
  });
  const [o] =
    await db`INSERT INTO orders(tenant_id,order_number,customer_name,status,quantity,total_amount) VALUES(${t.id},'WORKSHOP-1','Customer','in_production',1,1000) RETURNING id`;
  const [job] =
    await db`INSERT INTO work_orders(tenant_id,title,category,order_id,assigned_to,created_by,source_warehouse_id) VALUES(${t.id},'Product','production',${o.id},${worker.id},${owner.id},${warehouses.RAW}) RETURNING id`;
  const payload = {
    commandId: randomUUID(),
    orderId: o.id,
    workOrderId: job.id,
    itemId: item.id,
    quantity: 4,
    description: "Üretim için profil gerekli",
    photos: [],
  };
  const request = await service.createWorkshopRequest(w, payload);
  assert.equal(
    (await service.createWorkshopRequest(w, payload)).id,
    request.id,
  );
  await assert.rejects(
    service.createWorkshopRequest(w, { ...payload, quantity: 5 }),
    /anahtarı/,
  );
  let data = await service.workshopOverview(a);
  let r = data.requests.find((r: any) => r.id === request.id)!;
  await assert.rejects(
    service.approveWorkshopRequest(w, request.id, r.version),
    (e: any) => e.status === 403,
  );
  await service.approveWorkshopRequest(a, request.id, r.version);
  const supplier = await cmd("procurement.supplier.save", { name: "Supplier" });
  const purchase = await service.purchaseWorkshopNeed(a, {
    commandId: randomUUID(),
    purchase: {
      supplierId: supplier.id,
      currency: "TRY",
      lines: [
        {
          itemId: item.id,
          warehouseId: warehouses.RAW,
          quantity: 1,
          lengthMm: 6000,
          color: "Boyasız",
          unitPrice: 10,
          requestLineId: r.lines[0].id,
          allowExcess: true,
        },
      ],
    },
  });
  const po = await cmd("procurement.purchase.transition", {
    id: purchase.id,
    version: purchase.version,
    status: "submitted",
  });
  const [line] =
    await db`SELECT id FROM purchase_order_lines WHERE purchase_order_id=${po.id}`;
  const check = {
    checked: true,
    commandId: randomUUID(),
    receipt: {
      purchaseOrderId: po.id,
      version: po.version,
      notes: "Fiziksel kontrol",
      lines: [
        {
          lineId: line.id,
          acceptedQty: 4,
          rejectedQty: 2,
          color: "Boyasız",
          rejectedColor: "RAL 9005 Mat",
          rejectedWarehouseId: warehouses.REJECTED,
          rejectionReason: "Hasarlı profil",
          bars: [
            { lengthMm: 4000, count: 1, disposition: "accepted" },
            { lengthMm: 2000, count: 1, disposition: "rejected" },
          ],
        },
      ],
    },
    photos: [],
  };
  const inspection = await service.checkReceipt(w, check);
  assert.equal((await service.checkReceipt(w, check)).id, inspection.id);
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM stock_entries WHERE tenant_id=${t.id}`
    )[0].n,
    0,
    "physical checking never adds stock",
  );
  await assert.rejects(
    service.approveReceiptInspection(w, inspection.id, 1),
    (e: any) => e.status === 403,
  );
  const accepted = await service.approveReceiptInspection(a, inspection.id, 1);
  assert(accepted.receiptId);
  assert.equal(
    (await service.approveReceiptInspection(a, inspection.id, 1)).replayed,
    true,
  );
  const lots =
    await db`SELECT remaining_qty,length_m,warehouse_id,weight_kg,metadata FROM stock_lots WHERE tenant_id=${t.id} ORDER BY length_m DESC`;
  assert.equal(lots.length, 2);
  assert.equal(Number(lots[0].length_m), 4);
  assert.equal(Number(lots[1].length_m), 2);
  assert.equal(lots[0].warehouse_id, warehouses.RAW);
  assert.equal(lots[1].warehouse_id, warehouses.REJECTED);
  assert.equal(
    lots[1].metadata.color,
    "RAL 9005 Mat",
    "quarantined stock keeps its actual wrong color",
  );
  assert.equal(Number(lots[0].weight_kg), 4 * 0.897);
  assert.equal(
    (await db`SELECT status FROM purchase_orders WHERE id=${po.id}`)[0].status,
    "partially_received",
  );
  assert.equal(
    (await db`SELECT status FROM material_requests WHERE id=${request.id}`)[0]
      .status,
    "closed",
    "only the actual accepted need is fulfilled",
  );
  assert.equal(
    Number(
      (
        await db`SELECT received_qty FROM purchase_order_lines WHERE id=${line.id}`
      )[0].received_qty,
    ),
    4,
  );
  const workerData = await service.workshopOverview(w);
  assert.equal(workerData.canApprove, false);
  assert.equal(JSON.stringify(workerData).includes("unit_price"), false);
  const { technicalWorkspace } =
    await import("../lib/features/orders/technical.server");
  const legacy = await technicalWorkspace(w, o.id);
  assert.equal(
    legacy.legacy,
    true,
    "existing jobs remain visible without inventing a technical revision",
  );
  assert.equal(legacy.jobs[0].id, job.id);
  assert.equal(legacy.revisions.length, 0);
  console.log(
    "PASS: worker need, approval, linked purchase, physical-only check, distinct final acceptance, actual mixed lengths, quarantine, partial delivery and idempotency",
  );
  await db.end();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
