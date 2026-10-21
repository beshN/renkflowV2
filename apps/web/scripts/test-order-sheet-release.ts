/**
 * A firm that has written no product recipes, never confirmed its saw values and is short of stock
 * still takes an order from quote to finished product: the notes are warnings the owner
 * acknowledges, the work order is built from the order sheet, and cutting waits for the bars.
 */
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
  const { PostgresQuotationService } =
    await import("../lib/features/quotations/postgres.service");
  const { productionCommand } =
    await import("../lib/features/manufacturing/platform.service");
  const {
    attachTechnicalSheet,
    technicalWorkspace,
    approveTechnicalPlan,
    planTechnicalCut,
  } = await import("../lib/features/orders/technical.server");
  const { TECHNICAL_WARNINGS, technicalIssues } =
    await import("../lib/features/orders/technical");
  const { emptyFoy } = await import("../lib/features/foy/types");
  const [t] =
    await db`INSERT INTO tenants(name,slug) VALUES('Sheet release',${"sheet-" + randomUUID()}) RETURNING id`;
  const [u] =
    await db`INSERT INTO users(name,email) VALUES('Sheet owner',${randomUUID() + "@test.invalid"}) RETURNING id`;
  const [w] =
    await db`INSERT INTO users(name,email) VALUES('Sheet worker',${randomUUID() + "@test.invalid"}) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t.id},${u.id},'owner'),(${t.id},${w.id},'worker')`;
  const actor = { tenantId: t.id, userId: u.id, role: "owner" as const },
    worker = { tenantId: t.id, userId: w.id, role: "worker" as const };
  const cmd = (action: string, data: any, a: any = actor) =>
    productionCommand(a, { commandId: randomUUID(), action, data });
  const [customer] =
    await db`INSERT INTO customers(tenant_id,full_name) VALUES(${t.id},'Sheet customer') RETURNING id`;
  // Only a raw-material warehouse and one profile card: no recipe, work centre or other warehouse.
  const [raw] =
    await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type) VALUES(${t.id},'RAW','Depo','RAW') RETURNING id`;
  const profile = await cmd("material.save", {
    sku: "170-P",
    name: "170 Makaslı Dere",
    itemType: "raw_material",
    uom: "m",
    profileCode: "170",
    processedStates: ["boyali"],
    standardLengthMm: 6000,
    weightPerMeterKg: 3.482,
  });
  await cmd("stock.receive", {
    itemId: profile.id,
    warehouseId: raw.id,
    quantity: 1,
    lengthMm: 6000,
    color: "RAL 7016 Mat",
    unitCost: 10,
    lotNumber: "SHEET-1",
  });

  const service = new PostgresQuotationService();
  let quote = await service.createQuotation(
    t.id,
    {
      idempotencyKey: randomUUID(),
      customerId: customer.id,
      customerName: "Sheet customer",
      currency: "TRY",
      discountPercent: 0,
      items: [
        {
          productName: "Makaslı tente",
          quantity: 2,
          unitPrice: 1000,
          discountPercent: 0,
          totalPrice: 2000,
          widthMm: 9000,
          projectionMm: 5000,
          mountingHeightMm: 3000,
        },
      ],
    } as any,
    u.id,
  );
  const orderId = quote.orderFileId!;
  // The customer approves on the spot: a draft is accepted (and sent) in one step.
  quote = await service.updateStatus(t.id, quote.id, "accepted", quote.version, u.id, "owner");
  assert.equal(quote.status, "accepted");
  assert.equal((await db`SELECT provisional FROM orders WHERE id=${orderId}`)[0].provisional, false);
  await service.convertToOrder(t.id, quote.id, u.id, quote.version, "owner");

  // The sheet: one system, two 400 cm gutters; the quote said two products of 9 m.
  const doc = emptyFoy("pergola");
  Object.assign(doc, {
    ral: "7016",
    finish: "Mat",
    assembly: "demonte",
    systems: [
      {
        railOuter: 400,
        projection: 300,
        height: null,
        bays: [{ ironInner: 379, railInner: 378 }],
      },
    ],
    cutList: [
      { profile: "Dere", kind: "dere", lengthCm: 400, widthCm: null, quantity: 2 },
    ],
  });
  const attached = await attachTechnicalSheet(actor, orderId, {
    name: "sheet.pdf",
    doc,
    family: "makasli",
    expectedRevision: 0,
  });
  let workspace = await technicalWorkspace(actor, orderId);
  const issues = technicalIssues(workspace.revisions[0].technical);
  assert.deepEqual(issues.blockers, [], "nothing here stops production");
  for (const warning of [
    TECHNICAL_WARNINGS.recipe,
    TECHNICAL_WARNINGS.stock,
    TECHNICAL_WARNINGS.estimate,
    TECHNICAL_WARNINGS.quoteMeasures,
    TECHNICAL_WARNINGS.drilling,
  ])
    assert(issues.warnings.includes(warning), warning);

  await assert.rejects(
    approveTechnicalPlan(actor, orderId, attached.id),
    /Uyarıları gördüğünüzü işaretleyip/,
    "warnings are seen before release",
  );
  await assert.rejects(
    approveTechnicalPlan(worker, orderId, attached.id, { acknowledgeWarnings: true }),
    /yetkiniz yok/,
  );
  const released = await approveTechnicalPlan(actor, orderId, attached.id, {
    acknowledgeWarnings: true,
  });
  assert.equal(released.waitingForStock, true);
  assert.equal(released.cutPlanId, null);
  assert.equal(
    (await approveTechnicalPlan(actor, orderId, attached.id, { acknowledgeWarnings: true })).replayed,
    true,
  );

  const [job] = await db`SELECT * FROM work_orders WHERE tenant_id=${t.id} AND order_id=${orderId}`;
  assert(job.recipe_id, "the job points to the firm's from-sheet recipe");
  const [sheetRecipe] = await db`SELECT code,status FROM production_recipes WHERE id=${job.recipe_id}`;
  assert.deepEqual({ ...sheetRecipe }, { code: "FOY-MAKASLI", status: "archived" });
  assert.equal(Number(job.planned_qty), 1, "the sheet's one system, not the quote's two");
  assert.equal(job.technical_revision_id, attached.id);
  assert.deepEqual(
    job.bom_snapshot.cuts.map((c: any) => [c.itemId, c.lengthMm, c.quantity]),
    [[profile.id, 4000, 2]],
  );
  assert.deepEqual(
    (await db`SELECT name FROM production_operations WHERE work_order_id=${job.id} ORDER BY position`).map((o: any) => o.name),
    ["Kesim", "Boya", "Son hazırlık"],
  );
  assert.deepEqual(
    (await db`SELECT warehouse_type FROM warehouses WHERE tenant_id=${t.id} ORDER BY warehouse_type`).map((r: any) => r.warehouse_type),
    ["FINISHED", "RAW", "REUSABLE_REMNANTS", "WIP"],
  );
  assert.equal((await db`SELECT status FROM orders WHERE id=${orderId}`)[0].status, "preparing_materials");
  const [revision] = await db`SELECT technical FROM order_technical_revisions WHERE id=${attached.id}`;
  assert.deepEqual(revision.technical.acknowledged.warnings, issues.warnings);
  workspace = await technicalWorkspace(actor, orderId);
  assert.equal(workspace.cutPlan, null);
  assert.equal(workspace.jobs.length, 1);

  await assert.rejects(planTechnicalCut(actor, orderId, randomUUID()), /Stok yetersiz/);
  await cmd("stock.receive", {
    itemId: profile.id,
    warehouseId: raw.id,
    quantity: 1,
    lengthMm: 6000,
    color: "RAL 7016 Mat",
    unitCost: 10,
    lotNumber: "SHEET-2",
  });
  const planned = await planTechnicalCut(actor, orderId, randomUUID());
  assert(planned.cutPlanId);
  assert.equal(
    (await db`SELECT COUNT(*)::int AS n FROM production_parts WHERE work_order_id=${job.id}`)[0].n,
    2,
    "approving the cut later still tracks every piece",
  );
  await assert.rejects(planTechnicalCut(actor, orderId, randomUUID()), /Kesim bekleyen iş yok/);

  const [plan] = await db`SELECT id,version FROM cutting_plans WHERE id=${planned.cutPlanId}`;
  const sources = await db`SELECT lot_id FROM cutting_plan_sources WHERE plan_id=${plan.id}`;
  await cmd("cut.complete", {
    id: plan.id,
    version: plan.version,
    confirmed: true,
    sourceLotIds: sources.map((s: any) => s.lot_id),
  });
  const stages = await db`SELECT name,status,completed_qty FROM production_operations WHERE work_order_id=${job.id} ORDER BY position`;
  assert.equal(stages[0].status, "done", "cut recorded from the physical cut");
  assert.equal(stages[1].status, "done", "painted stock needs no paint step");
  let [final] = await db`SELECT * FROM production_operations WHERE work_order_id=${job.id} AND name='Son hazırlık'`;
  await cmd("operation", { operationId: final.id, version: final.version, action: "start" });
  [final] = await db`SELECT * FROM production_operations WHERE id=${final.id}`;
  await cmd("operation", { operationId: final.id, version: final.version, action: "complete", quantity: 1 });
  const [done] = await db`SELECT status,produced_qty FROM work_orders WHERE id=${job.id}`;
  assert.equal(Number(done.produced_qty), 1, "the product is finished without a drilling rule");
  console.log("order sheet release: ok");
  await db.end();
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
