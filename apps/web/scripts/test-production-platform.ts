/** Integration tests only on the isolated local test database. */
import assert from "node:assert/strict";
import postgres from "postgres";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID, createHmac } from "node:crypto";
import { localTestDatabaseURL } from "./local-test-database";
async function main() {
  process.env.AUTH_SECRET = "integration-test-secret-local-only-1234567890";
  process.env.DATABASE_URL =
    localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = "1";
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS name`)[0].name,
    "renkflow_test",
  );
  await db.unsafe(
    readFileSync("lib/db/migrations/014_production_platform.sql", "utf8"),
  );
  await db.unsafe(readFileSync("lib/db/migrations/015_procurement_workflows.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/016_quality_inspections.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/017_finance_workflows.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/018_workspace_notifications.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/019_workspace_views_cleanup.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/020_vercel_storage.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/023_intake_provenance.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/024_recipe_parameters.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/025_production_resources.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/026_production_analytics.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/027_quality_traceability.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/029_ai_suggestions.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/030_cutting_defaults.sql", "utf8"));
  await db.unsafe(readFileSync("lib/db/migrations/031_stock_model.sql", "utf8"));
  const { productionCommand, productionOverview, publicTracking, cutPlanSheet } =
    await import("../lib/features/manufacturing/platform.service");
  const { PostgresQuotationService } = await import(
    "../lib/features/quotations/postgres.service"
  );
  const { DEFAULT_AWNING } = await import(
    "../lib/features/awning/configuration"
  );
  const { approveIntake } = await import(
    "../lib/features/manufacturing/intake.service"
  );
  const [tenant] =
    await db`INSERT INTO tenants(name,slug)VALUES('Integration test',${"test-" + randomUUID()})RETURNING id`;
  const [user] =
    await db`INSERT INTO users(name,email)VALUES('Test operator',${randomUUID() + "@example.invalid"})RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role)VALUES(${tenant.id},${user.id},'owner')`;
  const actor = {
    tenantId: tenant.id,
    userId: user.id,
    role: "owner" as const,
  };
  const command = (action: string, data: any, id = randomUUID()) =>
    productionCommand(actor, { commandId: id, action, data });
  const profile = await command("material.save", {
      sku: "P",
      name: "TEST profile",
      itemType: "raw_material",
      uom: "m",
      standardLengthMm: 6000,
      weightPerMeterKg: 1.2,
    }),
    screw = await command("material.save", {
      sku: "S",
      name: "TEST screw",
      itemType: "consumable",
      uom: "adet",
      standardLengthMm: 0,
      weightPerMeterKg: 0,
    }),
    finished = await command("material.save", {
      sku: "F",
      name: "TEST awning",
      itemType: "finished_good",
      uom: "adet",
      standardLengthMm: 0,
      weightPerMeterKg: 0,
    });
  const warehouses: any = {};
  for (const type of ["RAW", "WIP", "FINISHED", "REUSABLE_REMNANTS"])
    warehouses[type] = await command("warehouse.save", {
      code: type,
      name: type,
      type,
    });
  const route = [
    ["Kesim", "CUT"],
    ["Delme", "DRILL"],
    ["Montaj", "ASSEMBLY"],
    ["Kalite", "QC"],
    ["Paketleme", "PACK"],
  ];
  for (const [name, code] of route)
    await command("center.save", {
      name,
      code,
      parallelCapacity: 1,
      shiftStart: "08:00",
      shiftEnd: "17:00",
      workDays: [1, 2, 3, 4, 5],
      maintenance: [],
    });
  await command("preferences.save", {
    kerfMm: 3,
    trimStartMm: 5,
    trimEndMm: 5,
    minimumRemnantMm: 500,
    cuttingConfirmed: true,
    emailEnabled: false,
    whatsappEnabled: false,
  });
  await command("stock.receive", {
    itemId: profile.id,
    warehouseId: warehouses.RAW.id,
    quantity: 10,
    lengthMm: 6000,
    color: "Antrasit",
    unitCost: 50,
    lotNumber: "BAR",
  });
  await command("stock.receive", {
    itemId: screw.id,
    warehouseId: warehouses.RAW.id,
    quantity: 100,
    unitCost: 1,
    lotNumber: "SCREW",
  });
  // Faz 2 stock model: identity, explicit units, colour on every bar, source on every movement, no negative stock.
  {
    const painted = await command("material.save", { sku: "T-108-4060-BOYALI", name: "108 40x60 boyalı", itemType: "raw_material", uom: "m", standardLengthMm: 6000, weightPerMeterKg: 0.897, profileCode: "108", sizeLabel: "40x60", processedStates: ["boyali"] });
    assert.deepEqual(painted.processed_states, ["boyali"]);
    await assert.rejects(command("material.save", { sku: "T-108-4060-BOYALI-2", name: "108 aynısı", itemType: "raw_material", uom: "m", standardLengthMm: 6000, weightPerMeterKg: 0.897, profileCode: "108", sizeLabel: "40X60", processedStates: ["boyali"] }), (e: any) => e.status === 409);
    // Unpainted is a different item, so it is accepted.
    await command("material.save", { sku: "T-108-4060-BOYASIZ", name: "108 40x60 boyasız", itemType: "raw_material", uom: "m", standardLengthMm: 6000, weightPerMeterKg: 0.897, profileCode: "108", sizeLabel: "40x60", processedStates: ["boyasiz"] });
    const spring = await command("material.save", { sku: "T-YAY-TAKIM", name: "Borulu yay", itemType: "consumable", uom: "takim", minStock: 10 });
    await assert.rejects(command("material.save", { sku: "T-YAY-YARIM", name: "Yarım yay", itemType: "consumable", uom: "takim", minStock: 2.5 }), (e: any) => e.status === 400);
    await assert.rejects(command("stock.receive", { itemId: spring.id, warehouseId: warehouses.RAW.id, quantity: 1.5, unitCost: 1, lotNumber: "YAY-1" }), (e: any) => e.status === 400);
    await assert.rejects(command("stock.receive", { itemId: painted.id, warehouseId: warehouses.RAW.id, quantity: 1, lengthMm: 6000, color: "", unitCost: 1, lotNumber: "RENKSIZ" }), (e: any) => e.status === 400);
    const manual = await command("stock.receive", { itemId: spring.id, warehouseId: warehouses.RAW.id, quantity: 3, unitCost: 1, lotNumber: "YAY-2" });
    assert.equal(manual.reference_type, "manual");
    await assert.rejects(db`UPDATE stock_balances SET on_hand_qty=-1 WHERE tenant_id=${tenant.id} AND item_id=${spring.id}`, /stock_balances_not_negative/);
    // A balance already negative from before may be raised towards zero, never lowered further.
    await db`ALTER TABLE stock_balances DISABLE TRIGGER rf_stock_balance_not_negative`;
    await db`UPDATE stock_balances SET on_hand_qty=-5 WHERE tenant_id=${tenant.id} AND item_id=${spring.id}`;
    await db`ALTER TABLE stock_balances ENABLE TRIGGER rf_stock_balance_not_negative`;
    await command("stock.receive", { itemId: spring.id, warehouseId: warehouses.RAW.id, quantity: 2, unitCost: 1, lotNumber: "YAY-3" });
    assert.equal(Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${tenant.id} AND item_id=${spring.id}`)[0].on_hand_qty), -3);
    await assert.rejects(db`UPDATE stock_balances SET on_hand_qty=-4 WHERE tenant_id=${tenant.id} AND item_id=${spring.id}`, /stock_balances_not_negative/);
    await db`ALTER TABLE stock_balances DISABLE TRIGGER rf_stock_balance_not_negative`;
    await db`UPDATE stock_balances SET on_hand_qty=5 WHERE tenant_id=${tenant.id} AND item_id=${spring.id}`;
    await db`ALTER TABLE stock_balances ENABLE TRIGGER rf_stock_balance_not_negative`;
    await assert.rejects(db`INSERT INTO stock_entries(tenant_id,entry_number,entry_type,status,idempotency_key)VALUES(${tenant.id},${"SE-T-" + randomUUID()},'MATERIAL_RECEIPT','draft',${randomUUID()})`, /stock_entries_source_required/);
    await assert.rejects(db`UPDATE inventory_items SET stock_uom='paket' WHERE id=${spring.id}`, /inventory_items_stock_uom_known/);
    console.log("PASS · stock model: profile code + size + processed state identity, explicit counted units, colour required on bars, manual source recorded, database refuses negative stock, sourceless movements and unknown units");
  }
  await command("quality.cost-settings",{revision:1,laborCostPerHour:120,laborCurrency:"TRY"});
  const definition = {
    code: "TEST",
    name: "Synthetic test only",
    version: 1,
    finishedItemId: finished.id,
    rules: [
      {
        itemId: profile.id,
        kind: "profile",
        uom: "m",
        quantityFormula: "2",
        cutLengthFormula: "widthMm-10",
      },
      { itemId: screw.id, kind: "material", uom: "adet", quantityFormula: "8" },
    ],
    operations: route.map(([name, workCenterCode]) => ({
      name,
      workCenterCode,
      minutesFormula: "10*quantity",
      qualityChecks: workCenterCode === "QC" ? [{id:"visual",name:"Visual inspection",kind:"pass_fail",unit:""},{id:"width",name:"Measured width",kind:"measurement",unit:"mm",minimum:2980,maximum:3000}] : [],
    })),
    limits: {
      minWidthMm: 2500,
      maxWidthMm: 6000,
      minProjectionMm: 1500,
      maxProjectionMm: 5000,
      minMountingHeightMm: 2200,
      maxMountingHeightMm: 4500,
    },
    examples: [
      {
        parameters: {
          widthMm: 3000,
          projectionMm: 1500,
          mountingHeightMm: 3000,
          quantity: 2,
        },
        expected: [
          { itemId: profile.id, quantity: 11.96 },
          { itemId: screw.id, quantity: 16 },
        ],
      },
      {
        parameters: {
          widthMm: 5000,
          projectionMm: 2000,
          mountingHeightMm: 3000,
          quantity: 1,
        },
        expected: [
          { itemId: profile.id, quantity: 9.98 },
          { itemId: screw.id, quantity: 8 },
        ],
      },
    ],
  };
  const recipe = await command("recipe.save", definition);
  await command("recipe.publish", { id: recipe.id });
  await assert.rejects(()=>db`UPDATE production_recipes SET name='Mutation' WHERE id=${recipe.id}`);
  const customDefinition={...definition,code:"CUSTOM",parameterDefinitions:[{key:"armCount",label:"Makas adedi",type:"number",minimum:1,maximum:8,integer:true,required:true,defaultValue:2}],constraints:[{formula:"if(led,motor,1)",message:"LED için motor gerekli"}],operations:definition.operations.map(op=>({...op,setupMinutesFormula:"5"}))};
  const customDraft=await command("recipe.save",customDefinition);
  const edited=await command("recipe.save",{...customDefinition,editRevision:customDraft.edit_revision});
  assert.equal(edited.edit_revision,2);
  await assert.rejects(()=>command("recipe.save",customDefinition));
  await assert.rejects(()=>command("recipe.publish",{id:edited.id,editRevision:1}));
  await command("recipe.publish",{id:edited.id,editRevision:2});
  console.log("PASS · recipes: custom parameters and setup persisted, stale edit/publish rejected, database immutable publication");
  await assert.rejects(() =>
    command("recipe.save", { ...definition, name: "Forbidden update" }),
  );
  const quotes = new PostgresQuotationService(),
    config = {
      ...DEFAULT_AWNING,
      widthMm: 3000,
      projectionMm: 1500,
      mountingHeightMm: 3100,
    };
  const quoteData = {
    idempotencyKey: randomUUID(),
    customerName: "Test buyer",
    currency: "TRY",
    discountPercent: 7,
    items: [
      {
        productName: "Test awning",
        quantity: 2,
        unitPrice: 12345,
        discountPercent: 5,
        totalPrice: 0,
        awningConfiguration: config,
        widthMm: 3000,
        projectionMm: 1500,
        mountingHeightMm: 3100,
        heightMm: 2100,
      },
      {
        productName: "Second awning",
        quantity: 1,
        unitPrice: 20000,
        discountPercent: 0,
        totalPrice: 0,
        awningConfiguration: { ...config, widthMm: 5000 },
        heightMm: 2300,
      },
    ],
  };
  const quote = await quotes.createQuotation(
    tenant.id,
    quoteData as any,
    user.id,
  );
  assert.equal(
    (await quotes.createQuotation(tenant.id, quoteData as any, user.id)).id,
    quote.id,
  );
  await assert.rejects(() =>
    quotes.createQuotation(
      tenant.id,
      { ...quoteData, customerName: "Changed" } as any,
      user.id,
    ),
  );
  const revision = await quotes.updateQuotation(tenant.id, quote.id, {
    expectedVersion: quote.version,
    notes: "Revision test",
  });
  await assert.rejects(() =>
    quotes.updateQuotation(tenant.id, quote.id, {
      expectedVersion: quote.version,
      notes: "Stale",
    }),
  );
  assert.equal(revision.version, quote.version + 1);
  assert.equal(quote.items[0].unitPrice, 12345);
  assert.equal(quote.items[0].heightMm, 2100);
  const conversion = await quotes.convertToOrder(tenant.id, quote.id, user.id);
  assert.deepEqual(
    await quotes.convertToOrder(tenant.id, quote.id, user.id),
    conversion,
  );
  const orderItems =
    await db`SELECT * FROM order_items WHERE order_id=${conversion.orderId} ORDER BY quantity DESC`;
  assert.equal(Number(orderItems[0].height_mm), 2100);
  assert.deepEqual(orderItems[0].awning_configuration, config);
  assert.equal(Number(orderItems[0].unit_price), 12345);
  const makeJob = (id: string) =>
    command("job.create", {
      orderItemId: id,
      recipeId: recipe.id,
      sourceWarehouseId: warehouses.RAW.id,
      wipWarehouseId: warehouses.WIP.id,
      targetWarehouseId: warehouses.FINISHED.id,
      assignedTo: user.id,
    });
  const job1 = await makeJob(orderItems[0].id),
    job2 = await makeJob(orderItems[1].id);
  const jobIds = [job1.id, job2.id];
  // Without the workshop's own values the plan is made with the defaults and says it is an estimate.
  const savedPreferences = (await db`SELECT * FROM manufacturing_preferences WHERE tenant_id=${tenant.id}`)[0];
  await db`UPDATE manufacturing_preferences SET kerf_mm=3,trim_start_mm=0,trim_end_mm=0,minimum_remnant_mm=500,standard_length_mm=6000,cutting_confirmed=false WHERE tenant_id=${tenant.id}`;
  const estimated = await command("cut.preview", { workOrderIds: jobIds });
  assert.equal(estimated.result.parameterSource, "default");
  assert.deepEqual(estimated.parameters, { kerfMm: 3, trimStartMm: 0, trimEndMm: 0, minimumRemnantMm: 500, standardLengthMm: 6000 });
  assert.match((await cutPlanSheet(actor, estimated.id)).notice, /Varsayılan değerler kullanıldı, atölyenize göre ayarlayın/);
  // Approving an estimate must be said explicitly.
  await assert.rejects(command("cut.approve", { id: estimated.id, version: estimated.version }), (e: any) => e.status === 400);
  await command("cut.cancel", { id: estimated.id, version: estimated.version });
  // Values entered but not confirmed are kept, and plans still say they are estimates.
  await command("preferences.save", { kerfMm: 4, trimStartMm: 10, trimEndMm: 10, minimumRemnantMm: 600, standardLengthMm: 6500, cuttingConfirmed: false, emailEnabled: false, whatsappEnabled: false });
  const unconfirmed = await command("cut.preview", { workOrderIds: jobIds });
  assert.equal(unconfirmed.result.parameterSource, "unconfirmed");
  assert.equal(unconfirmed.parameters.standardLengthMm, 6500);
  await command("cut.cancel", { id: unconfirmed.id, version: unconfirmed.version });
  await command("preferences.save", {
    kerfMm: Number(savedPreferences.kerf_mm), trimStartMm: Number(savedPreferences.trim_start_mm), trimEndMm: Number(savedPreferences.trim_end_mm),
    minimumRemnantMm: Number(savedPreferences.minimum_remnant_mm), cuttingConfirmed: true, emailEnabled: false, whatsappEnabled: false,
  });
  // Saving again without the tick keeps the confirmation while the cutting values are unchanged,
  // and leaving the standard length out keeps the stored one.
  await command("preferences.save", {
    kerfMm: Number(savedPreferences.kerf_mm), trimStartMm: Number(savedPreferences.trim_start_mm), trimEndMm: Number(savedPreferences.trim_end_mm),
    minimumRemnantMm: Number(savedPreferences.minimum_remnant_mm), cuttingConfirmed: false, emailEnabled: false, whatsappEnabled: false,
  });
  const [kept] = await db`SELECT cutting_confirmed,standard_length_mm FROM manufacturing_preferences WHERE tenant_id=${tenant.id}`;
  assert.equal(kept.cutting_confirmed, true);
  assert.equal(Number(kept.standard_length_mm), 6500);
  // The cutting suggestion: the engine plans the waiting jobs; approving it saves and reserves the plan.
  {
    const { listPendingSuggestions, decideSuggestion } = await import("../lib/ai/suggestions/service");
    const { refreshCuttingSuggestion, CUTTING_PLAN_KIND } = await import("../lib/ai/suggestions/kinds/cutting-plan");
    const owner = { tenantId: tenant.id, userId: user.id, role: "owner" as const };
    const pending = async () => (await listPendingSuggestions(owner, { refresh: false })).filter((x: any) => x.kind === CUTTING_PLAN_KIND);
    await refreshCuttingSuggestion(owner);
    const [first] = await pending();
    assert(first, "a cutting suggestion is filed for the waiting jobs");
    assert.deepEqual([...first.payload.workOrderIds].sort(), [...jobIds].sort());
    assert.equal(first.source, "system");
    assert.equal(first.uncertain, false);
    assert.doesNotMatch(JSON.stringify(first), /unitCost|customer_name|"cost"/i);
    assert.equal((await listPendingSuggestions({ ...owner, role: "worker" } as any, { refresh: false })).length, 0);
    await refreshCuttingSuggestion(owner);
    assert.equal((await pending()).length, 1, "the same situation is filed once");
    const approved = await decideSuggestion(owner, first.id, { action: "approve", expectedVersion: first.version });
    assert.equal(approved.status, "approved");
    const [plan] = await db`SELECT status,work_order_ids FROM cutting_plans WHERE id=${(approved as any).result.planId}`;
    assert.equal(plan.status, "approved");
    assert.equal((await db`SELECT count(*)::int AS n FROM stock_lots WHERE id=ANY(${first.payload.lotIds}::uuid[]) AND status='reserved'`)[0].n, first.payload.lotIds.length);
    await refreshCuttingSuggestion(owner);
    assert.equal((await pending()).length, 0, "planned jobs leave the pool");
    const [saved] = await db`SELECT version FROM cutting_plans WHERE id=${(approved as any).result.planId}`;
    await command("cut.cancel", { id: (approved as any).result.planId, version: saved.version });
    await refreshCuttingSuggestion(owner);
    const [again] = await pending();
    assert(again && again.id !== first.id, "a cancelled plan's jobs are suggested again");
    // The card said "confirmed values"; if the values become unconfirmed meanwhile, approval is refused.
    await db`UPDATE manufacturing_preferences SET cutting_confirmed=false WHERE tenant_id=${tenant.id}`;
    await assert.rejects(decideSuggestion(owner, again.id, { action: "approve", expectedVersion: again.version }), (e: any) => e.status === 409);
    await db`UPDATE manufacturing_preferences SET cutting_confirmed=true WHERE tenant_id=${tenant.id}`;
    // A different situation (other values) is filed; if stock changes before approval it is refused.
    await command("preferences.save", { kerfMm: 4, trimStartMm: 5, trimEndMm: 5, minimumRemnantMm: 500, cuttingConfirmed: true, emailEnabled: false, whatsappEnabled: false });
    await refreshCuttingSuggestion(owner);
    const [second] = await pending();
    assert(second && second.id !== again.id);
    assert.equal((await db`SELECT status FROM ai_suggestions WHERE id=${again.id}`)[0].status, "expired");
    const [taken] = second.payload.lotIds;
    await db`UPDATE stock_lots SET status='reserved' WHERE id=${taken}`;
    await assert.rejects(decideSuggestion(owner, second.id, { action: "approve", expectedVersion: second.version }), (e: any) => e.status === 409);
    await db`UPDATE stock_lots SET status='available' WHERE id=${taken}`;
    assert.equal((await db`SELECT status FROM ai_suggestions WHERE id=${second.id}`)[0].status, "pending");
    assert.equal((await db`SELECT count(*)::int AS n FROM cutting_plans WHERE idempotency_key=${"ai-suggestion:" + second.id}`)[0].n, 0, "the refused approval left no plan behind");
    await decideSuggestion(owner, second.id, { action: "reject", expectedVersion: second.version, note: "Elle planlanacak" });
    await refreshCuttingSuggestion(owner);
    assert.equal((await pending()).length, 0, "a rejected situation is not filed again");
    await command("preferences.save", {
      kerfMm: Number(savedPreferences.kerf_mm), trimStartMm: Number(savedPreferences.trim_start_mm), trimEndMm: Number(savedPreferences.trim_end_mm),
      minimumRemnantMm: Number(savedPreferences.minimum_remnant_mm), cuttingConfirmed: true, emailEnabled: false, whatsappEnabled: false,
    });
    const audit = await db`SELECT action FROM activity_logs WHERE tenant_id=${tenant.id} AND entity_type='ai_suggestion' ORDER BY created_at`;
    assert.deepEqual(audit.map((r: any) => r.action), ["created", "approved", "created", "expired", "created", "rejected"]);
    const events = await db`SELECT event_type,payload FROM production_events WHERE tenant_id=${tenant.id} AND payload->>'suggestionId'=${first.id} ORDER BY id`;
    assert.deepEqual(events.map((e: any) => e.event_type), ["cut.preview", "cut.approve"]);
    console.log("PASS · cutting suggestion: engine plan filed once, owner-only, approval saves and reserves on the timeline, changed stock or value source refused with full rollback, cancelled plans suggested again, rejected situations not refiled, expiry audited");
  }
  const preview1 = await command("cut.preview", { workOrderIds: jobIds }),
    preview2 = await command("cut.preview", { workOrderIds: jobIds });
  assert.equal(preview1.result.unfulfilled.length, 0);
  assert.equal(preview1.result.parameterSource, "confirmed");
  assert.equal(preview1.result.alternatives.length, 4);
  const approves = await Promise.allSettled([
    command("cut.approve", { id: preview1.id, version: preview1.version }),
    command("cut.approve", { id: preview2.id, version: preview2.version }),
  ]);
  assert.equal(approves.filter((r) => r.status === "fulfilled").length, 1);
  const approved = (
    approves.find(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<any>
  ).value;
  const key = randomUUID(),
    payload = {
      id: approved.id,
      version: approved.version,
      confirmed: true,
      actualBars: approved.result.bars.map((b: any, i: number) => ({
        lotId: b.source.id,
        remainingMm:
          b.remainingMm -
          (i === approved.result.bars.findIndex((v: any) => v.reusable)
            ? 10
            : 0),
      })),
    };
  const cut = await command("cut.complete", payload, key);
  assert.deepEqual(
    await command("cut.complete", payload, key),
    JSON.parse(JSON.stringify(cut)),
  );
  assert.equal(cut.status, "completed");
  // The operator's sheet: bars, pieces and jobs, without costs or customer names.
  const sheet = await cutPlanSheet(actor, cut.id);
  assert.equal(sheet.notice, null);
  assert.equal(sheet.bars.length, cut.result.bars.length);
  assert(sheet.bars.every((b: any) => b.pieces.every((p: any) => p.job?.orderNumber)));
  assert.doesNotMatch(JSON.stringify(sheet), /unitCost|customer|"cost"/i);
  await assert.rejects(cutPlanSheet({ ...actor, role: "worker" } as any, cut.id), (e: any) => e.status === 403);
  assert(cut.actual.bars.some((b: any) => b.remnantId));
  const stockBefore = (
    await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${tenant.id} AND item_id=${profile.id} AND warehouse_id=${warehouses.WIP.id}`
  )[0];
  assert(Math.abs(Number(stockBefore.on_hand_qty) - 21.94) < 1e-6);
  async function operation(position: number, action: string, extra: any = {}) {
    const [op] =
      await db`SELECT * FROM production_operations WHERE tenant_id=${tenant.id} AND work_order_id=${job1.id} AND position=${position}`;
    return command("operation", {
      operationId: op.id,
      version: op.version,
      action,
      qualityResults: position === 3 && action === "complete" ? [{checkId:"visual",passed:true},{checkId:"width",value:2990}] : [],
      ...extra,
    });
  }
  const [first] =
    await db`SELECT * FROM production_operations WHERE tenant_id=${tenant.id} AND work_order_id=${job1.id} AND position=0`;
  await assert.rejects(() =>
    productionCommand(
      { ...actor, role: "worker", userId: randomUUID() },
      {
        commandId: randomUUID(),
        action: "operation",
        data: {
          operationId: first.id,
          version: first.version,
          action: "start",
        },
      },
    ),
  );
  await operation(0, "start");
  await assert.rejects(() =>
    command("operation", {
      operationId: first.id,
      version: first.version,
      action: "complete",
      quantity: 1,
    }),
  );
  await operation(0, "complete", { quantity: 1 });
  const partial =
    await db`SELECT status,completed_qty FROM production_operations WHERE id=${first.id}`;
  assert.equal(partial[0].status, "paused");
  assert.equal(Number(partial[0].completed_qty), 1);
  await operation(0, "start");
  await operation(0, "complete", { quantity: 1 });
  await operation(1, "start");
  await operation(1, "complete", { quantity: 2 });
  const [drill] =
    await db`SELECT id FROM production_operations WHERE tenant_id=${tenant.id} AND work_order_id=${job1.id} AND position=1`;
  await operation(2, "rework", {
    quantity: 1,
    reasonCode: "quality",
    reason: "Synthetic defect",
    targetOperationId: drill.id,
    additionalMaterials: [
      { itemId: profile.id, quantity: 1, cutLengthMm: 800, scrapQty: 0.8 },
      { itemId: screw.id, quantity: 1, scrapQty: 1 },
    ],
  });
  await assert.rejects(() => operation(1, "start"));
  const reworkRequest = (
    await db`SELECT * FROM production_rework WHERE work_order_id=${job1.id}`
  )[0];
  assert.equal(reworkRequest.profile_status, "pending");
  await assert.rejects(()=>command("rework.resolve",{id:reworkRequest.id,version:1,rootCause:null,rootCauseStatus:"unknown",resolution:"Production still pending"}));
  const reworkPreview = await command("cut.preview", {
    reworkIds: [reworkRequest.id],
  });
  assert.equal(reworkPreview.result.newBars, 0);
  assert.equal(reworkPreview.result.bars.length, 1);
  const reworkApproved = await command("cut.approve", {
    id: reworkPreview.id,
    version: reworkPreview.version,
  });
  await command("cut.complete", {
    id: reworkApproved.id,
    version: reworkApproved.version,
    confirmed: true,
  });
  const [reworkDone] =
    await db`SELECT * FROM production_rework WHERE id=${reworkRequest.id}`;
  assert.equal(reworkDone.profile_status, "completed");
  assert.equal(Number(reworkDone.profile_cost), 40);
  assert.equal(Number(reworkDone.profile_scrap_kg), 0.96);
  assert.equal(
    (
      await db`SELECT COUNT(*) AS n FROM production_rework WHERE tenant_id=${tenant.id}`
    )[0].n,
    "1",
  );
  await operation(1, "start");
  await operation(1, "complete", { quantity: 1 });
  for (const p of [2, 3]) {
    await operation(p, "start");
    if (p===3) {
      await assert.rejects(()=>operation(3,'complete',{quantity:2,qualityResults:[]}));
      const rejected=await operation(3,'complete',{quantity:2,qualityResults:[{checkId:'visual',passed:true},{checkId:'width',value:3010}]});
      assert.equal(rejected.qualityRejected,true);
      assert.equal(Number(rejected.completed_qty),0);
      assert.equal((await db`SELECT status FROM production_operations WHERE work_order_id=${job1.id} AND position=4`)[0].status,'waiting');
      await assert.rejects(()=>operation(4,'start'));
      assert.equal((await db`SELECT passed FROM quality_inspections WHERE operation_id=${rejected.id}`)[0].passed,false);
      await operation(3,'start');
    }
    await operation(p, "complete", { quantity: 2 });
  }
  await operation(4, "start");
  await operation(4, "complete", { quantity: 1 });
  const [assembly] =
    await db`SELECT id FROM production_operations WHERE work_order_id=${job1.id} AND position=2`;
  await operation(4, "rework", {
    quantity: 1,
    reasonCode: "assembly",
    reason: "Synthetic partial pack rework",
    targetOperationId: assembly.id,
  });
  assert.equal(
    Number(
      (
        await db`SELECT completed_qty FROM production_operations WHERE id=${assembly.id}`
      )[0].completed_qty,
    ),
    1,
  );
  for (const p of [2, 3, 4]) {
    await operation(p, "start");
    await operation(p, "complete", { quantity: 1 });
  }
  const inspections=await db`SELECT * FROM quality_inspections WHERE work_order_id=${job1.id} ORDER BY created_at`;
  assert.equal(inspections.length,3);
  assert.deepEqual(inspections.map(q=>q.passed),[false,true,true]);
  assert.equal(inspections[2].attempt,inspections[1].attempt+1);
  assert.equal(inspections[2].context.orderId,conversion.orderId);
  assert.equal(inspections[2].context.recipeVersion,1);
  assert(inspections[2].context.materialLots.some((l:any)=>l.itemId===profile.id && l.lotId));
  assert(inspections[2].context.materialLots.some((l:any)=>l.itemId===screw.id && l.lotId));
  await assert.rejects(()=>db`UPDATE quality_inspections SET passed=true WHERE id=${inspections[0].id}`);
  const [jobDone] = await db`SELECT * FROM work_orders WHERE id=${job1.id}`;
  assert.equal(jobDone.status, "done");
  const reworks=await db`SELECT * FROM production_rework WHERE tenant_id=${tenant.id} AND work_order_id=${job1.id} ORDER BY created_at`;
  for(const r of reworks){
    await assert.rejects(()=>productionCommand({...actor,tenantId:randomUUID()},{commandId:randomUUID(),action:"rework.resolve",data:{id:r.id,version:r.version,rootCause:null,rootCauseStatus:"unknown",resolution:"Tenant isolation"}}));
    await assert.rejects(()=>productionCommand({...actor,role:"worker",userId:randomUUID()},{commandId:randomUUID(),action:"rework.resolve",data:{id:r.id,version:r.version,rootCause:null,rootCauseStatus:"unknown",resolution:"Worker isolation"}}));
    const key=randomUUID(),payload={id:r.id,version:r.version,rootCause:"Fixture defect confirmed",rootCauseStatus:"confirmed",resolution:"Adjusted and inspected",extraLaborMinutes:10};
    const closed=await command("rework.resolve",payload,key);assert.equal(closed.status,"resolved");assert.equal(closed.version,2);assert.equal(Number(closed.extra_labor_seconds),600);assert.equal(Number(closed.cost_snapshot.laborRate),120);assert(closed.cost_snapshot.totals.TRY>=20);
    assert.equal((await command("rework.resolve",payload,key)).id,closed.id);await assert.rejects(()=>command("rework.resolve",payload));
  }
  const {qualityAnalytics}=await import("../lib/features/manufacturing/quality.service");const qualityStats=await qualityAnalytics(actor);assert(qualityStats.lots.some((l:any)=>l.failures>0));assert(qualityStats.estimatedCost!.totals.TRY>=40);assert.equal(qualityStats.coverage.linked,3);
  await assert.rejects(()=>qualityAnalytics({...actor,role:"worker"}));assert.equal((await qualityAnalytics({...actor,tenantId:randomUUID()})).coverage.inspections,0);
  console.log("PASS · closed quality: immutable evidence, profile/consumable lot linkage, source recipe context, root-cause/resolution, measured labor, currencies and duplicate/tenant/worker guards");
  assert.equal(Number(jobDone.produced_qty), 2);
  const [balance] =
    await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${tenant.id} AND item_id=${profile.id} AND warehouse_id=${warehouses.WIP.id}`;
  assert(Math.abs(Number(balance.on_hand_qty) - 9.98) < 1e-6);
  await assert.rejects(() => operation(4, "complete", { quantity: 1 }));
  assert.equal(
    (
      await db`SELECT COUNT(*) AS n FROM production_units WHERE work_order_id=${job1.id}`
    )[0].n,
    "2",
  );
  const shipment = await command("shipment.create", {
    workOrderId: job1.id,
    quantity: 1,
    carrier: "Test carrier",
    trackingNumber: "SYNTHETIC",
  });
  await command("shipment.delivered", {
    id: shipment.id,
    version: shipment.version,
  });
  assert.equal(
    (
      await db`SELECT status FROM shipments WHERE id=${shipment.erp_shipment_id}`
    )[0].status,
    "delivered",
  );
  await assert.rejects(() =>
    command("shipment.delivered", {
      id: shipment.id,
      version: shipment.version,
    }),
  );
  await assert.rejects(() =>
    command("shipment.create", { workOrderId: job1.id, quantity: 2 }),
  );
  const tracking = await command("tracking.create", {
      orderId: conversion.orderId,
    }),
    token = tracking.path.split("/").pop();
  const publicData = await publicTracking(token);
  assert(publicData);
  assert(!("customer_name" in publicData));
  assert(!JSON.stringify(publicData).includes("12345"));
  assert.equal(publicData.shipments.length, 1);
  await command("tracking.revoke", { id: tracking.id });
  assert.equal(await publicTracking(token), null);
  const [draft] =
    await db`INSERT INTO intake_drafts(tenant_id,source,source_id,extracted_data,created_by)VALUES(${tenant.id},'upload',${randomUUID()},'{}',${user.id})RETURNING id`;
  const approval = {
    customerName: "Intake test",
    items: [{ productName: "Reviewed line", quantity: 1, totalPrice: 0 }],
  };
  const draftResults = await Promise.all([
    approveIntake(actor, draft.id, approval),
    approveIntake(actor, draft.id, approval),
  ]);
  assert.equal(draftResults[0].orderId, draftResults[1].orderId);
  await assert.rejects(() => approveIntake(actor,draft.id,{...approval,customerName:"Changed"}));
  const [provenanceDraft]=await db`INSERT INTO intake_drafts(tenant_id,source,source_id,extracted_data,created_by)VALUES(${tenant.id},'upload',${randomUUID()},${JSON.stringify({customerName:"Source customer",fieldEvidence:[{field:"customerName",needsReview:true}],items:[]})}::text::jsonb,${user.id})RETURNING id`;
  await assert.rejects(()=>approveIntake(actor,provenanceDraft.id,approval));
  await assert.rejects(()=>approveIntake({...actor,tenantId:randomUUID()},provenanceDraft.id,approval));
  await assert.rejects(()=>approveIntake(actor,provenanceDraft.id,{...approval,version:2,reviewedFields:["customerName"]}));
  const corrected={...approval,reviewedFields:["customerName"],items:[{...approval.items[0],customParameters:{armCount:3,slatGap:120},quantityUnit:"adet"}]};
  const accepted=await approveIntake(actor,provenanceDraft.id,corrected);
  assert.equal((await approveIntake(actor,provenanceDraft.id,corrected)).orderId,accepted.orderId);
  const [preserved]=await db`SELECT * FROM intake_drafts WHERE id=${provenanceDraft.id}`;
  assert.equal((await approveIntake(actor,provenanceDraft.id,preserved.reviewed_data)).orderId,accepted.orderId);
  assert.equal((await approveIntake(actor,provenanceDraft.id,{...corrected,items:[{...corrected.items[0],customParameters:{slatGap:120,armCount:3}}]})).orderId,accepted.orderId);
  assert.equal(preserved.extracted_data.customerName,"Source customer");
  assert.equal(preserved.reviewed_data.customerName,"Intake test");
  assert.equal(preserved.review_version,2);
  assert.equal((await db`SELECT custom_parameters FROM order_items WHERE order_id=${accepted.orderId}`)[0].custom_parameters.armCount,3);
  console.log("PASS · intake provenance: original data preserved, explicit field review, version/tenant checks, changed replay rejected, custom parameters persisted");
  const schedule = await command("schedule.preview", {
    startsAt: "2026-10-05T05:00:00Z",
  });
  await command("schedule.publish", { id: schedule.id });
  assert(schedule.tasks.tasks.length > 0);
  const machineData={code:"SAW1",name:"Shared saw",kind:"machine",parallelCapacity:1,shiftStart:"08:00",shiftEnd:"17:00",workDays:[1,2,3,4,5],maintenance:[],workCenterCodes:["CUT","DRILL"]};
  const machine=await command("resource.save",machineData);
  await assert.rejects(()=>command("resource.save",{...machineData,code:"FOREIGN",workCenterCodes:["UNKNOWN"]}));
  await assert.rejects(()=>command("resource.save",{...machineData,code:"TEAM",kind:"team",memberIds:[randomUUID()]}));
  await assert.rejects(()=>productionCommand({...actor,role:"worker"},{commandId:randomUUID(),action:"resource.save",data:machineData}));
  const stalePlan=await command("schedule.preview",{startsAt:"2026-10-05T05:00:00Z"});
  await command("resource.save",{...machineData,revision:machine.revision,name:"Updated saw"});
  await assert.rejects(()=>command("schedule.publish",{id:stalePlan.id}));
  await assert.rejects(()=>command("resource.save",{...machineData,revision:1}));
  const currentPlan=await command("schedule.preview",{startsAt:"2026-10-05T05:00:00Z"});
  await command("schedule.publish",{id:currentPlan.id});
  const [unassigned]=await db`SELECT * FROM production_operations WHERE tenant_id=${tenant.id} AND status IN('waiting','ready','paused') ORDER BY position LIMIT 1`;
  if(unassigned){
    const assignment={operationId:unassigned.id,version:unassigned.version,assignedTo:user.id,machineId:machine.id};
    if(["CUT","DRILL"].includes(unassigned.work_center_code)){await command("operation.assign",assignment);await assert.rejects(()=>command("operation.assign",assignment));}
    else await assert.rejects(()=>command("operation.assign",assignment));
    await assert.rejects(()=>command("operation.assign",{...assignment,machineId:randomUUID()}));
  }
  console.log("PASS · resources: real machine calendars, company/role/capability constraints, stale-resource and stale-plan publication rejected");
  const overview = await productionOverview(actor);
  assert.equal(overview.jobs.length, 2);
  const {productionAnalytics}=await import("../lib/features/manufacturing/analytics.service");
  const analytics=await productionAnalytics(actor);assert.equal(analytics.centers.length,5);assert(analytics.centers.some(c=>c.baseline && c.baseline.samples>0));
  const isolatedAnalytics=await productionAnalytics({...actor,tenantId:randomUUID()});assert.equal(isolatedAnalytics.predictions.length,0);assert.equal(isolatedAnalytics.centers.length,0);
  await assert.rejects(()=>productionAnalytics({...actor,role:"worker"}));
  console.log("PASS · live production analytics: real event baselines, deterministic scheduling forecast, tenant/worker isolation");
  assert(overview.losses.length > 0);
  const loss = overview.losses.reduce(
    (s: number, l: any) => s + Number(l.length_mm),
    0,
  );
  assert.equal(
    Number(
      overview.losses
        .reduce((s: number, l: any) => s + Number(l.weight_kg), 0)
        .toFixed(6),
    ),
    Number(((loss / 1000) * 1.2).toFixed(6)),
  );
  const receipt = await command("stock.receive", {
    itemId: screw.id,
    warehouseId: warehouses.RAW.id,
    quantity: 5,
    unitCost: 1,
    lotNumber: "REVERSAL",
  });
  const [receivedEntry] =
    await db`SELECT id FROM stock_entries WHERE tenant_id=${tenant.id} ORDER BY created_at DESC LIMIT 1`;
  await command("stock.reverse", {
    id: receivedEntry.id,
    reason: "Synthetic receipt correction",
  });
  await assert.rejects(() =>
    command("stock.reverse", {
      id: receivedEntry.id,
      reason: "Duplicate reversal",
    }),
  );
  process.env.RESEND_API_KEY = "";
  process.env.EMAIL_FROM = "";
  const { drainNotifications } = await import(
    "../lib/features/manufacturing/notification.service"
  );
  await command("preferences.save", {
    kerfMm: 3,
    trimStartMm: 5,
    trimEndMm: 5,
    minimumRemnantMm: 500,
    cuttingConfirmed: true,
    emailEnabled: true,
    whatsappEnabled: false,
  });
  const [notice] =
    await db`INSERT INTO notification_outbox(tenant_id,event_key,channel,recipient,payload)VALUES(${tenant.id},'synthetic-notice','email','test@example.invalid','{"orderNumber":"TEST","customerName":"TEST","status":"shipped"}')RETURNING id`;
  await drainNotifications(1000);
  const [attempt] =
    await db`SELECT * FROM notification_outbox WHERE id=${notice.id}`;
  assert.equal(attempt.status, "pending");
  assert.equal(attempt.attempts, 1);
  assert(attempt.last_error);
  assert.equal(
    (
      await db`SELECT COUNT(*) AS n FROM notification_attempts WHERE notification_id=${notice.id}`
    )[0].n,
    "1",
  );
  const { NextRequest } = await import("next/server");
  const meta = await import("../app/api/v1/webhooks/whatsapp/route");
  process.env.WHATSAPP_APP_SECRET = "synthetic-webhook-secret";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "synthetic-phone";
  process.env.WHATSAPP_INBOUND_TENANT_ID = tenant.id;
  const providerId = randomUUID();
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "synthetic-phone" },
              messages: [
                {
                  id: providerId,
                  from: "905550000000",
                  text: { body: "Synthetic order" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const signed = () =>
    new NextRequest("http://localhost/api/v1/webhooks/whatsapp", {
      method: "POST",
      body,
      headers: {
        "x-hub-signature-256":
          "sha256=" +
          createHmac("sha256", process.env.WHATSAPP_APP_SECRET!)
            .update(body)
            .digest("hex"),
      },
    });
  assert.equal(
    (
      await meta.POST(
        new NextRequest("http://localhost/api/v1/webhooks/whatsapp", {
          method: "POST",
          body,
        }),
      )
    ).status,
    401,
  );
  assert.equal((await meta.POST(signed())).status, 200);
  assert.equal((await meta.POST(signed())).status, 200);
  assert.equal(
    (
      await db`SELECT COUNT(*) AS n FROM inbound_messages WHERE provider_message_id=${providerId}`
    )[0].n,
    "1",
  );
  const otherTenant = randomUUID();
  await assert.rejects(() =>
    productionCommand(
      { ...actor, tenantId: otherTenant },
      {
        commandId: randomUUID(),
        action: "recipe.publish",
        data: { id: recipe.id },
      },
    ),
  );
  const { procurementWorkspace } = await import('../lib/features/manufacturing/purchasing.service');
  const supplierKey=randomUUID(), supplierData={name:'TEST supplier',paymentTerms:0};
  const supplier=await command('procurement.supplier.save',supplierData,supplierKey);
  assert.equal((await command('procurement.supplier.save',supplierData,supplierKey)).id,supplier.id);
  assert.equal(supplier.payment_terms,0);
  await assert.rejects(()=>productionCommand({...actor,role:'worker'},{commandId:randomUUID(),action:'procurement.supplier.save',data:{name:'Denied'}}));
  await assert.rejects(()=>command('procurement.supplier.save',{...supplierData,id:supplier.id,version:99}));
  const rejectedWarehouse=await command('warehouse.save',{code:'REJECTED',name:'Rejected',type:'REJECTED'});
  const purchase=await command('procurement.purchase.create',{supplierId:supplier.id,notes:'Synthetic receipt tests',lines:[{itemId:profile.id,warehouseId:warehouses.RAW.id,quantity:3,lengthMm:6000,color:'black',unitPrice:50},{itemId:screw.id,warehouseId:warehouses.RAW.id,quantity:10,unitPrice:2}]});
  const poLines=await db`SELECT * FROM purchase_order_lines WHERE purchase_order_id=${purchase.id} ORDER BY position`;
  assert.equal(Number(poLines[0].ordered_qty),18);
  assert.equal(poLines[0].metadata.lengthMm,6000);
  await assert.rejects(()=>command('procurement.receipt.create',{purchaseOrderId:purchase.id,version:1,lines:[{lineId:poLines[0].id,acceptedQty:6}]}));
  const submitted=await command('procurement.purchase.transition',{id:purchase.id,version:1,status:'submitted'});
  await assert.rejects(()=>command('procurement.receipt.create',{purchaseOrderId:purchase.id,version:submitted.version,lines:[{lineId:poLines[0].id,acceptedQty:7}]}));
  await assert.rejects(()=>command('procurement.receipt.create',{purchaseOrderId:purchase.id,version:submitted.version,lines:[{lineId:poLines[0].id,acceptedQty:24}]}));
  await assert.rejects(()=>command('procurement.receipt.create',{purchaseOrderId:purchase.id,version:submitted.version,lines:[{lineId:poLines[0].id,acceptedQty:6,rejectedQty:6,rejectedWarehouseId:warehouses.RAW.id,rejectionReason:'Bad profile'}]}));
  const receiptKey=randomUUID(),receiptData={purchaseOrderId:purchase.id,version:submitted.version,lines:[{lineId:poLines[0].id,acceptedQty:6,rejectedQty:6,rejectedWarehouseId:rejectedWarehouse.id,rejectionReason:'Damaged profile'},{lineId:poLines[1].id,acceptedQty:4}]};
  const goodsReceipt=await command('procurement.receipt.create',receiptData,receiptKey);
  assert.equal((await command('procurement.receipt.create',receiptData,receiptKey)).id,goodsReceipt.id);
  const physical=await db`SELECT * FROM stock_lots WHERE metadata->>'goodsReceiptId'=${goodsReceipt.id}`;
  assert.equal(physical.length,3);
  assert.equal(Number(physical.find(l=>l.warehouse_id===warehouses.RAW.id)!.weight_kg),7.2);
  assert.equal(Number((await db`SELECT received_qty FROM purchase_order_lines WHERE id=${poLines[0].id}`)[0].received_qty),6);
  await assert.rejects(()=>command('procurement.receipt.create',receiptData));
  await assert.rejects(()=>command('stock.reverse',{id:goodsReceipt.stock_entry_id,reason:'Must use receipt workflow'}));
  let [poNow]=await db`SELECT * FROM purchase_orders WHERE id=${purchase.id}`;
  assert.equal(poNow.status,'partially_received');
  const foreign=(await db`SELECT id FROM purchase_order_lines WHERE tenant_id<>${tenant.id} LIMIT 1`)[0];
  if(foreign)await assert.rejects(()=>command('procurement.receipt.create',{purchaseOrderId:purchase.id,version:poNow.version,lines:[{lineId:foreign.id,acceptedQty:1}]}));
  await command('procurement.receipt.reverse',{id:goodsReceipt.id,version:poNow.version,reason:'Synthetic correction'});
  assert.equal((await db`SELECT status FROM goods_receipts WHERE id=${goodsReceipt.id}`)[0].status,'reversed');
  assert.equal(Number((await db`SELECT received_qty FROM purchase_order_lines WHERE id=${poLines[0].id}`)[0].received_qty),0);
  assert((await db`SELECT * FROM stock_lots WHERE metadata->>'goodsReceiptId'=${goodsReceipt.id}`).every(l=>Number(l.remaining_qty)===0));
  await assert.rejects(()=>command('procurement.receipt.reverse',{id:goodsReceipt.id,version:poNow.version+1,reason:'Duplicate correction'}));
  [poNow]=await db`SELECT * FROM purchase_orders WHERE id=${purchase.id}`;
  const finalReceipt=await command('procurement.receipt.create',{purchaseOrderId:purchase.id,version:poNow.version,lines:[{lineId:poLines[0].id,acceptedQty:18},{lineId:poLines[1].id,acceptedQty:10}]});
  const [finishedPO]=await db`SELECT * FROM purchase_orders WHERE id=${purchase.id}`;
  assert.equal(finishedPO.status,'received');
  await assert.rejects(()=>command('procurement.purchase.transition',{id:purchase.id,version:finishedPO.version,status:'cancelled'}));
  const [reservedLot]=await db`UPDATE stock_lots SET status='reserved' WHERE id=(SELECT id FROM stock_lots WHERE metadata->>'goodsReceiptId'=${finalReceipt.id} LIMIT 1)RETURNING id`;
  await assert.rejects(()=>command('procurement.receipt.reverse',{id:finalReceipt.id,version:finishedPO.version,reason:'Reserved profile rejection'}));
  await db`UPDATE stock_lots SET status='available' WHERE id=${reservedLot.id}`;
  const workspace=await procurementWorkspace(actor);
  assert.equal(workspace.orders.find(o=>o.id===purchase.id)!.lines.length,2);
  await assert.rejects(()=>procurementWorkspace({...actor,role:'worker'}));
  console.log('PASS · procurement: drafts/approval, physical bars and costs, partial/rejected receipts, duplicate/stale/excess/cross-tenant guards, immutable reversal, reserved-lot guard, role isolation');
  const {financeWorkspace}=await import('../lib/features/finance/workspace.service');
  const employee=await command('finance.employee.save',{fullName:'TEST payroll employee',email:'',active:true});
  const ledgerKey=randomUUID(),ledgerData={employeeId:employee.id,kind:'salary',amount:1000,currency:'TRY',entryDate:'2026-10-03',note:'Synthetic payroll'};
  const ledger=await command('finance.ledger.create',ledgerData,ledgerKey);
  assert.equal((await command('finance.ledger.create',ledgerData,ledgerKey)).id,ledger.id);
  await assert.rejects(()=>command('finance.employee.save',{id:employee.id,version:99,fullName:'Stale employee'}));
  await assert.rejects(()=>command('finance.ledger.create',{...ledgerData,amount:0.001}));
  await db`INSERT INTO accounting_period_closes(tenant_id,period,status)VALUES(${tenant.id},'2026-09','hard_closed')ON CONFLICT(tenant_id,period)DO UPDATE SET status='hard_closed'`;
  await assert.rejects(()=>command('finance.ledger.create',{...ledgerData,entryDate:'2026-09-03'}));
  const paymentKey=randomUUID(),paymentData={orderId:conversion.orderId,amount:100,currency:'TRY',method:'credit_card',paidAt:'2026-10-03T09:00:00Z',note:'Synthetic credit card'};
  const payment=await command('finance.payment.create',paymentData,paymentKey);
  assert.equal((await command('finance.payment.create',paymentData,paymentKey)).id,payment.id);
  await command('finance.payment.create',{...paymentData,method:'check',amount:50});
  await assert.rejects(()=>command('finance.payment.create',{...paymentData,currency:'USD'}));
  await assert.rejects(()=>command('finance.payment.create',{...paymentData,amount:10000000}));
  await assert.rejects(()=>command('finance.payment.create',{...paymentData,paidAt:'2026-09-03T09:00:00Z'}));
  for(const role of ['office','worker','member'] as const) {
    await assert.rejects(()=>productionCommand({...actor,role},{commandId:randomUUID(),action:'finance.payment.create',data:paymentData}));
    await assert.rejects(()=>financeWorkspace({...actor,role}));
  }
  const financeData=await financeWorkspace(actor);
  assert.equal(Number(financeData.orders.find(o=>o.id===conversion.orderId)!.paid_amount),150);
  assert.equal((await financeWorkspace({...actor,tenantId:otherTenant})).payments.length,0);
  console.log('PASS · finance: cheque/card, currency separation, overpayment prevention, closed periods, replay-safe payment/payroll, stale employee and live role isolation');
  const {createNotification,getUserNotifications,markNotificationAsRead,markAllNotificationsAsRead}=await import('../lib/notifications/service');
  const [secondNoticeTenant]=await db`INSERT INTO tenants(name,slug)VALUES('Notice isolation',${'notice-'+randomUUID()})RETURNING id`;
  const ownNotice=await createNotification(user.id,tenant.id,'system','BROWSER verification notice','Synthetic notification only');
  await createNotification(user.id,secondNoticeTenant.id,'system','OTHER FIRM notice','Not visible in this company');
  assert.equal((await getUserNotifications(user.id,tenant.id)).total,1);
  assert.equal((await getUserNotifications(user.id,tenant.id)).unreadCount,1);
  await markNotificationAsRead(ownNotice.id,user.id,secondNoticeTenant.id);
  assert.equal((await getUserNotifications(user.id,tenant.id)).unreadCount,1);
  await markAllNotificationsAsRead(user.id,secondNoticeTenant.id);
  assert.equal((await getUserNotifications(user.id,tenant.id)).unreadCount,1);
  assert.equal((await getUserNotifications(user.id,secondNoticeTenant.id)).unreadCount,0);
  console.log('PASS · notifications: same user in two companies, scoped read/unread counters and read updates');
  const bcrypt = await import("bcryptjs");
  const password = "Production-test-only-123";
  const ownerEmail = user.id + "@example.invalid";
  await db`UPDATE users SET email_verified=now(),email=${ownerEmail},password=${await bcrypt.hash(password, 10)} WHERE id=${user.id}`;
  const [worker] =
    await db`INSERT INTO users(name,email,password,email_verified)VALUES('Synthetic worker',${randomUUID() + "@example.invalid"},${await bcrypt.hash(password, 10)},now())RETURNING id,email`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role)VALUES(${tenant.id},${worker.id},'worker')`;
  await db`UPDATE production_operations SET assigned_to=${worker.id} WHERE work_order_id=${job2.id}`;
  await db`UPDATE work_orders SET assigned_to=${worker.id} WHERE id=${job2.id}`;
  {
  const {savedViewCommand,listSavedViews}=await import('../lib/features/orders/saved-views.service');
  const {OrderFiltersSchema}=await import('../lib/features/orders/saved-views');
  const viewFilters=OrderFiltersSchema.parse({q:'TEST',view:'active',sort:'delivery'});
  const viewKey=randomUUID(),viewRequest={commandId:viewKey,action:'create',name:'My production',filters:viewFilters,pinned:false};
  const savedView=await savedViewCommand(actor,viewRequest);
  assert.equal((await savedViewCommand(actor,viewRequest)).id,savedView.id);
  await assert.rejects(()=>savedViewCommand(actor,{...viewRequest,name:'Different payload'}));
  assert.equal((await listSavedViews(actor)).length,1);
  assert.equal((await listSavedViews({...actor,userId:worker.id,role:'worker'})).length,0);
  assert.equal((await listSavedViews({...actor,tenantId:otherTenant})).length,0);
  await assert.rejects(()=>savedViewCommand({...actor,userId:worker.id,role:'worker'},{commandId:randomUUID(),action:'delete',id:savedView.id,version:1}));
  await assert.rejects(()=>savedViewCommand(actor,{...viewRequest,commandId:randomUUID(),name:'my production'}));
  const updateView={commandId:randomUUID(),action:'update',id:savedView.id,version:1,name:'Pinned production',filters:viewFilters,pinned:true};
  const edits=await Promise.allSettled([savedViewCommand(actor,updateView),savedViewCommand(actor,{...updateView,commandId:randomUUID(),name:'Concurrent edit'})]);
  assert.equal(edits.filter(r=>r.status==='fulfilled').length,1,edits.map(r=>r.status==='rejected'?String(r.reason):'ok').join(' | '));
  const latest=(await listSavedViews(actor))[0];
  assert.equal(latest.version,2);
  await assert.rejects(()=>savedViewCommand(actor,{commandId:randomUUID(),action:'delete',id:latest.id,version:1}));
  const deleteView={commandId:randomUUID(),action:'delete',id:latest.id,version:2};
  await savedViewCommand(actor,deleteView);await savedViewCommand(actor,deleteView);
  assert.equal((await listSavedViews(actor)).length,0);
  console.log('PASS · personal views: user/company isolation, replay protection, unique names, concurrent edits, stale deletion');
  const {PostgresOrderService}=await import('../lib/features/orders/postgres/order.postgres');
  const {deleteUnlinkedOrder,drainStorageCleanup}=await import('../lib/features/orders/deletion.service');
  const orderService=new PostgresOrderService();
  const createDraft=()=>orderService.createOrder(tenant.id,{customerName:'TEST deletion',productName:'TEST awning',quantity:1,totalAmount:500,currency:'TRY'},[]);
  const draft=await createDraft(),path='orders/'+draft.id+'/test.pdf';
  await db`INSERT INTO documents(tenant_id,order_id,name,file_path,size)VALUES(${tenant.id},${draft.id},'Synthetic file',${path},1)`;
  await assert.rejects(()=>deleteUnlinkedOrder(otherTenant,draft.id));
  assert.equal((await db`SELECT id FROM documents WHERE order_id=${draft.id}`).length,1);
  await deleteUnlinkedOrder(tenant.id,draft.id);
  assert.equal((await db`SELECT id FROM orders WHERE id=${draft.id}`).length,0);
  assert.equal((await db`SELECT status FROM storage_cleanup_queue WHERE tenant_id=${tenant.id} AND file_path=${path}`)[0].status,'pending');
  await drainStorageCleanup(async key=>{if(key===path)throw new Error('Synthetic storage outage');},1000);
  const [pendingTask]=await db`SELECT * FROM storage_cleanup_queue WHERE tenant_id=${tenant.id} AND file_path=${path}`;
  assert.equal(pendingTask.status,'pending');assert.equal(pendingTask.attempts,1);assert.equal(pendingTask.last_error,'Synthetic storage outage');
  await db`UPDATE storage_cleanup_queue SET next_attempt_at=now() WHERE id=${pendingTask.id}`;
  const removedKeys:string[]=[];
  await drainStorageCleanup(async key=>{removedKeys.push(key);},1000);
  assert.ok(removedKeys.includes(path));
  assert.equal((await db`SELECT status FROM storage_cleanup_queue WHERE id=${pendingTask.id}`)[0].status,'done');
  const linkedDraft=await createDraft();
  await command('finance.payment.create',{orderId:linkedDraft.id,amount:50,currency:'TRY',method:'cash',paidAt:'2026-10-03T09:00:00Z',note:'Deletion protection'});
  const linkedPath='orders/'+linkedDraft.id+'/protected.pdf';
  await db`INSERT INTO documents(tenant_id,order_id,name,file_path,size)VALUES(${tenant.id},${linkedDraft.id},'Protected file',${linkedPath},1)`;
  await assert.rejects(()=>deleteUnlinkedOrder(tenant.id,linkedDraft.id));
  assert.equal((await db`SELECT id FROM payments WHERE order_id=${linkedDraft.id}`).length,1);
  assert.equal((await db`SELECT id FROM documents WHERE order_id=${linkedDraft.id}`).length,1);
  assert.equal((await db`SELECT id FROM storage_cleanup_queue WHERE file_path=${linkedPath}`).length,0);
  const concurrentDraft=await createDraft();
  const race=await Promise.allSettled([deleteUnlinkedOrder(tenant.id,concurrentDraft.id),command('finance.payment.create',{orderId:concurrentDraft.id,amount:50,currency:'TRY',method:'cash',paidAt:'2026-10-03T09:00:00Z'})]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  const [balance]=await db`SELECT (SELECT COUNT(*) FROM orders WHERE id=${concurrentDraft.id}) AS orders,(SELECT COUNT(*) FROM payments WHERE order_id=${concurrentDraft.id}) AS payments`;
  assert.equal(Number(balance.orders),Number(balance.payments));
  console.log('PASS · order deletion: linked payment/document preservation, cross-company protection, atomic cleanup queue, failed storage retry, payment/delete race');
  const {transitionOrder}=await import('../lib/features/orders/transitions.service');
  const transitionDraft=await createDraft(),transitionKey=randomUUID();
  const transitionData={commandId:transitionKey,version:1,newStatus:'pending_approval'};
  await assert.rejects(()=>transitionOrder({...actor,userId:worker.id,role:'worker'},transitionDraft.id,transitionData));
  await assert.rejects(()=>transitionOrder({...actor,tenantId:otherTenant},transitionDraft.id,transitionData));
  const transitionResult=await transitionOrder(actor,transitionDraft.id,transitionData);
  assert.equal(transitionResult.version,2);assert.equal((await transitionOrder(actor,transitionDraft.id,transitionData)).version,2);
  await assert.rejects(()=>transitionOrder(actor,transitionDraft.id,{...transitionData,commandId:randomUUID(),newStatus:'approved'}));
  await assert.rejects(()=>transitionOrder(actor,transitionDraft.id,{...transitionData,newStatus:'approved'}));
  assert.equal((await db`SELECT changes FROM activity_logs WHERE tenant_id=${tenant.id} AND entity_id=${transitionDraft.id} AND action='status_changed'`).length,1);
  assert.equal((await db`SELECT changes FROM activity_logs WHERE tenant_id=${tenant.id} AND entity_id=${transitionDraft.id} AND action='status_changed'`)[0].changes.durum.to,'pending_approval');
  await assert.rejects(()=>deleteUnlinkedOrder(tenant.id,transitionDraft.id));
  const [nativeOrder]=await db`SELECT o.id,o.version FROM orders o JOIN work_orders w ON w.order_id=o.id WHERE w.id=${job2.id}`;
  await assert.rejects(()=>transitionOrder(actor,nativeOrder.id,{commandId:randomUUID(),version:nativeOrder.version,newStatus:'shipped'}));
  await assert.rejects(()=>orderService.updateOrderStatus(tenant.id,nativeOrder.id,'delivered'));
  console.log('PASS · order transitions: signed company/current role, replay-safe audit, stale version rejection, native production bypass blocked');

  }
  const {allocateMaterialLots}=await import('../lib/features/manufacturing/traceability.service');
  const {postStockEntry,postStockEntryInTransaction}=await import('../lib/features/manufacturing/inventory.service');
  const mix=await command('material.save',{sku:'MIX-TRACE',name:'Mixed legacy and tracked stock',itemType:'consumable',uom:'adet'});
  await command('stock.receive',{itemId:mix.id,warehouseId:warehouses.RAW.id,lotNumber:'MIX-LOT',quantity:60,lengthMm:0,color:'',unitCost:3,currency:'EUR'});
  await postStockEntry(actor,{entryType:'MATERIAL_RECEIPT',idempotencyKey:randomUUID(),lines:[{itemId:mix.id,warehouseId:warehouses.RAW.id,quantityDelta:40,uom:'adet',metadata:{}}]});
  const [mixLot]=await db`SELECT * FROM stock_lots WHERE tenant_id=${tenant.id} AND item_id=${mix.id}`;
  await db`UPDATE stock_lots SET status='reserved' WHERE id=${mixLot.id}`;
  const allocate=(quantity:number)=>db.begin(async(tx:any)=>{const lines=await allocateMaterialLots(tx,actor,job1,mix,quantity);return postStockEntryInTransaction(tx,actor,{entryType:'MATERIAL_ISSUE',referenceType:'rework',idempotencyKey:randomUUID(),lines});});
  await assert.rejects(()=>allocate(50),/rezerve lotlar/);
  assert.equal((await db`SELECT id FROM work_order_material_lots WHERE item_id=${mix.id}`).length,0);
  await allocate(25);
  assert.equal(Number((await db`SELECT remaining_qty FROM stock_lots WHERE id=${mixLot.id}`)[0].remaining_qty),60);
  assert.equal((await db`SELECT method FROM work_order_material_lots WHERE item_id=${mix.id}`)[0].method,'legacy_untracked');
  await db`UPDATE stock_lots SET status='available' WHERE id=${mixLot.id}`;
  await allocate(30);
  const [trace]=await db`SELECT * FROM work_order_material_lots WHERE item_id=${mix.id} AND method='physical_lot'`;
  assert.equal(trace.currency,'EUR');assert.equal(Number(trace.unit_cost),3);assert.equal(Number(trace.quantity),30);
  assert.equal(Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${tenant.id} AND item_id=${mix.id} AND warehouse_id=${warehouses.RAW.id}`)[0].on_hand_qty),45);
  assert.equal(Number((await db`SELECT remaining_qty FROM stock_lots WHERE id=${mixLot.id}`)[0].remaining_qty),30);
  await assert.rejects(()=>postStockEntry(actor,{entryType:'STOCK_RECONCILIATION',idempotencyKey:randomUUID(),lines:[{itemId:mix.id,warehouseId:warehouses.RAW.id,quantityDelta:-1,uom:'adet',metadata:{}}]}),/Lotlu stok farkı/);
  console.log('PASS · consumable FIFO/currency lineage, honest legacy shelf allocation, reserved-lot exclusion, atomic rollback and aggregate correction guard');
  const evidenceBefore=await db`SELECT id,context,results FROM quality_inspections WHERE tenant_id=${tenant.id} ORDER BY id`;
  const migrationStockBefore=await db`SELECT item_id,warehouse_id,on_hand_qty FROM stock_balances WHERE tenant_id=${tenant.id} ORDER BY item_id,warehouse_id`;
  for(const migration of ['023_intake_provenance.sql','024_recipe_parameters.sql','025_production_resources.sql','026_production_analytics.sql','027_quality_traceability.sql'])await db.unsafe(readFileSync('lib/db/migrations/'+migration,'utf8'));
  assert.deepEqual(await db`SELECT id,context,results FROM quality_inspections WHERE tenant_id=${tenant.id} ORDER BY id`,evidenceBefore);
  assert.deepEqual(await db`SELECT item_id,warehouse_id,on_hand_qty FROM stock_balances WHERE tenant_id=${tenant.id} ORDER BY item_id,warehouse_id`,migrationStockBefore);
  console.log('PASS · additive manufacturing migrations repeat without changing stock or quality evidence');
  mkdirSync(".data", { recursive: true });
  writeFileSync(
    ".data/production-test-fixture.json",
    JSON.stringify({
      tenantId: tenant.id,
      ownerId: user.id,
      ownerEmail,
      workerId: worker.id,
      workerEmail: worker.email,
      password,
      jobId: job2.id,
      quotationId: quote.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    "PASS · quote persistence/conversion, recipe immutability, concurrent reservation, remnants/scrap mass, WIP balance, partial production, rework history, stale-version/worker guards, double completion, partial shipment, private/revoked tracking, duplicate intake approval, capacity scheduling, quote revisions/idempotency, measured scraps, profile rework using remnants, partially packed rework, receipt reversal, delivery, failed notification queue, signed/deduplicated incoming WhatsApp",
  );
  await db.end();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
