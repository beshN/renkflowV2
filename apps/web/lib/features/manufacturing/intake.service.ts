import { requireVisualizationStorage, storeVisualization } from '@/lib/features/product-3d/storage';
import { applyAwning } from "../awning/configuration";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { intakeReviewFields } from "@/lib/ai/extraction";
import { getAIService } from "@/lib/ai/service";
import { NewOrderItemSchema } from "@/lib/shared/types";
import { WorkOrderActor, WorkOrderApiError } from "../work-orders/security";
import { ProductionFileSchema, storeProductionFile, readProductionInput } from "./files.service";
const office = (a: WorkOrderActor) => {
  if (!["owner", "admin", "office"].includes(a.role))
    throw new WorkOrderApiError("Sipariş taslağı yetkisi gerekli", 403);
};
export async function extractIntake(actor: WorkOrderActor, raw: unknown) {
  office(actor);
  const input = ProductionFileSchema.parse(raw),
    bytes = await readProductionInput(actor, input),
    sourceId = createHash("sha256")
      .update(bytes)
      .digest("hex");
  const [old] =
    await sql`SELECT * FROM intake_drafts WHERE tenant_id=${actor.tenantId} AND source='upload' AND source_id=${sourceId}`;
  if (old) return old;
  const file = await storeProductionFile(actor, input, bytes);
  let analysis;
  try {
    analysis = await getAIService().analyzeDocument(bytes.toString("base64"), input.mime, undefined, { tenantId: actor.tenantId, userId: actor.userId, feature: 'intake.document' });
  } catch {
    // The document stays reviewable even when extraction is unavailable. No invented manufacturing values.
    analysis = {extractedData: {customerName:null,email:null,phone:null,deliveryDate:null,notes:null,items:[],fieldEvidence:[],warnings:["AI belgeyi okuyamadı. Belgeyi inceleyerek kalemleri elle ekleyebilirsiniz."]}};
  }
  const [draft] =
    await sql`INSERT INTO intake_drafts(tenant_id,source,source_id,extracted_data,documents,warnings,created_by)VALUES(${actor.tenantId},'upload',${sourceId},${JSON.stringify(analysis.extractedData)}::text::jsonb,${JSON.stringify([file])}::text::jsonb,${JSON.stringify(analysis.extractedData.warnings)}::text::jsonb,${actor.userId})ON CONFLICT(tenant_id,source,source_id)DO UPDATE SET source_id=EXCLUDED.source_id RETURNING *`;
  return draft;
}
export const IntakeApprovalSchema = z.object({
  version: z.number().int().positive().default(1),
  reviewedFields: z.array(z.string().max(180)).max(8000).default([]),
  customerName: z.string().trim().min(2).max(180),
  email: z.union([z.email(), z.literal("")]).default(""),
  phone: z.string().max(60).default(""),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(4000).default(""),
  currency: z.enum(["TRY", "USD", "EUR", "GBP"]).default("TRY"),
  items: z.array(NewOrderItemSchema).min(1).max(100),
});
export async function approveIntake(
  a: WorkOrderActor,
  id: string,
  raw: unknown,
) {
  office(a);
  z.string().uuid().parse(id);
  const data = IntakeApprovalSchema.parse(raw);
  await requireVisualizationStorage("order_items",data.items);
  data.items = data.items.map((i) => {
    const item = i.awningConfiguration
      ? applyAwning(i, i.awningConfiguration)
      : i;
    return {
      ...item,
      totalPrice:
        Math.round(
          item.quantity *
            (item.unitPrice ?? item.totalPrice / item.quantity) *
            100,
        ) / 100,
    };
  });
  const legacyHash=createHash("sha256").update(JSON.stringify(data)).digest("hex");
  data.reviewedFields=[...new Set(data.reviewedFields)].sort();
  const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v && typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
  const approvalHash = 'sha256:'+createHash("sha256").update(JSON.stringify(stable(data))).digest("hex");
  return sql.begin(async (tx: any) => {
    const [draft] =
      await tx`SELECT * FROM intake_drafts WHERE tenant_id=${a.tenantId} AND id=${id} FOR UPDATE`;
    if (!draft) throw new WorkOrderApiError("Taslak bulunamadı", 404);
    if (draft.status === "approved") {
      if (draft.approval_hash && draft.approval_hash !== (draft.approval_hash.startsWith("sha256:")?approvalHash:legacyHash)) throw new WorkOrderApiError("Bu taslak farklı bilgilerle zaten onaylandı", 409);
      return { orderId: draft.order_id };
    }
    if (draft.review_version !== data.version) throw new WorkOrderApiError("Taslak değişti; tekrar açıp kontrol edin", 409);
    const missing = intakeReviewFields(draft.extracted_data).filter(f => !data.reviewedFields.includes(f));
    if (missing.length) throw new WorkOrderApiError("Belirsiz alanların kontrolünü işaretleyin: " + missing.join(", "), 400);
    if (draft.status !== "needs_review")
      throw new WorkOrderApiError("Taslak onaylanamaz", 409);
    const total = data.items.reduce((s, i) => s + i.totalPrice, 0),
      number =
        "RF-" +
        Date.now().toString(36).toUpperCase() +
        "-" +
        randomUUID().slice(0, 4).toUpperCase();
    const [order] =
      await tx`INSERT INTO orders(tenant_id,order_number,customer_name,email,phone,product_name,quantity,total_amount,currency,notes,delivery_date,status)VALUES(${a.tenantId},${number},${data.customerName},${data.email},${data.phone},${data.items[0].productName},${data.items.reduce((s, i) => s + i.quantity, 0)},${total},${data.currency},${data.notes},${data.deliveryDate || null},'pending')RETURNING id`;
    for (const i of data.items) {
      const [visualLine] = await tx`INSERT INTO order_items(order_id,product_name,quantity,unit_price,total_price,color,width_mm,height_mm,projection_mm,mounting_height_mm,motor_type,led_type,fabric_type,awning_configuration,awning_preview,notes,custom_parameters,quantity_unit)VALUES(${order.id},${i.productName},${i.quantity},${i.unitPrice ?? i.totalPrice / i.quantity},${i.totalPrice},${i.color || null},${i.widthMm || null},${i.heightMm || null},${i.projectionMm || null},${i.mountingHeightMm || null},${i.motorType || null},${i.ledType || null},${i.fabricType || null},${i.awningConfiguration ? JSON.stringify(i.awningConfiguration) : null}::text::jsonb,${i.awningPreview || null},${i.notes || null},${JSON.stringify(i.customParameters || {})}::text::jsonb,${i.quantityUnit || "adet"}) RETURNING id`;
      await storeVisualization(tx,"order_items",a.tenantId,visualLine.id,i.productVisualization);
    }
    for (const file of draft.documents) {
      const [stored] =
        await tx`SELECT name,mime,COALESCE(size_bytes,octet_length(body)) AS size FROM production_files WHERE tenant_id=${a.tenantId} AND id=${file.id}`;
      if (!stored) throw new WorkOrderApiError("Kaynak belge bulunamadı", 409);
      await tx`INSERT INTO documents(tenant_id,order_id,name,file_path,file_type,size,uploaded_by)VALUES(${a.tenantId},${order.id},${stored.name},${file.url},${stored.mime},${stored.size},${a.userId})`;
    }
    await tx`UPDATE intake_drafts SET status='approved',order_id=${order.id},reviewed_by=${a.userId},reviewed_at=now(),reviewed_data=${JSON.stringify(data)}::text::jsonb,reviewed_fields=${JSON.stringify(data.reviewedFields)}::text::jsonb,approval_hash=${approvalHash},review_version=review_version+1 WHERE id=${id} AND tenant_id=${a.tenantId}`;
    await tx`INSERT INTO production_events(tenant_id,event_type,payload,actor_id)VALUES(${a.tenantId},'intake.approved',${JSON.stringify({ draftId: id, orderId: order.id })}::text::jsonb,${a.userId})`;
    return { orderId: order.id };
  });
}

export async function getIntake(actor: WorkOrderActor, id: string) {
  office(actor);
  z.string().uuid().parse(id);
  const [draft] = await sql`SELECT * FROM intake_drafts WHERE tenant_id=${actor.tenantId} AND id=${id}`;
  if (!draft) throw new WorkOrderApiError("Taslak bulunamadı", 404);
  return draft;
}
