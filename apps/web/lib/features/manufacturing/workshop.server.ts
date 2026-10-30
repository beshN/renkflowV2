import { getAiSettings } from "@/lib/ai/gate.server";
import { getAIService } from "@/lib/ai/service";
import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sql, withTransaction } from "@/lib/db";
import { resolveMemberAccess } from "@/lib/security/member-access.server";
import { can, type Action, type Module } from "@/lib/security/access-matrix";
import { recordAudit } from "@/lib/audit/audit-log";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { stableJson } from "../products/configuration";
import {
  ReceiptInputSchema,
  PurchaseInputSchema,
  executeProcurement,
} from "./purchasing.service";
import {
  ProductionFileSchema,
  readProductionInput,
  storeProductionFile,
} from "./files.service";
import { pdfTextItems } from "../warehouse/count-import/extract";
import { receivingMatches } from "./receiving-match";

const fail = (m: string, s = 409): never => {
  throw new WorkOrderApiError(m, s);
};
async function need(a: WorkOrderActor, module: Module, action: Action) {
  const x = await resolveMemberAccess(a.userId, a.tenantId);
  if (!x || x.deactivated || !can(x, module, action))
    fail("Bu işlem için yetkiniz yok", 403);
  return x;
}
const hash = (v: unknown) =>
  createHash("sha256").update(stableJson(v)).digest("hex");
const photos = z.array(z.string().max(500)).max(6).default([]);
async function checkPhotos(
  tx: any,
  a: WorkOrderActor,
  paths: string[],
  jobId?: string,
  purchaseOrderId?: string,
) {
  for (const path of paths) {
    const prefix = `/api/v1/production/files/${a.tenantId}/`,
      id = path.slice(prefix.length);
    if (!path.startsWith(prefix) || !z.uuid().safeParse(id).success)
      fail("Fotoğraf bu firmaya ait değil", 400);
    const [f] =
      await tx`SELECT work_order_id,purchase_order_id FROM production_files WHERE tenant_id=${a.tenantId} AND id=${id} AND mime LIKE 'image/%'`;
    if (
      !f ||
      (jobId && f.work_order_id !== jobId) ||
      (purchaseOrderId && f.purchase_order_id !== purchaseOrderId)
    )
      fail("Fotoğraf ilgili işe ait değil", 400);
  }
}

export async function workshopOverview(a: WorkOrderActor) {
  await need(a, "inventory", "view");
  const requests =
    await sql`SELECT r.id,r.order_id,r.work_order_id,r.request_number,r.status,r.required_by,r.description,r.photos,r.created_by,r.created_at,r.version,o.order_number,
 COALESCE((SELECT json_agg(json_build_object('id',l.id,'itemId',l.item_id,'name',i.name,'quantity',l.quantity,'uom',l.uom,'received',COALESCE((SELECT SUM(p.received_qty) FROM purchase_order_lines p WHERE p.tenant_id=l.tenant_id AND p.material_request_line_id=l.id),0))) FROM material_request_lines l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id WHERE l.tenant_id=r.tenant_id AND l.material_request_id=r.id),'[]'::json) AS lines
 FROM material_requests r LEFT JOIN orders o ON o.id=r.order_id AND o.tenant_id=r.tenant_id WHERE r.tenant_id=${a.tenantId} AND (${a.role !== "worker"} OR r.created_by=${a.userId}) ORDER BY r.created_at DESC LIMIT 300`;
  const orders =
    await sql`SELECT p.id,p.purchase_order_number,p.status,p.version,
 COALESCE((SELECT json_agg(json_build_object('id',l.id,'itemId',l.item_id,'name',i.name,'uom',l.uom,'ordered',l.ordered_qty,'received',l.received_qty,'lengthMm',l.metadata->'lengthMm','color',l.metadata->'color') ORDER BY l.position) FROM purchase_order_lines l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id WHERE l.tenant_id=p.tenant_id AND l.purchase_order_id=p.id),'[]'::json) AS lines
 FROM purchase_orders p WHERE p.tenant_id=${a.tenantId} AND p.status IN('submitted','partially_received') ORDER BY p.expected_at NULLS LAST LIMIT 200`;
  const inspections =
    await sql`SELECT id,purchase_order_id,document_id,status,checklist,photos,notes,checked_at,version FROM receiving_inspections WHERE tenant_id=${a.tenantId} AND (${a.role !== "worker"} OR checked_by=${a.userId}) ORDER BY checked_at DESC LIMIT 200`;
  const items =
    await sql`SELECT id,name,stock_uom FROM inventory_items WHERE tenant_id=${a.tenantId} AND active=true AND item_type<>'finished_good' ORDER BY name LIMIT 2000`;
  const warehouses =
    await sql`SELECT id,name,warehouse_type FROM warehouses WHERE tenant_id=${a.tenantId} AND active=true AND warehouse_type IN('RAW','REJECTED') ORDER BY name`;
  const access = await resolveMemberAccess(a.userId, a.tenantId);
  const suppliers =
    access && can(access, "purchasing", "create")
      ? await sql`SELECT id,name FROM suppliers WHERE tenant_id=${a.tenantId} AND is_active=true ORDER BY name`
      : [];
  return {
    suppliers,
    canPurchase: !!access && can(access, "purchasing", "create"),
    requests,
    orders,
    inspections,
    items,
    warehouses,
    canApprove: !!access && can(access, "purchasing", "approve"),
  };
}
const Request = z
  .object({
    commandId: z.uuid(),
    orderId: z.uuid(),
    workOrderId: z.uuid().optional(),
    itemId: z.uuid().optional(),
    warehouseId: z.uuid().optional(),
    quantity: z.number().finite().positive().max(1000000).optional(),
    requiredBy: z.iso.date().optional(),
    description: z.string().trim().min(3).max(2000),
    photos,
  })
  .strict();
