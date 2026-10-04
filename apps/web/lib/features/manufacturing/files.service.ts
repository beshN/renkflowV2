import "server-only";
import { sql } from "@/lib/db";
import { WorkOrderActor, WorkOrderApiError } from "../work-orders/security";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile, uploadFile, deleteFile, validateStorageKey } from "@/lib/storage";
export const ProductionFileSchema = z.object({
  name: z.string().min(1).max(180),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1).max(14_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/).optional(),
  blobPath: z.string().max(700).optional(),
  workOrderId: z.string().uuid().optional(),
}).refine(d => Boolean(d.base64) !== Boolean(d.blobPath), "Bir dosya kaynağı gerekli");
export type ProductionFileInput = z.infer<typeof ProductionFileSchema>;
export async function readProductionInput(actor: WorkOrderActor, input: ProductionFileInput): Promise<Buffer> {
  if (input.base64) return Buffer.from(input.base64, "base64");
  const key = validateStorageKey(input.blobPath!);
  if (!key.startsWith(`uploads/${actor.tenantId}/${actor.userId}/`))
    throw new WorkOrderApiError("Bu yüklemeyi kullanamazsınız", 403);
  const file = await readFile(key);
  if(file.uploadedAt && file.uploadedAt.getTime()<Date.now()-24*60*60*1000){await file.body.cancel();throw new WorkOrderApiError("Yüklemenin süresi dolmuş, dosyayı yeniden yükleyin",409);}
  if (file.size > 10 * 1024 * 1024) {
    await file.body.cancel();
    throw new WorkOrderApiError("Dosya en fazla 10 MB olabilir", 413);
  }
  const reader = file.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 10 * 1024 * 1024) { await reader.cancel(); throw new WorkOrderApiError("Dosya en fazla 10 MB olabilir", 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function storeProductionFile(actor: WorkOrderActor, raw: unknown, bytes?: Buffer) {
  const d = ProductionFileSchema.parse(raw);
  if (actor.role === "worker") {
    if (
      !d.workOrderId ||
      !(
        await sql`SELECT id FROM work_orders WHERE tenant_id=${actor.tenantId} AND id=${d.workOrderId} AND (assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.work_order_id=work_orders.id AND p.tenant_id=${actor.tenantId} AND p.assigned_to=${actor.userId}))`
      ).length
    )
      throw new WorkOrderApiError("Bu işe fotoğraf ekleyemezsiniz", 403);
    if (d.mime === "application/pdf")
      throw new WorkOrderApiError("Yalnız iş fotoğrafı yükleyebilirsiniz", 403);
  } else if (!["owner", "admin", "office"].includes(actor.role))
    throw new WorkOrderApiError("Dosya yükleme yetkiniz yok", 403);
  if (d.workOrderId && !(await sql`SELECT id FROM work_orders WHERE tenant_id=${actor.tenantId} AND id=${d.workOrderId}`).length)
    throw new WorkOrderApiError("İş emri bulunamadı", 404);
  const buffer = bytes || await readProductionInput(actor, d);
  if (buffer.length > 10 * 1024 * 1024)
    throw new WorkOrderApiError("Dosya en fazla 10 MB olabilir", 413);
  const magic =
    d.mime === "application/pdf"
      ? buffer.subarray(0, 4).toString() === "%PDF"
      : d.mime === "image/jpeg"
        ? buffer[0] === 255 && buffer[1] === 216
        : d.mime === "image/png"
          ? buffer.subarray(1, 4).toString() === "PNG"
          : buffer.subarray(0, 4).toString() === "RIFF" &&
            buffer.subarray(8, 12).toString() === "WEBP";
  if (!magic)
    throw new WorkOrderApiError("Dosya içeriği seçilen biçime uymuyor", 400);
  // Files received by webhooks are also stored in Blob. Existing bytea rows remain readable.
  const key = d.blobPath || `production/${actor.tenantId}/${randomUUID()}`;
  if (d.blobPath && !validateStorageKey(key).startsWith(`uploads/${actor.tenantId}/${actor.userId}/`))
    throw new WorkOrderApiError("Bu yüklemeyi kullanamazsınız", 403);
  if (d.blobPath) {
    const [old] = await sql`SELECT id,name,mime,work_order_id,created_by FROM production_files WHERE tenant_id=${actor.tenantId} AND file_path=${key}`;
    if (old) {
      if (old.created_by!==actor.userId || old.work_order_id!==(d.workOrderId || null) || old.mime!==d.mime || old.name!==d.name) throw new WorkOrderApiError("Bu yükleme başka bir kayda bağlı",409);
      return {id:old.id,name:old.name,mime:old.mime,url:`/api/v1/production/files/${actor.tenantId}/${old.id}`};
    }
  }
  if (!d.blobPath) await uploadFile(key, buffer, d.mime);
  let f;
  try {
    [f] = await sql`INSERT INTO production_files(tenant_id,work_order_id,created_by,name,mime,file_path,size_bytes)VALUES(${actor.tenantId},${d.workOrderId || null},${actor.userId},${d.name},${d.mime},${key},${buffer.length})RETURNING id`;
  } catch (error) {
    if (!d.blobPath) await deleteFile(key).catch(() => {});
    throw error;
  }
  return {
    id: f.id,
    name: d.name,
    mime: d.mime,
    url: `/api/v1/production/files/${actor.tenantId}/${f.id}`,
  };
}
