/** Device authority stays separate from member authority; real transitions retain production invariants. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { localTestDatabaseURL } from "./local-test-database";
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = "station-test-only-1234567890123456789012345";
  process.env.NATIVE_INVENTORY_ENABLED = "1";
  process.env.STORAGE_BACKEND = "local";
  process.env.ALLOW_LOCAL_STORAGE = "1";
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS name`)[0].name,
    "renkflow_test",
  );
  const [tenant] =
    await db`INSERT INTO tenants(name,slug) VALUES('İstasyon QA',${"station-" + randomUUID()}) RETURNING id,slug`;
  const [other] =
    await db`INSERT INTO tenants(name,slug) VALUES('Other station',${"other-" + randomUUID()}) RETURNING id`;
  const email = randomUUID() + "@example.invalid",
    password = "Station-Test-123!";
  const [owner] =
    await db`INSERT INTO users(name,email,password,email_verified) VALUES('Station administrator',${email},${await bcrypt.hash(password, 10)},now()) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${owner.id},'owner'),(${other.id},${owner.id},'owner')`;
  const actor = {
    userId: owner.id,
    tenantId: tenant.id,
    role: "owner" as const,
  };
  const { productionCommand } =
    await import("../lib/features/manufacturing/platform.service");
  const command = (action: string, data: unknown) =>
    productionCommand(actor, { commandId: randomUUID(), action, data });
  for (const [code, name] of [
    ["CUT", "Kesim"],
    ["ASSEMBLY", "Montaj"],
    ["PACK", "Paketleme"],
  ])
    await db`INSERT INTO work_centers(tenant_id,code,name,parallel_capacity) VALUES(${tenant.id},${code},${name},3)`;
  const raw = await command("warehouse.save", {
      code: "RAW",
      name: "Hammadde",
      type: "RAW",
    }),
    wip = await command("warehouse.save", {
      code: "WIP",
      name: "Üretim",
      type: "WIP",
    }),
    finishedWarehouse = await command("warehouse.save", {
      code: "FG",
      name: "Mamul",
      type: "FINISHED",
    });
  const finished = await command("material.save", {
    sku: "QA-FG",
    name: "Makaslı tente",
    itemType: "finished_good",
    uom: "adet",
    standardLengthMm: 0,
    weightPerMeterKg: 0,
  });
  const profile = await command("material.save", {
    sku: "QA-PROFILE",
    name: "Taşıyıcı profil",
    itemType: "raw_material",
    uom: "m",
    standardLengthMm: 6000,
    weightPerMeterKg: 1,
  });
  const accessory = await command("material.save", {
    sku: "QA-SCREW",
    name: "Montaj vida seti",
    itemType: "consumable",
    uom: "adet",
    standardLengthMm: 0,
    weightPerMeterKg: 0,
  });
  const { postStockEntry } =
    await import("../lib/features/manufacturing/inventory.service");
  await postStockEntry(actor, {
    entryType: "MATERIAL_RECEIPT",
    idempotencyKey: randomUUID(),
    lines: [
      {
        itemId: accessory.id,
        warehouseId: wip.id,
        quantityDelta: 2,
        uom: "adet",
        metadata: {},
      },
    ],
  });
  const [order] =
    await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount,status) VALUES(${tenant.id},${"STA-" + randomUUID().slice(0, 8)},'PRIVATE CUSTOMER SHOULD NOT LEAK',1234,'in_production') RETURNING id,order_number`;
  const config = {
    family: "pergola",
    widthMm: 4000,
    projectionMm: 3000,
    mountingHeightMm: 2500,
    bodyName: "RAL 7016",
    private_customer: "PRIVATE CONTACT",
    unitPrice: 1234,
  };
  const snapshot = {
    cuts: [{ itemId: profile.id, lengthMm: 4000, quantity: 2 }],
    materials: [],
    operations: [],
    recipe: {},
  };
  const [job] =
    await db`INSERT INTO work_orders(tenant_id,title,category,order_id,production_item_id,planned_qty,production_uom,source_warehouse_id,wip_warehouse_id,target_warehouse_id,configuration,bom_snapshot,created_by,reservation_status,status) VALUES(${tenant.id},'Private customer work title','production',${order.id},${finished.id},1,'adet',${raw.id},${wip.id},${finishedWarehouse.id},${JSON.stringify(config)}::text::jsonb,${JSON.stringify(snapshot)}::text::jsonb,${owner.id},'transferred','open') RETURNING id`;
  await db`INSERT INTO work_order_materials(tenant_id,work_order_id,item_id,source_warehouse_id,required_qty,transferred_qty,reserved_qty,uom) VALUES(${tenant.id},${job.id},${accessory.id},${raw.id},2,2,2,'adet')`;
  const ops = [];
  for (const [position, code, name] of [
    [0, "CUT", "Kesim"],
    [1, "ASSEMBLY", "Montaj"],
    [2, "PACK", "Paketleme"],
  ] as const) {
    const [op] =
      await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty) VALUES(${tenant.id},${job.id},${position},${name},${code},5,${position === 0 ? "ready" : "waiting"},1) RETURNING id,version`;
    ops.push(op);
  }
  const knowledge = await import("../lib/features/knowledge/service.server");
  const technicalPdf = readFileSync(
    "__tests__/fixtures/foy/pergola-two-systems.pdf",
  );
  const instruction = await knowledge.saveKnowledge(actor, {
    title: "Makaslı tente · Montaj talimatı",
    content:
      "1. Profil ölçülerini çizimle karşılaştırın.\n2. Bağlantıları kontrol edin.\n3. Son kontrolü kaydedin.",
    visibility: "company",
    version: 0,
    file: {
      name: "montaj-talimatı.pdf",
      mime: "application/pdf",
      base64: technicalPdf.toString("base64"),
    },
  });
  const admin = await import("../lib/features/stations/admin.server");
  const service = await import("../lib/features/stations/service.server");
  const security = await import("../lib/features/stations/security.server");
  const create = async (
    kind: "cutting" | "assembly" | "packing" | "warehouse",
    code: string | null,
    warehouseId: string | null,
  ) =>
    admin.manageStation(actor, {
      action: "save",
      version: 0,
      definition: {
        name: kind + " QA",
        kind,
        workCenterCode: code,
        warehouseId,
        checklistLabels: kind === "warehouse" ? [] : ["Ölçüler doğrulandı"],
        instructionIds: kind === "assembly" ? [instruction.id] : [],
      },
    });
  const cut = await create("cutting", "CUT", null),
    assembly = await create("assembly", "ASSEMBLY", null),
    pack = await create("packing", "PACK", null),
    warehouse = await create("warehouse", null, raw.id);
  await assert.rejects(
    () =>
      admin.manageStation(
        { ...actor, tenantId: other.id },
        {
          action: "save",
          version: 0,
          definition: {
            name: "Foreign warehouse",
            kind: "warehouse",
            warehouseId: raw.id,
          },
        },
      ),
    (e: any) => e.status === 404,
  );
  await assert.rejects(
    () =>
      admin.manageStation(actor, { action: "pair", id: cut.id, version: 0 }),
    (e: any) => e.status === 409,
  );
  const pair = async (id: string, version: number) => {
    const issued = (await admin.manageStation(actor, {
      action: "pair",
      id,
      version,
    })) as any;
    const request = new NextRequest("http://localhost:3025/api/station/pair");
    const paired = await service.pairStation(request, { code: issued.code });
    await assert.rejects(
      () => service.pairStation(request, { code: issued.code }),
      (e: any) => e.status === 401,
    );
    const req = new NextRequest("http://localhost:3025/api/station", {
      headers: { cookie: "rf-station-local=" + paired.secret },
    });
    return {
      req,
      secret: paired.secret,
      device: await security.stationDevice(req),
    };
  };
  const cutting = await pair(cut.id, 1),
    assembling = await pair(assembly.id, 1),
    packing = await pair(pack.id, 1),
    depot = await pair(warehouse.id, 1);
  await postStockEntry(actor, {
    entryType: "MATERIAL_RECEIPT",
    idempotencyKey: randomUUID(),
    lines: [
      {
        itemId: accessory.id,
        warehouseId: raw.id,
        quantityDelta: 10,
        uom: "adet",
        metadata: {},
      },
    ],
  });
  const warehouseView = await service.stationOverview(depot.device, "QA-SCREW");
  assert.ok(
    warehouseView.balances.some(
      (balance: any) =>
        balance.sku === "QA-SCREW" && Number(balance.quantity) === 10,
    ),
  );
  assert.ok(
    warehouseView.moves.some(
      (move: any) =>
        move.sku === "QA-SCREW" && Number(move.quantity_delta) === 10,
    ),
  );
  assert.equal(
    (await service.stationOverview(depot.device, "missing-stock")).balances
      .length,
    0,
  );
  assert.ok(!JSON.stringify(warehouseView).includes("unit_cost"));
  assert.equal(
    (await service.stationOverview(assembling.device)).instructions[0].id,
    instruction.id,
  );
  assert.equal(
    (
      await new Response(
        (
          await service.stationFile(
            assembling.device,
            "knowledge",
            instruction.id,
          )
        ).body,
      ).arrayBuffer()
    ).byteLength,
    technicalPdf.length,
  );
  await assert.rejects(
    () => service.stationFile(cutting.device, "knowledge", instruction.id),
    (e: any) => e.status === 404,
  );
  await knowledge.saveKnowledge(actor, {
    id: instruction.id,
    version: 1,
    title: "Montaj talimatı",
    visibility: "office",
  });
  assert.equal(
    (await service.stationOverview(assembling.device)).instructions.length,
    0,
  );
  await assert.rejects(
    () => service.stationFile(assembling.device, "knowledge", instruction.id),
    (e: any) => e.status === 404,
  );
  await knowledge.saveKnowledge(actor, {
    id: instruction.id,
    version: 2,
    title: "Makaslı tente · Montaj talimatı",
    content:
      "1. Profil ölçülerini çizimle karşılaştırın.\n2. Bağlantıları kontrol edin.\n3. Son kontrolü kaydedin.",
    visibility: "company",
  });
  const snapshotData = await service.stationOverview(cutting.device);
  assert.equal(snapshotData.operations.length, 1);
  assert.equal(snapshotData.operations[0].configuration.widthMm, 4000);
  assert.ok(
    snapshotData.operations[0].checklist.some((c) =>
      c.label.includes("4.000 mm"),
    ),
  );
  assert.ok(!JSON.stringify(snapshotData).includes("PRIVATE"));
  assert.ok(!JSON.stringify(snapshotData).includes("unitPrice"));
  const [technical] =
    await db`INSERT INTO production_files(tenant_id,work_order_id,created_by,name,mime,body) VALUES(${tenant.id},${job.id},${owner.id},'teknik.pdf','application/pdf',${technicalPdf}) RETURNING id`;
  assert.equal(
    (await service.stationFile(cutting.device, "production", technical.id))
      .mime,
    "application/pdf",
  );
  await assert.rejects(
    () => service.stationFile(depot.device, "production", technical.id),
    (e: any) => e.status === 404,
  );
  await assert.rejects(
    () =>
      service.stationOperate(assembling.device, {
        commandId: randomUUID(),
        data: { operationId: ops[0].id, version: 1, action: "start" },
      }),
    (e: any) => e.status === 404,
  );
  await assert.rejects(
    () =>
      service.stationOperate(depot.device, {
        commandId: randomUUID(),
        data: { operationId: ops[0].id, version: 1, action: "start" },
      }),
    (e: any) => e.status === 403,
  );
  await assert.rejects(
    () =>
      productionCommand(security.stationActor(cutting.device), {
        commandId: randomUUID(),
        action: "material.save",
        data: {},
      }),
    (e: any) => e.status === 403,
  );
  const startCommand = {
    commandId: randomUUID(),
    data: { operationId: ops[0].id, version: 1, action: "start" },
  };
  await service.stationOperate(cutting.device, startCommand);
  assert.equal(
    (await service.stationOperate(cutting.device, startCommand)).status,
    "running",
  );
  async function finish(device: any, opId: string) {
    let data = await service.stationOverview(device),
      op = data.operations.find((o) => o.id === opId)!;
    if (op.status !== "running") {
      await service.stationOperate(device, {
        commandId: randomUUID(),
        data: { operationId: op.id, version: op.version, action: "start" },
      });
      data = await service.stationOverview(device);
      op = data.operations.find((o) => o.id === opId)!;
    }
    await assert.rejects(
      () =>
        service.stationOperate(device, {
          commandId: randomUUID(),
          data: {
            operationId: op.id,
            version: op.version,
            action: "complete",
            quantity: 1,
          },
        }),
      (e: any) => e.status === 409,
    );
    for (const check of op.checklist)
      await service.saveStationCheck(device, {
        operationId: op.id,
        operationVersion: op.version,
        key: check.key,
        checked: true,
        version: check.version,
      });
    const complete = {
      commandId: randomUUID(),
      data: {
        operationId: op.id,
        version: op.version,
        action: "complete",
        quantity: 1,
      },
    };
    await service.stationOperate(device, complete);
    await service.stationOperate(device, complete);
  }
  await finish(cutting.device, ops[0].id);
  await finish(assembling.device, ops[1].id);
  const packOverview = await service.stationOverview(packing.device);
  assert.ok(
    packOverview.operations[0].checklist.some(
      (check) => check.label === "Montaj vida seti · 2 adet",
    ),
  );
  await finish(packing.device, ops[2].id);
  assert.equal(
    Number(
      (
        await db`SELECT consumed_qty FROM work_order_materials WHERE tenant_id=${tenant.id} AND work_order_id=${job.id} AND item_id=${accessory.id}`
      )[0].consumed_qty,
    ),
    2,
  );
  assert.equal(
    Number(
      (
        await db`SELECT COALESCE(sum(quantity_delta),0) AS qty FROM stock_entry_lines WHERE tenant_id=${tenant.id} AND item_id=${accessory.id} AND warehouse_id=${wip.id}`
      )[0].qty,
    ),
    0,
  );
  assert.equal(
    Number(
      (await db`SELECT produced_qty FROM work_orders WHERE id=${job.id}`)[0]
        .produced_qty,
    ),
    1,
  );
  assert.equal(
    Number(
      (
        await db`SELECT count(*) AS n FROM production_runs WHERE work_order_id=${job.id}`
      )[0].n,
    ),
    1,
  );
  assert.ok(
    (
      await db`SELECT id FROM production_events WHERE tenant_id=${tenant.id} AND payload->>'stationDeviceId'=${cut.id}`
    ).length > 0,
  );
  await assert.rejects(() =>
    security.stationDevice(
      new NextRequest(
        "https://not-" + tenant.slug + ".renkflow.com/api/station",
        { headers: { cookie: "__Host-rf-station=" + cutting.secret } },
      ),
    ),
  );
  const [internalJob] =
    await db`INSERT INTO work_orders(tenant_id,title,category,production_item_id,planned_qty,production_uom,source_warehouse_id,wip_warehouse_id,target_warehouse_id,bom_snapshot,created_by,reservation_status,status) VALUES(${tenant.id},'Private internal title','production',${finished.id},1,'adet',${raw.id},${wip.id},${finishedWarehouse.id},${JSON.stringify(snapshot)}::text::jsonb,${owner.id},'transferred','open') RETURNING id`;
  await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty) VALUES(${tenant.id},${internalJob.id},0,'Kesim','CUT',5,'ready',1)`;
  const internalView = await service.stationOverview(cutting.device);
  assert.equal(internalView.operations.length, 1);
  assert.equal(
    internalView.operations[0].orderNumber,
    "İE-" + internalJob.id.slice(0, 8),
  );
  assert.equal(internalView.operations[0].productName, "Makaslı tente");
  assert.ok(!JSON.stringify(internalView).includes("Private internal title"));
  const current = (await admin.stationSettings(actor)).devices.find(
    (d) => d.id === cut.id,
  )!;
  await admin.manageStation(actor, {
    action: "revoke",
    id: cut.id,
    version: current.version,
  });
  await assert.rejects(
    () => security.stationDevice(cutting.req),
    (e: any) => e.status === 401,
  );
  await assert.rejects(
    () => service.stationOperate(cutting.device, startCommand),
    (e: any) => e.status === 403,
  );
  await assert.rejects(
    () =>
      security.stationDevice(
        new NextRequest("http://localhost:3025/api/station"),
      ),
    (e: any) => e.status === 401,
  );
  if (process.env.RENKFLOW_BROWSER_FIXTURE === "1") {
    const [browserOrder] =
      await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount,status) VALUES(${tenant.id},${"DEMO-" + randomUUID().slice(0, 6)},'Station browser QA',0,'in_production') RETURNING id`;
    const [browserJob] =
      await db`INSERT INTO work_orders(tenant_id,title,category,order_id,production_item_id,planned_qty,production_uom,source_warehouse_id,wip_warehouse_id,target_warehouse_id,configuration,bom_snapshot,created_by,reservation_status,status) SELECT tenant_id,'Makaslı tente · tablet testi',category,${browserOrder.id},production_item_id,1,production_uom,source_warehouse_id,wip_warehouse_id,target_warehouse_id,configuration,bom_snapshot,created_by,'transferred','open' FROM work_orders WHERE id=${job.id} RETURNING id`;
    await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,planned_qty) SELECT tenant_id,${browserJob.id},position,name,work_center_code,planned_minutes,CASE WHEN position=0 THEN 'ready' ELSE 'waiting' END,1 FROM production_operations WHERE work_order_id=${job.id}`;
    await db`INSERT INTO production_files(tenant_id,work_order_id,created_by,name,mime,body) VALUES(${tenant.id},${browserJob.id},${owner.id},'teknik.pdf','application/pdf',${technicalPdf})`;
    await db`INSERT INTO work_order_materials(tenant_id,work_order_id,item_id,source_warehouse_id,required_qty,transferred_qty,reserved_qty,uom) VALUES(${tenant.id},${browserJob.id},${accessory.id},${raw.id},2,2,2,'adet')`;
    await postStockEntry(actor, {
      entryType: "MATERIAL_RECEIPT",
      idempotencyKey: randomUUID(),
      lines: [
        {
          itemId: accessory.id,
          warehouseId: wip.id,
          quantityDelta: 2,
          uom: "adet",
          metadata: {},
        },
      ],
    });
    mkdirSync("../../.data", { recursive: true });
    writeFileSync(
      "../../.data/station-browser-fixture.json",
      JSON.stringify({
        email,
        password,
        tenantId: tenant.id,
        userId: owner.id,
        assemblySecret: assembling.secret,
        warehouseSecret: depot.secret,
        packingSecret: packing.secret,
        jobId: job.id,
        orderId: order.id,
        ops: ops.map((o) => o.id),
      }),
      { mode: 0o600 },
    );
  }
  console.log(
    "PASS one-time pairing, cookie isolation, wrong company/center/warehouse rejection, no commercial fields, checklist guard, real production chain, exact replay, single stock completion, device audit and immediate revocation",
  );
  await db.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