export async function createWorkshopRequest(a: WorkOrderActor, raw: unknown) {
  await need(a, "production", "edit");
  const d = Request.parse(raw);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [prior] =
      await tx`SELECT id,request_hash,created_by FROM material_requests WHERE tenant_id=${a.tenantId} AND command_id=${d.commandId}`;
    if (prior) {
      if (prior.request_hash !== hash(d) || prior.created_by !== a.userId)
        fail("İşlem anahtarı farklı bir talepte kullanılmış");
      return { id: prior.id, replayed: true };
    }
    const [o] =
      await tx`SELECT id FROM orders WHERE tenant_id=${a.tenantId} AND id=${d.orderId}`;
    if (!o) fail("Sipariş bulunamadı", 404);
    const [job] =
      await tx`SELECT id,source_warehouse_id FROM work_orders WHERE tenant_id=${a.tenantId} AND order_id=${o.id} AND (${!d.workOrderId} OR id=${d.workOrderId || null}) AND (${a.role !== "worker"} OR assigned_to=${a.userId}) AND status<>'cancelled' ORDER BY created_at LIMIT 1`;
    if (a.role === "worker" && !job) fail("İş bu kullanıcıya atanmadı", 403);
    await checkPhotos(tx, a, d.photos, job?.id);
    const [r] =
      await tx`INSERT INTO material_requests(tenant_id,request_number,status,order_id,work_order_id,description,required_by,photos,created_by,command_id,request_hash) VALUES(${a.tenantId},${"TAL-" + crypto.randomUUID().slice(0, 10).toUpperCase()},'submitted',${o.id},${job?.id || null},${d.description},${d.requiredBy || null},${JSON.stringify(d.photos)}::text::jsonb,${a.userId},${d.commandId},${hash(d)}) RETURNING id`;
    if (d.itemId) {
      const [i] =
        await tx`SELECT id,stock_uom FROM inventory_items WHERE tenant_id=${a.tenantId} AND id=${d.itemId} AND active=true`;
      if (!i || !d.quantity) fail("Malzeme ve miktar doğrulanmalı", 400);
      if (
        [
          "adet",
          "pcs",
          "piece",
          "pieces",
          "unit",
          "takim",
          "takım",
          "set",
        ].includes(i.stock_uom) &&
        !Number.isInteger(d.quantity)
      )
        fail("Adet ve takım miktarı tam sayı olmalı", 400);
      const wh = d.warehouseId || job?.source_warehouse_id;
      if (
        !wh ||
        !(
          await tx`SELECT id FROM warehouses WHERE tenant_id=${a.tenantId} AND id=${wh} AND active`
        ).length
      )
        fail("İlgili depo seçilmeli", 400);
      await tx`INSERT INTO material_request_lines(tenant_id,material_request_id,item_id,warehouse_id,quantity,uom) VALUES(${a.tenantId},${r.id},${i.id},${wh},${d.quantity},${i.stock_uom})`;
    }
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "order",
      entityId: o.id,
      action: "material_requested",
      metadata: { requestId: r.id },
    });
    return r;
  });
}
export async function approveWorkshopRequest(
  a: WorkOrderActor,
  id: string,
  version: number,
) {
  await need(a, "purchasing", "approve");
  z.uuid().parse(id);
  const rows =
    await sql`UPDATE material_requests SET status='approved',approved_by=${a.userId},approved_at=now(),version=version+1 WHERE tenant_id=${a.tenantId} AND id=${id} AND version=${version} AND status='submitted' RETURNING id`;
  if (!rows.length) fail("Talep değişti; güncel kaydı açın");
  return rows[0];
}
const Inspection = z
  .object({
    checked: z.literal(true),
    commandId: z.uuid(),
    documentId: z.uuid().optional(),
    documentMatches: z
      .array(
        z.object({
          rowIndex: z.number().int().nonnegative(),
          lineId: z.uuid(),
        }),
      )
      .max(500)
      .optional(),

    receipt: ReceiptInputSchema,
    photos,
  })
  .strict();
