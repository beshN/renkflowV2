/** End-to-end domain test, using the runner's isolated PostgreSQL only. */
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { localTestDatabaseURL } from "./local-test-database";
const findings: string[] = [];
let step = "Korumalar";
function pass() {
  console.log(`PASS · ${step}`);
}
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = randomUUID() + randomUUID();
  process.env.NATIVE_INVENTORY_ENABLED = "1";
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, "127.0.0.1", "yalnız loopback");
  assert.equal(url.pathname, "/renkflow_test");
  assert.equal(url.search, "");
  const db = postgres(process.env.DATABASE_URL, {
    host: "127.0.0.1",
    port: Number(url.port),
    onnotice: () => {},
  });
  try {
    assert.equal(
      (await db`SELECT current_database() AS name`)[0].name,
      "renkflow_test",
    );
    const required = [
      "tenants",
      "users",
      "tenant_members",
      "customers",
      "product_family_recipes",
      "product_drilling_rules",
      "production_recipes",
      "manufacturing_preferences",
      "production_parts",
      "production_units",
      "production_operations",
      "production_files",
      "production_shipments",
      "shipments",
      "shipment_items",
      "cutting_plans",
      "cutting_plan_sources",
      "cutting_losses",
      "stock_lots",
      "stock_balances",
      "stock_entries",
      "stock_entry_lines",
      "work_orders",
      "inventory_items",
      "warehouses",
      "work_centers",
      "orders",
    ];
    for (const table of required)
      assert(
        (await db`SELECT to_regclass(${"public." + table}) AS name`)[0].name,
        `Eksik tablo: ${table}; prova migration çalıştırmaz`,
      );
    pass();
    const { PostgresQuotationService } =
      await import("../lib/features/quotations/postgres.service");
    const { productionCommand } =
      await import("../lib/features/manufacturing/platform.service");
    const { attachTechnicalSheet, approveTechnicalPlan } =
      await import("../lib/features/orders/technical.server");
    const { requireCommercialApproval } =
      await import("../lib/features/orders/quote-file.server");
    const { withTransaction } = await import("../lib/db");
    const { emptyFoy } = await import("../lib/features/foy/types");

    step = "Fixture";
    findings.push(
      "INSERT tenants/users/tenant_members: izole TEST kimliği ve üyelik bootstrap servisi yok",
      "INSERT customers: mevcut teknik testin izole TEST müşterisi",
    );
    const [t] =
      await db`INSERT INTO tenants(name,slug) VALUES('TEST FIXTURE · makaslı e2e',${"test-fixture-makasli-" + randomUUID()}) RETURNING id`;
    const [u] =
      await db`INSERT INTO users(name,email) VALUES('TEST owner',${randomUUID() + "@example.invalid"}) RETURNING id`;
    const [w] =
      await db`INSERT INTO users(name,email) VALUES('TEST üretim lideri',${randomUUID() + "@example.invalid"}) RETURNING id`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t.id},${u.id},'owner'),(${t.id},${w.id},'worker')`;
    const actor = { tenantId: t.id, userId: u.id, role: "owner" as const },
      worker = { tenantId: t.id, userId: w.id, role: "worker" as const };
    const cmd = (action: string, data: any, a = actor) =>
      productionCommand(a, { commandId: randomUUID(), action, data });
    const [customer] =
      await db`INSERT INTO customers(tenant_id,full_name) VALUES(${t.id},'TEST customer') RETURNING id`;
    const warehouses: Record<string, string> = {};
    for (const type of ["RAW", "WIP", "FINISHED", "REUSABLE_REMNANTS"]) {
      const x = await cmd("warehouse.save", {
        code: type,
        name: "TEST " + type,
        type,
      });
      warehouses[type] = x.id;
    }
    const profile = await cmd("material.save", {
      sku: "170-P",
      name: "TEST 170 Makaslı Dere",
      itemType: "raw_material",
      uom: "m",
      profileCode: "170",
      processedStates: ["boyali"],
      standardLengthMm: 6000,
      weightPerMeterKg: 3.482,
    });
    const raw = await cmd("material.save", {
      sku: "170-R",
      name: "TEST 170 Makaslı Dere Boyasız",
      itemType: "raw_material",
      uom: "m",
      profileCode: "170",
      processedStates: ["boyasiz"],
      standardLengthMm: 6000,
      weightPerMeterKg: 3.482,
    });
    const finished = await cmd("material.save", {
      sku: "FOY-MAKASLI",
      name: "TEST Makaslı tente",
      itemType: "finished_good",
      uom: "adet",
      minStock: 0,
    });
    await cmd("center.save", {
      code: "ASSEMBLY",
      name: "TEST Son hazırlık",
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
    const { importFamilyRecipe } =
      await import("../lib/features/products/recipe-template.service");
    const imported = await importFamilyRecipe(actor, {
      family: "makasli",
      code: "TEST-MAK-PILOT",
      name: "TEST sentetik makaslı reçete",
      finishedItemId: finished.id,
      dryRun: false,
      text: [
        "satir_turu;kod;ad;tur;birim;miktar_formulu;kesim_boyu_formulu;kosul;varsayilan;en_az;en_cok",
        "malzeme;170-P;TEST profil;profil;m;quantity;widthMm;;;;",
        "operasyon;ASSEMBLY;TEST hazırlık;;;10;;;;;",
        "sinir;en;;;;;;;;2500;15000",
        "sinir;acilim;;;;;;;;1500;5000",
        "sinir;yukseklik;;;;;;;;2200;4500",
      ].join("\n"),
    });
    assert(
      imported.ok && "recipe" in imported,
      "aile reçetesi servisle içe aktarılmalı",
    );
    const recipe = await cmd("recipe.save", {
      editRevision: 1,
      code: "TEST-MAK-PILOT",
      name: "TEST sentetik makaslı reçete",
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
    await cmd("recipe.publish", {
      id: recipe.id,
      editRevision: recipe.edit_revision,
    });
    await cmd("recipe.save", {
      code: "FOY-MAKASLI",
      name: "TEST föy üretim reçetesi",
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
      operations: [
        {
          name: "TEST hazırlık",
          workCenterCode: "ASSEMBLY",
          minutesFormula: "10",
          qualityChecks: [],
        },
      ],
      limits: {
        minWidthMm: 2500,
        maxWidthMm: 15000,
        minProjectionMm: 1500,
        maxProjectionMm: 5000,
        minMountingHeightMm: 2200,
        maxMountingHeightMm: 4500,
      },
      examples: [],
    });
    findings.push(
      "INSERT product_drilling_rules: delme kuralı yazma servisi yok; TEST sentetik geometri, gerçek reçete doğrulaması değil",
    );
    await db`INSERT INTO product_drilling_rules(tenant_id,family,profile_code,mechanism,version,source,rule,approved_by) VALUES(${t.id},'makasli','170','standard',1,'TEST synthetic drawing',${JSON.stringify({ reference: "start", face: "üst", diameterMm: 6, edgeDistanceMm: 10, offsetsMm: [100, 3900] })}::text::jsonb,${u.id})`;
    await cmd("stock.receive", {
      itemId: raw.id,
      warehouseId: warehouses.RAW,
      quantity: 1,
      lengthMm: 6000,
      color: "Boyasız",
      unitCost: 10,
      lotNumber: "TEST-RAW",
    });
    await cmd("stock.receive", {
      itemId: profile.id,
      warehouseId: warehouses.RAW,
      quantity: 1,
      lengthMm: 7000,
      color: "RAL 7016 Mat",
      unitCost: 10,
      lotNumber: "TEST-PAINTED",
    });
    pass();
    step = "Hazırlık";
    const { pilotReadinessReport } =
      await import("../lib/features/manufacturing/pilot-readiness.service");
    const report = await pilotReadinessReport(actor);
    for (const finding of report.findings)
      findings.push(`${finding.severity}: ${finding.message}`);
    assert.deepEqual(
      report.findings.filter((f) => f.severity === "blocker"),
      [],
      "Hazırlık: servislerle oluşturulan fixture 0 blocker döndürmeli; servis açığı raw UPDATE ile aşılmaz",
    );
    assert.equal(report.empty, false);
    pass();
    step = "Teklif";
    const service = new PostgresQuotationService();
    const input: any = {
      idempotencyKey: randomUUID(),
      customerId: customer.id,
      customerName: "TEST customer",
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
    const replay = await service.createQuotation(t.id, input, u.id);
    assert.equal(replay.id, quote.id);
    assert.equal(replay.orderFileId, orderId);
    assert.equal(
      (
        await db`SELECT COUNT(*)::int AS n FROM orders WHERE tenant_id=${t.id}`
      )[0].n,
      1,
    );
    assert.equal(
      Number(
        (await db`SELECT total_amount FROM orders WHERE id=${orderId}`)[0]
          .total_amount,
      ),
      0,
    );
    pass();
    step = "Onay";
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
      (
        await service.convertToOrder(
          t.id,
          quote.id,
          u.id,
          quote.version,
          "owner",
        )
      ).orderId,
      orderId,
    );
    assert.equal(
      (
        await db`SELECT COUNT(*)::int AS n FROM work_orders WHERE order_id=${orderId}`
      )[0].n,
      0,
      "approval is not production release",
    );
    pass();
    step = "İş emri";
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
    const attached = await attachTechnicalSheet(actor, orderId, {
      name: "TEST sentetik föy",
      doc,
      family: "makasli",
      expectedRevision: 0,
    });
    await assert.rejects(
      approveTechnicalPlan(worker, orderId, attached.id),
      /yetkiniz/,
    );
    const approved = await approveTechnicalPlan(actor, orderId, attached.id);
    assert(approved.cutPlanId);
    const jobs =
      await db`SELECT * FROM work_orders WHERE tenant_id=${t.id} AND order_id=${orderId}`;
    assert.equal(jobs.length, 1);
    const job = jobs[0];
    assert.equal(job.cut_plan_id, approved.cutPlanId);
    if (job.assigned_to !== w.id) {
      findings.push(
        "Üretim liderine otomatik atama yok; raw UPDATE yerine operation.assign deneniyor",
      );
      for (const op of await db`SELECT * FROM production_operations WHERE tenant_id=${t.id} AND work_order_id=${job.id}`)
        await cmd("operation.assign", {
          operationId: op.id,
          version: op.version,
          assignedTo: w.id,
        });
    }
    assert.equal(
      (
        await db`SELECT assigned_to FROM work_orders WHERE tenant_id=${t.id} AND id=${job.id}`
      )[0].assigned_to,
      w.id,
      "kesim için iş emri worker'a atanmalı",
    );
    assert.equal(job.production_item_id, finished.id);
    pass();
    step = "Kesim";
    const [plan] =
      await db`SELECT * FROM cutting_plans WHERE tenant_id=${t.id} AND id=${approved.cutPlanId}`;
    const sources =
      await db`SELECT lot_id FROM cutting_plan_sources WHERE tenant_id=${t.id} AND plan_id=${plan.id}`;
    assert.equal(sources.length, 2);
    await cmd(
      "cut.complete",
      {
        id: plan.id,
        version: plan.version,
        confirmed: true,
        sourceLotIds: sources.map((s) => s.lot_id),
      },
      worker,
    );
    const lots =
      await db`SELECT * FROM stock_lots WHERE tenant_id=${t.id} AND id=ANY(${sources.map((s) => s.lot_id)}::uuid[])`;
    assert.equal(lots.length, 2);
    for (const lot of lots) {
      assert.equal(lot.status, "consumed");
      assert.equal(Number(lot.remaining_qty), 0);
    }
    const remnants =
      await db`SELECT * FROM stock_lots WHERE tenant_id=${t.id} AND warehouse_id=${warehouses.REUSABLE_REMNANTS}`;
    assert.equal(remnants.length, 2);
    for (const remnant of remnants) {
      const lengthMm = Number(remnant.length_m) * 1000;
      assert(lengthMm >= 500);
      assert.equal(Number(remnant.remaining_qty) * 1000, lengthMm);
      assert.equal(remnant.metadata.isRemnant, true);
    }
    const losses =
      await db`SELECT length_mm,weight_kg FROM cutting_losses WHERE tenant_id=${t.id} AND plan_id=${plan.id}`;
    assert.equal(losses.length, 2);
    for (const loss of losses) {
      assert(Number(loss.length_mm) > 0);
      assert(Number(loss.weight_kg) > 0);
      assert(
        Math.abs(
          Number(loss.weight_kg) - (Number(loss.length_mm) / 1000) * 3.482,
        ) < 0.00001,
      );
    }
    findings.push(
      "Artık lot length_m alanında metre saklanıyor; açıkça mm'ye çevrildi. Hurda length_mm ve weight_kg ayrı alanlarda.",
    );
    pass();
    step = "Üretim";
    const { recordPartProgress } =
      await import("../lib/features/manufacturing/parts.server");
    const [part] =
      await db`SELECT * FROM production_parts WHERE tenant_id=${t.id} AND work_order_id=${job.id} AND target_color IS NOT NULL`;
    assert(part, "boyasız profil boya akışına girmeli");
    const paint = {
      workOrderId: job.id,
      technicalRevisionId: attached.id,
      itemId: part.item_id,
      lengthMm: Number(part.length_mm),
      targetColor: part.target_color,
      quantity: 1,
    };
    for (const action of ["paint.send", "paint.return"])
      await recordPartProgress(worker, {
        ...paint,
        action,
        commandId: randomUUID(),
      });
    const operations =
      await db`SELECT * FROM production_operations WHERE tenant_id=${t.id} AND work_order_id=${job.id} ORDER BY position`;
    assert.equal(operations.length, 3);
    for (const initial of operations) {
      let [op] =
        await db`SELECT * FROM production_operations WHERE tenant_id=${t.id} AND id=${initial.id}`;
      if (op.status === "done") {
        findings.push(`${op.name}: kesim/boya servisi operasyonu tamamladı`);
        continue;
      }
      await cmd(
        "operation",
        { operationId: op.id, version: op.version, action: "start" },
        worker,
      );
      [op] =
        await db`SELECT * FROM production_operations WHERE tenant_id=${t.id} AND id=${op.id}`;
      await cmd(
        "operation",
        {
          operationId: op.id,
          version: op.version,
          action: "complete",
          quantity: 2,
        },
        worker,
      );
    }
    const [done] =
      await db`SELECT status,produced_qty FROM work_orders WHERE tenant_id=${t.id} AND id=${job.id}`;
    assert.equal(done.status, "done");
    assert.equal(Number(done.produced_qty), 2);
    assert.equal(
      (
        await db`SELECT count(*)::int AS n FROM production_units WHERE tenant_id=${t.id} AND work_order_id=${job.id}`
      )[0].n,
      2,
    );
    pass();
    step = "Mamul stok";
    const finishedBalance = async () => {
      const rows =
        await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${t.id} AND item_id=${finished.id} AND warehouse_id=${warehouses.FINISHED}`;
      assert.equal(rows.length, 1);
      return Number(rows[0].on_hand_qty);
    };
    assert.equal(await finishedBalance(), 2, "FINISHED tam 2 adet");
    const manufacture =
      await db`SELECT l.* FROM stock_entries e JOIN stock_entry_lines l ON l.stock_entry_id=e.id AND l.tenant_id=e.tenant_id WHERE e.tenant_id=${t.id} AND e.entry_type='MANUFACTURE' AND e.reference_type='work_order' AND e.reference_id=${job.id}`;
    assert.equal(manufacture.length, 3);
    for (const id of [profile.id, raw.id]) {
      const lines = manufacture.filter((l) => l.item_id === id);
      assert.equal(lines.length, 1);
      assert.equal(lines[0].warehouse_id, warehouses.WIP);
      assert.equal(lines[0].uom, "m");
      assert.equal(Number(lines[0].quantity_delta), -4, "profil WIP -4 metre");
    }
    const finishedLines = manufacture.filter((l) => l.item_id === finished.id);
    assert.equal(finishedLines.length, 1);
    assert.equal(finishedLines[0].warehouse_id, warehouses.FINISHED);
    assert.equal(finishedLines[0].uom, "adet");
    assert.equal(Number(finishedLines[0].quantity_delta), 2);
    pass();
    step = "Sevkiyat";
    const { loadOrder } = await import("../lib/features/orders/loading.server");
    findings.push(
      "INSERT production_files: TEST sentetik yükleme kanıtı; fiziksel fotoğraf doğrulanmadı",
    );
    const [photo] =
      await db`INSERT INTO production_files(tenant_id,work_order_id,created_by,name,mime,body) VALUES(${t.id},${job.id},${w.id},'TEST-load.jpg','image/jpeg',${Buffer.from("TEST synthetic evidence fixture")}) RETURNING id`;
    const load = {
      commandId: randomUUID(),
      orderId,
      technicalRevisionId: attached.id,
      lines: [{ workOrderId: job.id, quantity: 2 }],
      photos: [`/api/v1/production/files/${t.id}/${photo.id}`],
      checkedIds: ["product"],
      vehiclePlate: "TEST",
    };
    await assert.rejects(
      loadOrder(worker, { ...load, checkedIds: [] }),
      /tamlık/,
    );
    const loaded = await loadOrder(worker, load);
    assert.equal(loaded.shipments.length, 1);
    assert.equal(await finishedBalance(), 0);
    const issues =
      await db`SELECT l.* FROM stock_entries e JOIN stock_entry_lines l ON l.stock_entry_id=e.id AND l.tenant_id=e.tenant_id WHERE e.tenant_id=${t.id} AND e.entry_type='MATERIAL_ISSUE' AND e.reference_type='shipment' AND l.item_id=${finished.id}`;
    assert.equal(issues.length, 1);
    assert.equal(issues[0].uom, "adet");
    assert.equal(issues[0].warehouse_id, warehouses.FINISHED);
    assert.equal(Number(issues[0].quantity_delta), -2);
    const shipments =
      await db`SELECT id FROM shipments WHERE tenant_id=${t.id} AND order_id=${orderId}`;
    assert.equal(shipments.length, 1);
    const items =
      await db`SELECT quantity FROM shipment_items WHERE tenant_id=${t.id} AND shipment_id=${shipments[0].id} AND order_id=${orderId}`;
    assert.equal(items.length, 1);
    assert.equal(Number(items[0].quantity), 2);
    await assert.rejects(
      loadOrder(worker, {
        ...load,
        commandId: randomUUID(),
        lines: [{ workOrderId: job.id, quantity: 1 }],
      }),
      /aş|kalan|tamam|hazır|yüklen/i,
    );
    assert.equal(await finishedBalance(), 0);
    const [shipment] =
      await db`SELECT * FROM production_shipments WHERE tenant_id=${t.id} AND id=${loaded.shipments[0].id}`;
    await cmd(
      "shipment.delivered",
      { id: shipment.id, version: shipment.version },
      worker,
    );
    assert.equal(
      (
        await db`SELECT status FROM orders WHERE tenant_id=${t.id} AND id=${orderId}`
      )[0].status,
      "completed",
    );
    pass();
  } finally {
    await db.end({ timeout: 5 });
  }
}
main()
  .then(() => {
    for (const finding of findings) console.log(`BULGU · ${finding}`);
    process.exit(0);
  })
  .catch((error) => {
    for (const finding of findings) console.log(`BULGU · ${finding}`);
    console.error(`FAIL · ${step}`, error);
    process.exit(1);
  });
