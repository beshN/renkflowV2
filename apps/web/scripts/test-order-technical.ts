/** End-to-end domain test, using the runner's isolated PostgreSQL only. */
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
    rejectTechnicalRevision,
    refreshTechnicalDraft,
  } = await import("../lib/features/orders/technical.server");
  const { requireCommercialApproval } =
    await import("../lib/features/orders/quote-file.server");
  const { withTransaction } = await import("../lib/db");
  const { emptyFoy } = await import("../lib/features/foy/types");
  const { reviseQuote } = await import("../lib/features/sales/quotes.server");
  const [t] =
    await db`INSERT INTO tenants(name,slug) VALUES('Technical pilot',${"technical-" + randomUUID()}) RETURNING id`;
  const [u] =
    await db`INSERT INTO users(name,email) VALUES('Technical owner',${randomUUID() + "@test.invalid"}) RETURNING id`;
  const [w] =
    await db`INSERT INTO users(name,email) VALUES('Technical worker',${randomUUID() + "@test.invalid"}) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t.id},${u.id},'owner'),(${t.id},${w.id},'worker')`;
  const actor = { tenantId: t.id, userId: u.id, role: "owner" as const },
    worker = { tenantId: t.id, userId: w.id, role: "worker" as const };
  const cmd = (action: string, data: any, a = actor) =>
    productionCommand(a, { commandId: randomUUID(), action, data });
  const [customer] =
    await db`INSERT INTO customers(tenant_id,full_name) VALUES(${t.id},'Pilot customer') RETURNING id`;
  const warehouses: Record<string, string> = {};
  for (const type of ["RAW", "WIP", "FINISHED", "REUSABLE_REMNANTS"]) {
    const [x] =
      await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type) VALUES(${t.id},${type},${type},${type}) RETURNING id`;
    warehouses[type] = x.id;
  }
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
  const raw = await cmd("material.save", {
    sku: "170-R",
    name: "170 Makaslı Dere Boyasız",
    itemType: "raw_material",
    uom: "m",
    profileCode: "170",
    processedStates: ["boyasiz"],
    standardLengthMm: 6000,
    weightPerMeterKg: 3.482,
  });
  const finished = await cmd("material.save", {
    sku: "MAK",
    name: "Makaslı tente",
    itemType: "finished_good",
    uom: "adet",
    minStock: 0,
  });
  await cmd("center.save", {
    code: "ASSEMBLY",
    name: "Son hazırlık",
    parallelCapacity: 1,
    shiftStart: "08:00",
    shiftEnd: "17:00",
    workDays: [1, 2, 3, 4, 5],
  });
  await cmd("preferences.save", {
    kerfMm: 3,
    trimStartMm: 5,
    trimEndMm: 5,
    minimumRemnantMm: 500,
    cuttingConfirmed: true,
    emailEnabled: false,
    whatsappEnabled: false,
    productionLeadUserId: w.id,
  });
  const recipe = await cmd("recipe.save", {
    code: "MAK-PILOT",
    name: "Makaslı doğrulanmış pilot",
    version: 1,
    finishedItemId: finished.id,
    rules: [
      {
        itemId: profile.id,
        kind: "profile",
        uom: "m",
        quantityFormula: "quantity",
        cutLengthFormula: "widthMm",
      },
    ],
    operations: ["Kesim", "Boya", "Son hazırlık"].map((name) => ({
      name,
      workCenterCode: "ASSEMBLY",
      minutesFormula: "10",
      qualityChecks: [],
    })),
    limits: {
      minWidthMm: 2500,
      maxWidthMm: 15000,
      minProjectionMm: 1500,
      maxProjectionMm: 5000,
      minMountingHeightMm: 2200,
      maxMountingHeightMm: 4500,
    },
    examples: [4000, 5000].map((widthMm) => ({
      parameters: {
        widthMm,
        projectionMm: 3000,
        mountingHeightMm: 2800,
        quantity: 1,
      },
      expected: [{ itemId: profile.id, quantity: widthMm / 1000 }],
    })),
  });
  await cmd("recipe.publish", { id: recipe.id });
  await db`INSERT INTO product_family_recipes(tenant_id,recipe_code,family,created_by) VALUES(${t.id},'MAK-PILOT','makasli',${u.id})`;
  await db`INSERT INTO product_drilling_rules(tenant_id,family,profile_code,mechanism,version,source,rule,approved_by) VALUES(${t.id},'makasli','170','standard',1,'Synthetic verified drawing',${JSON.stringify({ reference: "start", face: "üst", diameterMm: 6, edgeDistanceMm: 10, offsetsMm: [100, 3900] })}::text::jsonb,${u.id})`;
  await cmd("stock.receive", {
    itemId: raw.id,
    warehouseId: warehouses.RAW,
    quantity: 1,
    lengthMm: 6000,
    color: "Boyasız",
    unitCost: 10,
    lotNumber: "RAW-PILOT",
  });
  await cmd("stock.receive", {
    itemId: profile.id,
    warehouseId: warehouses.RAW,
    quantity: 1,
    lengthMm: 7000,
    color: "RAL 7016 Mat",
    unitCost: 10,
    lotNumber: "PAINTED-PILOT",
  });
  const service = new PostgresQuotationService();
  const input: any = {
    idempotencyKey: randomUUID(),
    customerId: customer.id,
    customerName: "Pilot customer",
    currency: "TRY",
    discountPercent: 0,
    items: [
      {
        productName: "Makaslı tente",
        quantity: 2,
        unitPrice: 1000,
        discountPercent: 0,
        totalPrice: 2000,
        productConfiguration: {
          family: "makasli",
          recipeId: recipe.id,
          color: "RAL 7016 Mat",
          parameters: {
            widthMm: 4000,
            projectionMm: 3000,
            mountingHeightMm: 2800,
            motor: false,
            led: false,
            customParameters: {},
          },
        },
      },
    ],
  };
  let quote = await service.createQuotation(t.id, input, u.id);
  assert(quote.orderFileId, "the file exists when the quote is saved");
  const orderId = quote.orderFileId!;
  assert.equal(
    (await service.createQuotation(t.id, input, u.id)).orderFileId,
    orderId,
  );
  assert.equal(
    (await db`SELECT COUNT(*)::int AS n FROM orders WHERE tenant_id=${t.id}`)[0]
      .n,
    1,
  );
  assert.equal(
    Number(
      (await db`SELECT total_amount FROM orders WHERE id=${orderId}`)[0]
        .total_amount,
    ),
    0,
  );
  await assert.rejects(
    service.convertToOrder(t.id, quote.id, u.id, undefined, "owner"),
    /müşteri onayı/,
  );
  await assert.rejects(
    withTransaction((tx) => requireCommercialApproval(tx, t.id, orderId)),
    /Müşteri onayı/,
  );
  quote = await service.updateStatus(
    t.id,
    quote.id,
    "sent",
    quote.version,
    u.id,
    "owner",
  );
  quote = await service.updateStatus(
    t.id,
    quote.id,
    "accepted",
    quote.version,
    u.id,
    "owner",
  );
  assert.equal(
    (await service.convertToOrder(t.id, quote.id, u.id, quote.version, "owner"))
      .orderId,
    orderId,
  );
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM work_orders WHERE order_id=${orderId}`
    )[0].n,
    0,
    "approval is not production release",
  );
  const doc = emptyFoy("pergola");
  Object.assign(doc, {
    ral: "7016",
    finish: "Mat",
    assembly: "montajli",
    systems: [
      {
        railOuter: 400,
        projection: 300,
        height: null,
        bays: [{ ironInner: 379, railInner: 378 }],
      },
    ],
    cutList: [
      {
        profile: "Dere",
        kind: "dere",
        lengthCm: 400,
        widthCm: null,
        quantity: 2,
      },
    ],
  });
  doc.systems.push(structuredClone(doc.systems[0]));
  let attached = await attachTechnicalSheet(actor, orderId, {
    name: "pilot.pdf",
    doc,
    family: "makasli",
    expectedRevision: 0,
  });
  assert.equal(
    (
      await attachTechnicalSheet(actor, orderId, {
        name: "pilot-again.pdf",
        doc,
        family: "makasli",
        expectedRevision: 0,
      })
    ).id,
    attached.id,
  );
  let workspace = await technicalWorkspace(actor, orderId);
  assert.equal(workspace.revisions[0].technical.gutter.code, "170");
  assert.equal(workspace.revisions[0].plan.plan.summary.toPaint, 1);
  assert.deepEqual(workspace.revisions[0].technical.blockers, []);
  const refreshKey = randomUUID(),
    oldId = attached.id;
  attached = await refreshTechnicalDraft(
    actor,
    orderId,
    attached.id,
    refreshKey,
  );
  assert.equal(
    (await refreshTechnicalDraft(actor, orderId, oldId, refreshKey)).id,
    attached.id,
  );
  assert.equal(
    (
      await db`SELECT status FROM order_technical_revisions WHERE id=${oldId}`
    )[0].status,
    "superseded",
  );
  const approved = await approveTechnicalPlan(actor, orderId, attached.id);
  assert(approved.cutPlanId);
  assert.equal(
    (await approveTechnicalPlan(actor, orderId, attached.id)).replayed,
    true,
  );
  const [job] =
    await db`SELECT * FROM work_orders WHERE tenant_id=${t.id} AND order_id=${orderId}`;
  await db`UPDATE work_orders SET assigned_to=${w.id} WHERE id=${job.id}`;
  await db`UPDATE production_operations SET assigned_to=${w.id} WHERE work_order_id=${job.id}`;
  workspace = await technicalWorkspace(worker, orderId);
  assert.equal(workspace.quote, null);
  assert.equal(JSON.stringify(workspace).includes("unitCost"), false);
  const [plan] =
    await db`SELECT id,version,status FROM cutting_plans WHERE id=${approved.cutPlanId}`;
  const sources =
    await db`SELECT s.lot_id FROM cutting_plan_sources s JOIN stock_lots l ON l.id=s.lot_id AND l.tenant_id=s.tenant_id WHERE s.plan_id=${plan.id} ORDER BY CASE WHEN l.metadata->>'color'='RAL 7016 Mat' THEN 0 ELSE 1 END,s.lot_id`;
  assert.equal(sources.length, 2);
  const partial = await productionCommand(worker, {
    commandId: randomUUID(),
    action: "cut.complete",
    data: {
      id: plan.id,
      version: plan.version,
      confirmed: true,
      sourceLotIds: [sources[0].lot_id],
    },
  });
  assert.equal(partial.status, "approved");
  let [partialOp] =
    await db`SELECT * FROM production_operations WHERE work_order_id=${job.id} AND name='Son hazırlık'`;
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "operation",
    data: {
      operationId: partialOp.id,
      version: partialOp.version,
      action: "start",
    },
  });
  [partialOp] =
    await db`SELECT * FROM production_operations WHERE id=${partialOp.id}`;
  assert.equal(
    partialOp.status,
    "running",
    "a complete painted unit can proceed before the other bar is cut",
  );
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "operation",
    data: {
      operationId: partialOp.id,
      version: partialOp.version,
      action: "pause",
      reason: "Synthetic partial-flow check",
    },
  });

  await assert.rejects(
    productionCommand(actor, {
      commandId: randomUUID(),
      action: "cut.cancel",
      data: { id: plan.id, version: partial.version },
    }),
    /Gerçekleşmiş kesim/,
  );
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM production_parts WHERE work_order_id=${job.id} AND state='planned'`
    )[0].n,
    1,
  );
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM cutting_plan_sources WHERE plan_id=${plan.id} AND consumed=true`
    )[0].n,
    1,
  );
  await assert.rejects(
    productionCommand(worker, {
      commandId: randomUUID(),
      action: "cut.complete",
      data: {
        id: plan.id,
        version: partial.version,
        confirmed: true,
        sourceLotIds: [sources[0].lot_id],
      },
    }),
    /bekleyen/,
  );
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "cut.complete",
    data: {
      id: plan.id,
      version: partial.version,
      confirmed: true,
      sourceLotIds: [sources[1].lot_id],
    },
  });
  const [remnant] =
    await db`SELECT remaining_qty,metadata FROM stock_lots WHERE tenant_id=${t.id} AND warehouse_id=${warehouses.REUSABLE_REMNANTS} AND item_id=${raw.id}`;
  assert.equal(remnant.metadata.color, "Boyasız");
  assert(Number(remnant.remaining_qty) > 1);
  await assert.rejects(
    attachTechnicalSheet(actor, orderId, {
      name: "changed.pdf",
      doc: { ...doc, ral: "9005" },
      family: "makasli",
      expectedRevision: attached.revision,
    }),
    /kontrollü revizyon/,
  );
  await assert.rejects(
    productionCommand(worker, {
      commandId: randomUUID(),
      action: "tracking.create",
      data: { orderId },
    }),
    /kullanılamaz/,
  );
  // Daily paint progress, assembly, loading evidence and delivery share one approved version.
  const { recordPartProgress } =
    await import("../lib/features/manufacturing/parts.server");
  const { loadOrder } = await import("../lib/features/orders/loading.server");
  const beforeRevision = (
    await db`SELECT COUNT(*)::int AS n FROM stock_entries WHERE tenant_id=${t.id}`
  )[0].n;
  const revisedDoc = {
    ...doc,
    notes: ["Bölme notu teknik kontrolde doğrulandı"],
  };
  const changed = await attachTechnicalSheet(actor, orderId, {
    name: "controlled.pdf",
    doc: revisedDoc,
    family: "makasli",
    expectedRevision: attached.revision,
    revisionReason: "Doğrulanan bölme notu güncellendi",
  });
  assert.equal(
    (
      await db`SELECT status FROM order_technical_revisions WHERE id=${attached.id}`
    )[0].status,
    "blocked",
  );
  await assert.rejects(
    approveTechnicalPlan(worker, orderId, changed.id),
    /yetkiniz/,
  );
  await approveTechnicalPlan(actor, orderId, changed.id);
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM stock_entries WHERE tenant_id=${t.id}`
    )[0].n,
    beforeRevision,
    "same parts revision makes no stock entry",
  );
  assert.equal(
    (
      await db`SELECT technical_revision_id FROM work_orders WHERE id=${job.id}`
    )[0].technical_revision_id,
    changed.id,
  );
  const unresolved = await attachTechnicalSheet(actor, orderId, {
    name: "new-cut.pdf",
    doc: { ...revisedDoc, cutList: [{ ...doc.cutList[0], lengthCm: 410 }] },
    family: "makasli",
    expectedRevision: changed.revision,
    revisionReason: "Ek kesim için teknik inceleme",
  });
  await assert.rejects(
    approveTechnicalPlan(actor, orderId, unresolved.id),
    /yeniden kesim/,
  );
  await rejectTechnicalRevision(actor, orderId, unresolved.id);
  assert.equal(
    (
      await db`SELECT status FROM order_technical_revisions WHERE id=${changed.id}`
    )[0].status,
    "approved",
  );
  const [part] =
    await db`SELECT * FROM production_parts WHERE work_order_id=${job.id} AND target_color IS NOT NULL`;
  assert.equal(part.state, "paint_waiting");
  const paint = {
    commandId: randomUUID(),
    workOrderId: job.id,
    technicalRevisionId: changed.id,
    itemId: part.item_id,
    lengthMm: Number(part.length_mm),
    targetColor: part.target_color,
    quantity: 1,
    action: "paint.send",
  };
  await assert.rejects(
    recordPartProgress(worker, { ...paint, technicalRevisionId: attached.id }),
    /Teknik sürüm değişti/,
  );
  await recordPartProgress(worker, paint);
  assert.equal((await recordPartProgress(worker, paint)).replayed, true);
  let [op] =
    await db`SELECT * FROM production_operations WHERE work_order_id=${job.id} AND name='Son hazırlık'`;
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "operation",
    data: { operationId: op.id, version: op.version, action: "start" },
  });
  [op] = await db`SELECT * FROM production_operations WHERE id=${op.id}`;
  await assert.rejects(
    productionCommand(worker, {
      commandId: randomUUID(),
      action: "operation",
      data: {
        operationId: op.id,
        version: op.version,
        action: "complete",
        quantity: 2,
      },
    }),
    /Boyadan gelmeyen/,
  );
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "operation",
    data: {
      operationId: op.id,
      version: op.version,
      action: "complete",
      quantity: 1,
    },
  });
  assert.equal(
    Number(
      (
        await db`SELECT consumed_qty FROM work_order_materials WHERE work_order_id=${job.id} AND item_id=${profile.id}`
      )[0].consumed_qty,
    ),
    4,
    "the painted unit consumes its actual painted card",
  );
  assert.equal(
    Number(
      (
        await db`SELECT consumed_qty FROM work_order_materials WHERE work_order_id=${job.id} AND item_id=${raw.id}`
      )[0].consumed_qty,
    ),
    0,
    "pieces still at the painter are not assembled",
  );
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM production_parts WHERE work_order_id=${job.id} AND state='assembled'`
    )[0].n,
    1,
  );
  await recordPartProgress(worker, {
    ...paint,
    commandId: randomUUID(),
    action: "paint.return",
  });
  [op] = await db`SELECT * FROM production_operations WHERE id=${op.id}`;
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "operation",
    data: { operationId: op.id, version: op.version, action: "start" },
  });
  [op] = await db`SELECT * FROM production_operations WHERE id=${op.id}`;
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "operation",
    data: {
      operationId: op.id,
      version: op.version,
      action: "complete",
      quantity: 1,
    },
  });
  assert.equal(
    (await db`SELECT status FROM orders WHERE id=${orderId}`)[0].status,
    "ready_for_shipment",
  );
  const [photo] =
    await db`INSERT INTO production_files(tenant_id,work_order_id,created_by,name,mime,body) VALUES(${t.id},${job.id},${w.id},'load.jpg','image/jpeg',${Buffer.from("synthetic evidence fixture")}) RETURNING id`;
  const load = {
    commandId: randomUUID(),
    orderId,
    technicalRevisionId: changed.id,
    lines: [{ workOrderId: job.id, quantity: 1 }],
    photos: [`/api/v1/production/files/${t.id}/${photo.id}`],
    checkedIds: ["product"],
    vehiclePlate: "TEST",
  };
  await assert.rejects(
    loadOrder(worker, { ...load, checkedIds: [] }),
    /tamlık/,
  );
  await assert.rejects(
    loadOrder(worker, { ...load, technicalRevisionId: randomUUID() }),
    /teknik sürüm/,
  );
  const loaded = await loadOrder(worker, load);
  assert.equal((await loadOrder(worker, load)).replayed, true);
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM production_shipments WHERE order_id=${orderId}`
    )[0].n,
    1,
  );
  const [shipment] =
    await db`SELECT * FROM production_shipments WHERE id=${loaded.shipments[0].id}`;
  assert.deepEqual(shipment.photos, load.photos);
  assert.equal(shipment.technical_revision_id, changed.id);
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "shipment.delivered",
    data: { id: shipment.id, version: shipment.version },
  });
  assert.notEqual(
    (await db`SELECT status FROM orders WHERE id=${orderId}`)[0].status,
    "completed",
  );
  const secondLoad = await loadOrder(worker, {
    ...load,
    commandId: randomUUID(),
  });
  const [secondShipment] =
    await db`SELECT * FROM production_shipments WHERE id=${secondLoad.shipments[0].id}`;
  await productionCommand(worker, {
    commandId: randomUUID(),
    action: "shipment.delivered",
    data: { id: secondShipment.id, version: secondShipment.version },
  });
  assert.equal(
    (await db`SELECT status FROM orders WHERE id=${orderId}`)[0].status,
    "completed",
  );
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM installations WHERE order_id=${orderId}`
    )[0].n,
    1,
  );
  // Existing direct 3D selections reuse the sole published standard without a second configuration form.
  await cmd("stock.receive", {
    itemId: profile.id,
    warehouseId: warehouses.RAW,
    quantity: 1,
    lengthMm: 6000,
    color: "RAL 7016 Mat",
    unitCost: 10,
    lotNumber: "STANDARD-BRIDGE",
  });
  const { DEFAULT_AWNING } =
    await import("../lib/features/awning/configuration");
  const model = {
    ...DEFAULT_AWNING,
    widthMm: 4000,
    projectionMm: 3000,
    mountingHeightMm: 2800,
    bodyName: "RAL 7016 Mat",
  };
  let modelQuote = await service.createQuotation(
    t.id,
    {
      ...input,
      idempotencyKey: randomUUID(),
      items: [
        {
          productName: "Makaslı tente",
          quantity: 1,
          unitPrice: 1234,
          discountPercent: 0,
          totalPrice: 1234,
          awningConfiguration: model,
        },
      ],
    } as any,
    u.id,
  );
  modelQuote = await service.updateStatus(
    t.id,
    modelQuote.id,
    "sent",
    modelQuote.version,
    u.id,
    "owner",
  );
  modelQuote = await service.updateStatus(
    t.id,
    modelQuote.id,
    "accepted",
    modelQuote.version,
    u.id,
    "owner",
  );
  const modelOrderId = modelQuote.orderFileId!,
    singleDoc = {
      ...doc,
      systems: [doc.systems[0]],
      cutList: [{ ...doc.cutList[0], quantity: 1 }],
    };
  const modelRevision = await attachTechnicalSheet(actor, modelOrderId, {
    name: "standard.pdf",
    doc: singleDoc,
    family: "makasli",
    expectedRevision: 0,
  });
  assert.equal(
    (
      await db`SELECT product_configuration FROM order_items WHERE order_id=${modelOrderId}`
    )[0].product_configuration,
    null,
    "preview does not bind a permanent standard",
  );
  const modelView = await technicalWorkspace(actor, modelOrderId);
  assert.deepEqual(modelView.revisions[0].technical.blockers, []);
  assert.equal(
    modelView.revisions[0].technical.awnings[0].mountingHeightMm,
    2800,
  );
  await approveTechnicalPlan(actor, modelOrderId, modelRevision.id);
  const [modelLine] =
    await db`SELECT product_configuration,unit_price FROM order_items WHERE order_id=${modelOrderId}`;
  assert.equal(modelLine.product_configuration.recipeId, recipe.id);
  assert.equal(
    Number(modelLine.unit_price),
    1234,
    "technical release keeps the agreed price",
  );
  const draftQuote = await service.createQuotation(
    t.id,
    { ...input, idempotencyKey: randomUUID() },
    u.id,
  );
  await service.deleteQuotation(t.id, draftQuote.id);
  assert.equal(
    (await db`SELECT id FROM orders WHERE id=${draftQuote.orderFileId}`).length,
    0,
    "an untouched provisional file is deleted with its draft quote",
  );
  // Missing physical distribution cannot be converted to a purchase quantity or zero waste.
  const [unknown] =
    await db`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,metadata) VALUES(${t.id},${profile.id},${warehouses.RAW},'UNKNOWN',220,220,'{"color":"RAL 7016 Mat"}') RETURNING id`;
  const { planCutListFromDoc } =
    await import("../lib/features/manufacturing/cut-list.server");
  const uncertain = await planCutListFromDoc(actor, { doc, family: "makasli" });
  assert.equal(uncertain.plan.summary.wastePercent, null);
  assert.equal(uncertain.plan.groups[0].buy, null);
  assert(uncertain.stockProblems.length);
  assert.equal(
    Number(
      (await db`SELECT remaining_qty FROM stock_lots WHERE id=${unknown.id}`)[0]
        .remaining_qty,
    ),
    220,
  );
  console.log(
    "PASS: one quote file, customer approval, versioned sheet, 170 rule, raw-to-paint cutting, reservation, worker completion, raw remnant, repeat safety and unknown lengths",
  );
  await db.end();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