export async function checkReceipt(a: WorkOrderActor, raw: unknown) {
  await need(a, "inventory", "view");
  if (!["owner", "admin", "office", "worker"].includes(a.role))
    fail("Mal kontrol yetkiniz yok", 403);
  const d = Inspection.parse(raw);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [prior] =
      await tx`SELECT id,checked_by,request_hash FROM receiving_inspections WHERE tenant_id=${a.tenantId} AND command_id=${d.commandId}`;
    if (prior) {
      if (prior.checked_by !== a.userId || prior.request_hash !== hash(d))
        fail("İşlem anahtarı farklı kontrolde kullanılmış");
      return { id: prior.id, replayed: true };
    }
    const [po] =
      await tx`SELECT id,version,status FROM purchase_orders WHERE tenant_id=${a.tenantId} AND id=${d.receipt.purchaseOrderId} FOR UPDATE`;
    if (
      !po ||
      !["submitted", "partially_received"].includes(po.status) ||
      po.version !== d.receipt.version
    )
      fail("Satın alma siparişi değişti; kalan miktarları yenileyin");
    const [document] = d.documentId
      ? await tx`SELECT d.id,d.extracted FROM receiving_documents d JOIN production_files f ON f.id=d.file_id AND f.tenant_id=d.tenant_id WHERE d.tenant_id=${a.tenantId} AND d.id=${d.documentId} AND f.purchase_order_id=${po.id}`
      : [];
    if (d.documentId && !document) fail("Belge bulunamadı", 404);
    if (d.documentMatches?.length) {
      if (
        !document ||
        new Set(d.documentMatches.map((m) => m.rowIndex)).size !==
          d.documentMatches.length
      )
        fail("Belge eşleştirmeleri doğrulanmalı");
      for (const match of d.documentMatches) {
        if (
          match.rowIndex >= document.extracted.length ||
          !(
            await tx`SELECT id FROM purchase_order_lines WHERE tenant_id=${a.tenantId} AND purchase_order_id=${po.id} AND id=${match.lineId}`
          ).length
        )
          fail("Belge satırı bu satın alma kalemine ait değil");
      }
    }
    if (
      new Set(d.receipt.lines.map((l) => l.lineId)).size !==
      d.receipt.lines.length
    )
      fail("Aynı kalem iki kez kontrol edilemez", 400);
    for (const row of d.receipt.lines) {
      const [l] =
        await tx`SELECT * FROM purchase_order_lines WHERE tenant_id=${a.tenantId} AND purchase_order_id=${po.id} AND id=${row.lineId}`;
      if (
        !l ||
        row.acceptedQty + row.rejectedQty >
          Number(l.ordered_qty) - Number(l.received_qty) + 0.000001
      )
        fail("Gelen miktar kalan siparişle uyuşmuyor");
      if (l.uom === "m" && !row.bars?.length)
        fail("Profil için gerçekte gelen boy ve profil adetleri gerekli", 400);
    }
    await checkPhotos(tx, a, d.photos, undefined, po.id);
    const [r] =
      await tx`INSERT INTO receiving_inspections(tenant_id,purchase_order_id,document_id,checklist,photos,notes,checked_by,command_id,request_hash) VALUES(${a.tenantId},${po.id},${d.documentId || null},${JSON.stringify({ ...d.receipt, documentMatches: d.documentMatches || [] })}::text::jsonb,${JSON.stringify(d.photos)}::text::jsonb,${d.receipt.notes},${a.userId},${d.commandId},${hash(d)}) RETURNING id`;
    return r;
  });
}
export async function approveReceiptInspection(
  a: WorkOrderActor,
  id: string,
  version: number,
) {
  await need(a, "purchasing", "approve");
  z.uuid().parse(id);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [r] =
      await tx`SELECT * FROM receiving_inspections WHERE tenant_id=${a.tenantId} AND id=${id} FOR UPDATE`;
    if (!r) fail("Mal kontrolü bulunamadı", 404);
    if (r.status === "accepted")
      return { receiptId: r.receipt_id, replayed: true };
    if (r.version !== version || r.status !== "checked")
      fail("Kontrol kaydı değişti");
    const receipt = await executeProcurement(
      tx,
      a,
      "procurement.receipt.create",
      r.checklist,
      "inspection:" + r.id,
    );
    await tx`UPDATE goods_receipts SET inspection_id=${r.id} WHERE tenant_id=${a.tenantId} AND id=${receipt.id}`;
    await tx`UPDATE receiving_inspections SET status='accepted',approved_by=${a.userId},approved_at=now(),receipt_id=${receipt.id},version=version+1 WHERE tenant_id=${a.tenantId} AND id=${r.id}`;
    await tx`UPDATE material_requests r SET status='closed',version=version+1 WHERE r.tenant_id=${a.tenantId} AND r.status IN('approved','ordered') AND EXISTS(SELECT 1 FROM material_request_lines l WHERE l.tenant_id=r.tenant_id AND l.material_request_id=r.id) AND NOT EXISTS(SELECT 1 FROM material_request_lines l WHERE l.tenant_id=r.tenant_id AND l.material_request_id=r.id AND l.quantity>COALESCE((SELECT SUM(p.received_qty) FROM purchase_order_lines p WHERE p.tenant_id=l.tenant_id AND p.material_request_line_id=l.id),0))`;
    return { receiptId: receipt.id };
  });
}
export async function readReceivingDocument(a: WorkOrderActor, raw: unknown) {
  await need(a, "inventory", "view");
  if (!["owner", "admin", "office", "worker"].includes(a.role))
    fail("Belge okuma yetkiniz yok", 403);
  const input = ProductionFileSchema.parse(raw),
    bytes = await readProductionInput(a, input),
    digest = createHash("sha256").update(bytes).digest("hex");
  if (!input.purchaseOrderId)
    fail("Belge için teslim alınacak satın alma siparişini seçin", 400);
  const expected =
    await sql`SELECT l.id,i.name,i.profile_code AS "profileCode",l.metadata->>'color' AS color,(l.metadata->>'lengthMm')::numeric AS "lengthMm" FROM purchase_order_lines l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id JOIN purchase_orders p ON p.id=l.purchase_order_id AND p.tenant_id=l.tenant_id WHERE l.tenant_id=${a.tenantId} AND p.id=${input.purchaseOrderId} AND p.status IN('submitted','partially_received')`;
  if (!expected.length) fail("Teslim alınabilir satın alma bulunamadı", 404);
  const [old] =
    await sql`SELECT d.id,d.extracted,f.purchase_order_id FROM receiving_documents d JOIN production_files f ON f.id=d.file_id AND f.tenant_id=d.tenant_id WHERE d.tenant_id=${a.tenantId} AND d.sha256=${digest}`;
  if (old && old.purchase_order_id !== input.purchaseOrderId)
    fail(
      "Bu belge başka satın alma siparişine bağlı; aynı belgeyi farklı teslimat için kullanmadan önce satın alma kaydını kontrol edin",
    );
  if (old)
    return {
      ...old,
      matches: receivingMatches(old.extracted, expected as any),
      extracted:
        a.role === "worker"
          ? old.extracted.map((l: any) => ({
              page: l.page,
              profileCode: l.profileCode || null,
              quantity: l.quantity,
              unit: l.unit,
              color: l.color || null,
              lengthMm: l.lengthMm || null,
            }))
          : old.extracted,
    };
  const file = await storeProductionFile(a, input, bytes),
    extracted: Array<{
      text: string;
      page: number;
      quantity: number | null;
      unit: string | null;
    }> = [];
  if (input.mime === "application/pdf") {
    const text = await pdfTextItems(new Uint8Array(bytes));
    const lines = new Map<string, { text: string; page: number }>();
    for (const item of text) {
      const key = item.page + ":" + Math.round(item.y / 4);
      const old = lines.get(key);
      lines.set(key, {
        page: item.page,
        text: [old?.text, item.text].filter(Boolean).join(" "),
      });
    }
    for (const line of lines.values()) {
      const m = line.text.match(
        /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(adet|boy|m|metre|kg)\b/i,
      );
      extracted.push({
        ...line,
        quantity: m ? Number(m[1].replace(",", ".")) : null,
        unit: m ? m[2].toLocaleLowerCase("tr-TR") : null,
      });
    }
  }
  const settings = await getAiSettings(a.tenantId);
  let modelLines: any[] = [];
  if (settings.mode === "assist" && settings.kvkkAckAt) {
    try {
      modelLines = (
        await getAIService().analyzeReceivingDocument(
          bytes.toString("base64"),
          input.mime,
          {
            tenantId: a.tenantId,
            userId: a.userId,
            feature: "receiving.document",
          },
        )
      ).lines;
    } catch {
      /* Manual check stays available when the model cannot read the document. */
    }
  }
  const storedLines = modelLines.length ? modelLines : extracted;
  const [r] =
    await sql`INSERT INTO receiving_documents(tenant_id,file_id,sha256,extracted,created_by) VALUES(${a.tenantId},${file.id},${digest},${JSON.stringify(storedLines)}::text::jsonb,${a.userId}) ON CONFLICT(tenant_id,sha256) DO UPDATE SET sha256=EXCLUDED.sha256 RETURNING id,extracted`;
  return {
    ...r,
    matches: receivingMatches(r.extracted, expected as any),
    extracted:
      a.role === "worker"
        ? r.extracted.map((l: any) => ({
            page: l.page,
            profileCode: l.profileCode || null,
            quantity: l.quantity,
            unit: l.unit,
            color: l.color || null,
            lengthMm: l.lengthMm || null,
          }))
        : r.extracted,
    needsReview: true,
    message: storedLines.length
      ? "Okunan satırları satın alma kalemleriyle eşleştirin; bu işlem stok artırmaz."
      : "Metin okunamadı. Belgeyi fiziksel teslimatla karşılaştırarak kalemleri girin; stok değişmedi.",
  };
}

export async function purchaseWorkshopNeed(a: WorkOrderActor, raw: unknown) {
  await need(a, "purchasing", "create");
  const d = z
    .object({ commandId: z.uuid(), purchase: PurchaseInputSchema })
    .strict()
    .parse(raw);
  if (d.purchase.lines.some((l) => !l.requestLineId))
    fail("Satın alma onaylı ihtiyaç kaleminden hazırlanmalı", 400);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [prior] =
      await tx`SELECT actor_id,request_hash,result FROM production_commands WHERE tenant_id=${a.tenantId} AND command_id=${d.commandId}`;
    if (prior) {
      if (prior.actor_id !== a.userId || prior.request_hash !== hash(d))
        fail("İşlem anahtarı başka satın almada kullanılmış");
      return prior.result;
    }
    const order = await executeProcurement(
      tx,
      a,
      "procurement.purchase.create",
      d.purchase,
      d.commandId,
    );
    await tx`INSERT INTO production_commands(tenant_id,command_id,actor_id,request_hash,result) VALUES(${a.tenantId},${d.commandId},${a.userId},${hash(d)},${JSON.stringify(order)}::text::jsonb)`;
    return order;
  });
}
