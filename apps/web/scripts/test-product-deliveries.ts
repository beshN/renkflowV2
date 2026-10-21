/** Synthetic standards verify the flow; these are never real workshop engineering rules. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { localTestDatabaseURL } from "./local-test-database";

async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = "integration-test-secret-local-only-1234567890";
  process.env.NATIVE_INVENTORY_ENABLED = "1";
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  const { productionCommand } =
    await import("../lib/features/manufacturing/platform.service");
  const { PostgresQuotationService } =
    await import("../lib/features/quotations/postgres.service");
  const {
    attachTechnicalSheet,
    approveTechnicalPlan,
    technicalWorkspace,
    refreshTechnicalDraft,
    saveDrillingRule,
    recheckTechnicalRules,
  } = await import("../lib/features/orders/technical.server");
  const { resolveRevisionMaterials } =
    await import("../lib/features/orders/revision-materials.server");
  const { proposeChange, decideChange } =
    await import("../lib/features/sales/orders.server");
  const { emptyFoy } = await import("../lib/features/foy/types");
  const { foyCutRows } = await import("../lib/features/manufacturing/cut-list");
  const [t] =
    await db`INSERT INTO tenants(name,slug) VALUES('Synthetic product deliveries',${randomUUID()}) RETURNING id`;
  const [owner] =
    await db`INSERT INTO users(name,email) VALUES('Product owner',${randomUUID() + "@test.invalid"}) RETURNING id`;
  const [worker] =
    await db`INSERT INTO users(name,email) VALUES('Product worker',${randomUUID() + "@test.invalid"}) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t.id},${owner.id},'owner'),(${t.id},${worker.id},'worker')`;
  const a = { tenantId: t.id, userId: owner.id, role: "owner" as const };
  const w = { ...a, userId: worker.id, role: "worker" as const };
  const command = (
    action: string,
    data: any,
    actor = a as typeof a | typeof w,
  ) => productionCommand(actor, { commandId: randomUUID(), action, data });
  const wh: Record<string, string> = {};
  for (const type of ["RAW", "WIP", "FINISHED", "REUSABLE_REMNANTS"]) {
    const [row] =
      await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type) VALUES(${t.id},${type},${type},${type}) RETURNING id`;
    wh[type] = row.id;
  }
  const [customer] =
    await db`INSERT INTO customers(tenant_id,full_name) VALUES(${t.id},'Synthetic customer') RETURNING id`;
  await command("center.save", {
    code: "ASSEMBLY",
    name: "Son hazırlık",
    parallelCapacity: 1,
    shiftStart: "08:00",
    shiftEnd: "17:00",
    workDays: [1, 2, 3, 4, 5],
  });
  await command("preferences.save", {
    kerfMm: 3,
    trimStartMm: 5,
    trimEndMm: 5,
    minimumRemnantMm: 500,
    cuttingConfirmed: true,
    emailEnabled: false,
    whatsappEnabled: false,
    productionLeadUserId: worker.id,
  });
  for (const [index, family] of [
    "wind-manual",
    "wind-piston",
    "giyotin",
    "pergola",
    "pergola",
  ].entries()) {
    const vertical = index < 3,
      code = vertical ? "FIXTURE-" + index : index === 3 ? "6015" : "6056",
      projectionMm = vertical ? 0 : 1500;
    const profile = await command("material.save", {
      sku: code,
      name:
        index === 3
          ? "6015 Klasik Dere"
          : index === 4
            ? "6056 Oval Dere"
            : "Synthetic profile " + index,
      itemType: "raw_material",
      uom: "m",
      profileCode: code,
      processedStates: [index === 1 ? "boyasiz" : "boyali"],
      standardLengthMm: 6000,
      weightPerMeterKg: 1,
    });
    const finished = await command("material.save", {
      sku: code + "-FIN",
      name: "Synthetic " + family,
      itemType: "finished_good",
      uom: "adet",
    });
    const recipe = await command("recipe.save", {
      code,
      name: "Synthetic verified " + family,
      version: 1,
      finishedItemId: finished.id,
      geometry: vertical ? "vertical" : "roof",
      verificationSource:
        "Synthetic test drawing; not a real production standard",
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
          name: "Kesim",
          workCenterCode: "ASSEMBLY",
          minutesFormula: "1",
          qualityChecks: [],
        },
        {
          name: "Boya",
          workCenterCode: "ASSEMBLY",
          minutesFormula: "1",
          qualityChecks: [],
        },
        {
          name: "Son hazırlık",
          workCenterCode: "ASSEMBLY",
          minutesFormula: "1",
          qualityChecks: [
            { id: "mechanism", name: "Mekanizma kontrolü", kind: "pass_fail" },
          ],
        },
      ],
      limits: {
        minWidthMm: 500,
        maxWidthMm: 3000,
        minProjectionMm: vertical ? 0 : 500,
        maxProjectionMm: vertical ? 0 : 3000,
        minMountingHeightMm: 500,
        maxMountingHeightMm: 3000,
      },
      examples: [1000, 1500].map((widthMm) => ({
        parameters: {
          widthMm,
          projectionMm,
          mountingHeightMm: 1200,
          quantity: 1,
          motor: family === "giyotin",
        },
        expected: [{ itemId: profile.id, quantity: widthMm / 1000 }],
      })),
    });
    await command("recipe.publish", { id: recipe.id });
    await assert.rejects(
      db`UPDATE production_recipes SET verification_source='changed source' WHERE id=${recipe.id}`,
      /immutable/,
    );
    await db`INSERT INTO product_family_recipes(tenant_id,recipe_code,family,created_by) VALUES(${t.id},${code},${family},${owner.id})`;
    if (index !== 2)
      await db`INSERT INTO product_drilling_rules(tenant_id,family,profile_code,mechanism,version,source,rule,approved_by) VALUES(${t.id},${family},${code},${vertical ? code : "standard"},1,'Synthetic verified no-drill reference',${JSON.stringify({ mode: "none", reason: "Synthetic fixture uses a verified no-drill part" })}::text::jsonb,${owner.id})`;
    await command("stock.receive", {
      itemId: profile.id,
      warehouseId: wh.RAW,
      quantity: 1,
      lengthMm: 6000,
      color: index === 1 ? "Boyasız" : "RAL 7016 Mat",
      unitCost: 1,
      lotNumber: code,
    });
    const service = new PostgresQuotationService();
    let quote = await service.createQuotation(
      t.id,
      {
        idempotencyKey: randomUUID(),
        customerId: customer.id,
        customerName: "Synthetic customer",
        currency: "TRY",
        discountPercent: 0,
        items: [
          {
            productName: family,
            quantity: 1,
            unitPrice: 1000,
            discountPercent: 0,
            totalPrice: 1000,
            productConfiguration: {
              family,
              recipeId: recipe.id,
              color: "RAL 7016 Mat",
              parameters: {
                widthMm: 1000,
                projectionMm,
                mountingHeightMm: 1200,
                motor: family === "giyotin",
                led: false,
                customParameters: {},
              },
            },
          },
        ],
      } as any,
      owner.id,
    );
    quote = await service.updateStatus(
      t.id,
      quote.id,
      "sent",
      quote.version,
      owner.id,
      "owner",
    );
    quote = await service.updateStatus(
      t.id,
      quote.id,
      "accepted",
      quote.version,
      owner.id,
      "owner",
    );
    const orderId = quote.orderFileId!;
    const doc = emptyFoy(vertical ? "windbreaker" : "pergola");
    Object.assign(doc, {
      ral: "7016",
      finish: "Mat",
      assembly: "demonte",
      windbreaker: {
        orderDate: null,
        deliveryDate: null,
        systemCount: 1,
        planter: null,
        crate: null,
        widthCm: 100,
        heightCm: 120,
        frameCm: null,
        frameQty: null,
        sashCm: null,
        sashQty: null,
        sashGlass: null,
        frameGlass: null,
        totalKg: null,
        pistonTable: [],
      },
    });
    if (!vertical) {
      doc.windbreaker = null;
      doc.systems = [
        {
          railOuter: 100,
          projection: 150,
          height: null,
          bays: [{ ironInner: 90, railInner: 89 }],
        },
      ];
      doc.cutList = [
        {
          profile: index === 3 ? "6015 Klasik Dere" : "6056 Oval Dere",
          kind: "dere",
          lengthCm: 100,
          widthCm: null,
          quantity: 1,
        },
      ];
    }
    const attached = await attachTechnicalSheet(a, orderId, {
      name: family + ".pdf",
      family,
      doc,
      expectedRevision: 0,
    });
    const workspace = await technicalWorkspace(a, orderId),
      revision = workspace.revisions[0];
    assert.deepEqual(revision.technical.blockers, [], family);
    assert.equal(
      revision.technical.measures[0].projectionMm,
      vertical ? null : 1500,
      "the correct geometry is retained",
    );
    assert.equal(
      revision.plan.rows[0].lengthMm,
      1000,
      "cuts are generated from the verified recipe",
    );
    const approved = await approveTechnicalPlan(a, orderId, attached.id);
    let [job] =
      await db`SELECT * FROM work_orders WHERE tenant_id=${t.id} AND order_id=${orderId}`;
    await db`UPDATE work_orders SET assigned_to=${worker.id} WHERE id=${job.id}`;
    await db`UPDATE production_operations SET assigned_to=${worker.id} WHERE work_order_id=${job.id}`;
    const [plan] =
      await db`SELECT * FROM cutting_plans WHERE id=${approved.cutPlanId}`;
    let sharedOthers:string[]=[];
    if(index===0){
      // A synthetic legacy pool: A's first bar will be cut; two other orders still share a second.
      // The modern order-file path plans separately, but must preserve these existing pools.
      await command('stock.receive',{itemId:profile.id,warehouseId:wh.RAW,quantity:1,lengthMm:6000,color:'RAL 7016 Mat',unitCost:1,lotNumber:'SHARED-PENDING'});
      const [lot]=await db`SELECT * FROM stock_lots WHERE tenant_id=${t.id} AND lot_number='SHARED-PENDING-1'`;
      for(let n=0;n<2;n++){
        const [otherOrder]=await db`INSERT INTO orders(tenant_id,order_number,customer_name,product_name,quantity,status,total_amount,currency) VALUES(${t.id},${'SHARED-'+n},'Synthetic shared customer','Rüzgâr kırıcı',1,'in_production',1,'TRY') RETURNING id`;
        const [otherTechnical]=await db`INSERT INTO order_technical_revisions(tenant_id,order_id,revision,family,status,source_name,source_hash,document,technical,plan,created_by,approved_by,approved_at) SELECT tenant_id,${otherOrder.id},1,family,'approved',source_name,${randomUUID()},document,technical,plan,created_by,approved_by,approved_at FROM order_technical_revisions WHERE id=${attached.id} RETURNING id`;
        const [other]=await db`INSERT INTO work_orders(tenant_id,title,category,order_id,recipe_id,production_item_id,planned_qty,production_uom,source_warehouse_id,wip_warehouse_id,target_warehouse_id,configuration,bom_snapshot,created_by,assigned_to,technical_revision_id,cut_plan_id) SELECT tenant_id,${'Synthetic shared '+n},category,${otherOrder.id},recipe_id,production_item_id,planned_qty,production_uom,source_warehouse_id,wip_warehouse_id,target_warehouse_id,configuration,bom_snapshot,created_by,assigned_to,${otherTechnical.id},cut_plan_id FROM work_orders WHERE id=${job.id} RETURNING id`;
        sharedOthers.push(other.id);
        await db`INSERT INTO work_order_materials(tenant_id,work_order_id,item_id,source_warehouse_id,required_qty,uom) VALUES(${t.id},${other.id},${profile.id},${wh.RAW},1,'m')`;
        await db`INSERT INTO production_parts(tenant_id,work_order_id,technical_revision_id,cut_plan_id,source_lot_id,item_id,length_mm,sequence,weight_per_meter_kg) VALUES(${t.id},${other.id},${otherTechnical.id},${plan.id},${lot.id},${profile.id},1000,${n+2},1)`;
      }
      const pieces=sharedOthers.map(id=>({workOrderId:id,lengthMm:1000}));
      const bar={...plan.result.bars[0],source:{...plan.result.bars[0].source,id:lot.id},pieces,usedMm:2016,remainingMm:3984,lossMm:16,reusable:true};
      const pooled={...plan.result,bars:[...plan.result.bars,bar]};
      await db`UPDATE cutting_plans SET work_order_ids=${[job.id,...sharedOthers]},result=${JSON.stringify(pooled)}::text::jsonb WHERE id=${plan.id}`;
      await db`UPDATE stock_lots SET status='reserved' WHERE id=${lot.id}`;
      await db`INSERT INTO cutting_plan_sources(tenant_id,plan_id,lot_id) VALUES(${t.id},${plan.id},${lot.id})`;
      const [reservation]=await db`SELECT id FROM stock_reservations WHERE tenant_id=${t.id} AND idempotency_key=${'cut-plan:'+plan.id}`;
      await db`INSERT INTO stock_reservation_lines(tenant_id,reservation_id,item_id,warehouse_id,lot_id,reserved_qty) VALUES(${t.id},${reservation.id},${profile.id},${wh.RAW},${lot.id},6)`;
    }
    if (index === 0) {
      const team = await import("../lib/security/team.server");
      const roleId = await team.saveRole(a, null, {
        name: "Synthetic stock reader",
        base: "worker",
        permissions: { production: ["view"], inventory: ["view"] },
        hidden: [],
      });
      await team.updateMember(a, worker.id, { accessRole: roleId });
      await assert.rejects(
        command(
          "cut.complete",
          { id: plan.id, version: plan.version, confirmed: true },
          w,
        ),
        (error: any) => error.status === 403,
        "daily commands honor a freshly revoked edit permission",
      );
      const [before] =
        await db`SELECT count(*)::int n FROM stock_entries WHERE tenant_id=${t.id}`;
      const label = await command(
        "warehouse.label.issue",
        { kind: "lot", id: plan.result.bars[0].source.id },
        w,
      );
      await command("warehouse.label.print", { ids: [label.id] }, w);
      await command("warehouse.label.print", { ids: [label.id] }, w);
      const { resolveLabel } =
        await import("../lib/features/warehouse/service");
      const scanned = await resolveLabel(w, label.code);
      assert.equal(scanned.record?.lengthMm || scanned.lengthMm, 6000);
      assert.equal(
        (
          await db`SELECT count(*)::int n FROM stock_entries WHERE tenant_id=${t.id}`
        )[0].n,
        before.n,
        "issuing, reprinting and scanning a label never adds stock",
      );
      await team.updateMember(a, worker.id, { accessRole: null });
    }
    await command(
      "cut.complete",
      { id: plan.id, version: plan.version, confirmed: true,sourceLotIds:index===0?[plan.result.bars[0].source.id]:undefined },
      w,
    );
    const { recordPartProgress } =
      await import("../lib/features/manufacturing/parts.server");
    if (index < 2) {
      const oldJob = job.id,
        oldPlan = plan.id;
      const [item] =
        await db`SELECT id FROM order_items WHERE order_id=${orderId}`;
      const [oldPart] =
        await db`SELECT * FROM production_parts WHERE work_order_id=${job.id}`;
      const oldPaint = {
        workOrderId: job.id,
        technicalRevisionId: attached.id,
        itemId: oldPart.item_id,
        lengthMm: Number(oldPart.length_mm),
        targetColor: oldPart.target_color,
        quantity: 1,
      };
      if (index === 1)
        await recordPartProgress(w, {
          ...oldPaint,
          commandId: randomUUID(),
          action: "paint.send",
        });
      const change = await proposeChange(a, orderId, {
        reason: "Synthetic approved width correction",
        lines: [{ orderItemId: item.id, widthMm: 900 }],
      });
      await decideChange(a, orderId, change.id, {
        decision: "apply",
        acknowledgeImpact: true,
      });
      assert.equal(
        (
          await db`SELECT status FROM order_technical_revisions WHERE id=${attached.id}`
        )[0].status,
        "blocked",
        "old technical data cannot continue after an order change",
      );
      const [waitingOp] =
        await db`SELECT * FROM production_operations WHERE work_order_id=${job.id} AND name='Son hazırlık'`;
      await assert.rejects(
        command(
          "operation",
          {
            operationId: waitingOp.id,
            version: waitingOp.version,
            action: "start",
          },
          w,
        ),
        /Teknik/,
      );
      doc.windbreaker!.widthCm = 90;
      const revised = await attachTechnicalSheet(a, orderId, {
        name: "revised.pdf",
        family,
        doc,
        expectedRevision: attached.revision,
        revisionReason: "Synthetic new cut length",
      });
      await assert.rejects(
        approveTechnicalPlan(a, orderId, revised.id),
        /yeniden kesim/,
      );
      const [part] =
        await db`SELECT id FROM production_parts WHERE work_order_id=${oldJob}`;
      const decision = {
        commandId: randomUUID(),
        revisionId: revised.id,
        reason: "Synthetic measured piece disposition",
        decisions: [
          { partId: part.id, disposition: index === 0 ? "reuse" : "scrap" },
        ],
        sharedPlans:index===0?[{planId:plan.id,version:(await db`SELECT version FROM cutting_plans WHERE id=${plan.id}`)[0].version}]:[],
      };
      await assert.rejects(
        resolveRevisionMaterials(w, orderId, decision),
        /yetki/,
      );
      if (index === 1) {
        await assert.rejects(
          resolveRevisionMaterials(a, orderId, decision),
          /Boyadaki/,
        );
        await assert.rejects(
          recordPartProgress(w, {
            ...oldPaint,
            commandId: randomUUID(),
            action: "paint.send",
          }),
          /Teknik plan/,
        );
        await recordPartProgress(w, {
          ...oldPaint,
          commandId: randomUUID(),
          action: "paint.return",
        });
      }
      if(index===0){
        const before=Number((await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id=${t.id}`)[0].n);
        await assert.rejects(resolveRevisionMaterials(a,orderId,{...decision,sharedPlans:[]}),/Ortak kesim/);
        assert.equal(Number((await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id=${t.id}`)[0].n),before,'missing shared-plan acknowledgement rolls the whole transaction back');
      }
      const resolved = await resolveRevisionMaterials(a, orderId, decision);
      assert.equal(
        (await resolveRevisionMaterials(a, orderId, decision)).replayed,
        true,
      );
      assert.equal(resolved.returned.length, index === 0 ? 1 : 0);
      assert.equal(resolved.scrapped.length, index === 1 ? 1 : 0);
      if(index===0){
        assert.equal(resolved.sharedSuccessors.length,1);
        const nextId=resolved.sharedSuccessors[0].planId;
        const [next]=await db`SELECT * FROM cutting_plans WHERE id=${nextId}`;
        assert.deepEqual(next.work_order_ids.sort(),sharedOthers.sort());
        assert(next.result.bars.every((b:any)=>b.pieces.every((p:any)=>sharedOthers.includes(p.workOrderId))));
        assert.equal((await db`SELECT status FROM stock_lots WHERE id=${next.result.bars[0].source.id}`)[0].status,'reserved');
        await assert.rejects(command('cut.cancel',{id:plan.id,version:(await db`SELECT version FROM cutting_plans WHERE id=${plan.id}`)[0].version}),/Teknik|değiştirilemez/);
        await command('cut.complete',{id:nextId,version:next.version,confirmed:true},w);
        assert.equal((await db`SELECT count(*)::int AS n FROM production_parts WHERE work_order_id=ANY(${sharedOthers}::uuid[]) AND state='cut'`)[0].n,2);
        assert.equal((await db`SELECT count(*)::int AS n FROM cutting_losses WHERE plan_id=${nextId}`)[0].n,1);
      }
      assert.equal(
        (await db`SELECT status FROM work_orders WHERE id=${oldJob}`)[0].status,
        "cancelled",
      );
      assert.equal(
        (
          await db`SELECT count(*)::int n FROM cutting_losses WHERE plan_id=${oldPlan}`
        )[0].n,
        1,
        "the original actual loss remains",
      );
      const fresh = await refreshTechnicalDraft(
        a,
        orderId,
        revised.id,
        randomUUID(),
      );
      const nextWorkspace = await technicalWorkspace(a, orderId);
      assert.deepEqual(nextWorkspace.revisions[0].technical.blockers, []);
      const second = await approveTechnicalPlan(a, orderId, fresh.id);
      [job] =
        await db`SELECT * FROM work_orders WHERE order_id=${orderId} AND status<>'cancelled'`;
      await db`UPDATE work_orders SET assigned_to=${worker.id} WHERE id=${job.id}`;
      await db`UPDATE production_operations SET assigned_to=${worker.id} WHERE work_order_id=${job.id}`;
      const [nextPlan] =
        await db`SELECT * FROM cutting_plans WHERE id=${second.cutPlanId}`;
      if (index === 0)
        assert.equal(
          nextPlan.result.bars[0].source.id,
          resolved.returned[0].lotId,
          "the measured old piece is compared as a reusable physical bar",
        );
      await command(
        "cut.complete",
        { id: nextPlan.id, version: nextPlan.version, confirmed: true },
        w,
      );
    }
    if (index === 1) {
      const [paintPart] =
        await db`SELECT * FROM production_parts WHERE work_order_id=${job.id}`;
      const paint = {
        workOrderId: job.id,
        technicalRevisionId: paintPart.technical_revision_id,
        itemId: paintPart.item_id,
        lengthMm: Number(paintPart.length_mm),
        targetColor: paintPart.target_color,
        quantity: 1,
      };
      await recordPartProgress(w, {
        ...paint,
        commandId: randomUUID(),
        action: "paint.send",
      });
      await recordPartProgress(w, {
        ...paint,
        commandId: randomUUID(),
        action: "paint.return",
      });
    }
    const ops =
      await db`SELECT * FROM production_operations WHERE work_order_id=${job.id} ORDER BY position`;
    assert.equal(
      ops[0].status,
      "done",
      "physical cuts finish the cutting step",
    );
    assert.equal(ops[1].status, "done", "painted stock skips painting");
    assert.equal(Number(ops[1].completed_qty), 1);
    let op = ops[2];
    await command(
      "operation",
      { operationId: op.id, version: op.version, action: "start" },
      w,
    );
    [op] = await db`SELECT * FROM production_operations WHERE id=${op.id}`;
    await assert.rejects(
      command(
        "operation",
        {
          operationId: op.id,
          version: op.version,
          action: "complete",
          quantity: 1,
        },
        w,
      ),
      /kontrol|Delik/i,
    );
    if (index === 2) {
      await assert.rejects(
        command(
          "operation",
          {
            operationId: op.id,
            version: op.version,
            action: "complete",
            quantity: 1,
            qualityResults: [{ checkId: "mechanism", passed: true }],
          },
          w,
        ),
        /Delik/,
      );
      const rule = {
        revisionId: attached.id,
        itemId: profile.id,
        expectedVersion: 0,
        source: "Synthetic verified fixture drawing: no-drill part",
        rule: { mode: "none", reason: "Verified fixture drawing has no holes" },
      };
      await assert.rejects(saveDrillingRule(w, orderId, rule), /yetki/);
      await saveDrillingRule(a, orderId, rule);
      await assert.rejects(saveDrillingRule(a, orderId, rule), /başka cihazda/);
      const [before] =
        await db`SELECT count(*)::int n FROM stock_entries WHERE tenant_id=${t.id}`;
      const checked = await recheckTechnicalRules(
        a,
        orderId,
        attached.id,
        randomUUID(),
      );
      await approveTechnicalPlan(a, orderId, checked.id);
      assert.equal(
        (
          await db`SELECT count(*)::int n FROM stock_entries WHERE tenant_id=${t.id}`
        )[0].n,
        before.n,
        "publishing the verified rule does not redo actual cuts",
      );
      [op] = await db`SELECT * FROM production_operations WHERE id=${op.id}`;
      await command(
        "operation",
        { operationId: op.id, version: op.version, action: "start" },
        w,
      );
      [op] = await db`SELECT * FROM production_operations WHERE id=${op.id}`;
    }
    await command(
      "operation",
      {
        operationId: op.id,
        version: op.version,
        action: "complete",
        quantity: 1,
        qualityResults: [{ checkId: "mechanism", passed: true }],
      },
      w,
    );
    assert.equal(
      Number(
        (await db`SELECT produced_qty FROM work_orders WHERE id=${job.id}`)[0]
          .produced_qty,
      ),
      1,
    );
    assert.equal(
      (
        await db`SELECT state FROM production_parts WHERE work_order_id=${job.id}`
      )[0].state,
      "assembled",
    );
    if(index>=2){
      [job]=await db`SELECT * FROM work_orders WHERE id=${job.id}`;
      const [part]=await db`SELECT * FROM production_parts WHERE work_order_id=${job.id}`;
      const [file]=await db`INSERT INTO production_files(tenant_id,work_order_id,created_by,name,mime,body) VALUES(${t.id},${job.id},${owner.id},'synthetic-disposition.png','image/png',${Buffer.from([137,80,78,71,13,10,26,10])}) RETURNING id`;
      const [item]=await db`SELECT id FROM order_items WHERE order_id=${orderId}`;
      const change=await proposeChange(a,orderId,{reason:'Synthetic correction after final assembly',lines:[{orderItemId:item.id,widthMm:900}]});
      await decideChange(a,orderId,change.id,{decision:'apply',acknowledgeImpact:true});
      if(vertical)doc.windbreaker!.widthCm=90;
      else{doc.systems[0].railOuter=90;doc.cutList[0].lengthCm=90;}
      const [latest]=await db`SELECT revision FROM order_technical_revisions WHERE order_id=${orderId} ORDER BY revision DESC LIMIT 1`;
      const revised=await attachTechnicalSheet(a,orderId,{name:'after-assembly.pdf',family,doc,expectedRevision:latest.revision,revisionReason:'Synthetic measured change after assembly'});
      const disposition=index===2?'keep_stock':index===3?'scrap':'disassemble';
      const decision={commandId:randomUUID(),revisionId:revised.id,reason:'Synthetic physical finished-product disposition',finishedProducts:[{workOrderId:job.id,revision:job.revision,quantity:1,disposition,photos:[`/api/v1/production/files/${t.id}/${file.id}`]}],decisions:disposition==='disassemble'?[{partId:part.id,disposition:'reuse',actualLengthMm:950}]:[]};
      await assert.rejects(resolveRevisionMaterials(a,orderId,{...decision,finishedProducts:[]}),/Tamamlanmış/);
      await assert.rejects(resolveRevisionMaterials(a,orderId,{...decision,finishedProducts:[{...decision.finishedProducts[0],revision:job.revision-1}]}),/sürümü değişti/);
      const resolved=await resolveRevisionMaterials(a,orderId,decision);
      assert.equal(resolved.finishedProducts[0].unitIds.length,1);
      assert.equal((await resolveRevisionMaterials(a,orderId,decision)).replayed,true);
      const balance=Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${t.id} AND item_id=${finished.id} AND warehouse_id=${wh.FINISHED}`)[0].on_hand_qty);
      assert.equal(balance,disposition==='keep_stock'?1:0);
      assert.equal((await db`SELECT count(*)::int AS n FROM production_runs WHERE work_order_id=${job.id}`)[0].n,1,'original manufacture remains in history');
      if(disposition==='disassemble'){
        assert.equal(resolved.returned[0].lengthMm,950);
        assert.equal(resolved.scrapped[0].lengthMm,50);
        assert.equal(Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${t.id} AND item_id=${profile.id} AND warehouse_id=${wh.WIP}`)[0].on_hand_qty),0);
      }
      const fresh=await refreshTechnicalDraft(a,orderId,revised.id,randomUUID());
      await approveTechnicalPlan(a,orderId,fresh.id);
      assert.equal((await db`SELECT count(*)::int AS n FROM work_orders WHERE order_id=${orderId} AND status<>'cancelled'`)[0].n,1);
    }
  }
  for (const [name, expected] of [
    ["6015 Klasik Dere", "6015"],
    ["6056 Oval Dere", "6056"],
  ]) {
    const doc = emptyFoy("pergola");
    doc.cutList = [
      {
        profile: name,
        kind: "dere",
        lengthCm: 400,
        widthCm: null,
        quantity: 1,
      },
    ];
    assert.equal(
      foyCutRows(doc, "pergola").rows[0].requiredProfileCode,
      expected,
    );
  }
  await db.end();
  const { sql } = await import("../lib/db");
  await sql.end();
  console.log(
    "Product deliveries: verified vertical geometry, recipe cuts, paint skip, required quality, exact pergola gutters passed",
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
