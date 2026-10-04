import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { ORDER_ALLOWED_FILE_TYPES } from "@/lib/features/orders/constants";
import { hasPermission } from "@/lib/features/auth/permissions";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { requireWorkOrderActor, WorkOrderApiError } from "@/lib/features/work-orders/security";
import { validateStorageKey } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET() {
 try {
  const actor = await requireWorkOrderActor();
  return NextResponse.json({directUpload: Boolean(process.env.BLOB_READ_WRITE_TOKEN), scope: `${actor.tenantId}/${actor.userId}`}, {headers:{"Cache-Control":"no-store"}});
 } catch(error) { return NextResponse.json({error:"Oturum gerekli"},{status:error instanceof WorkOrderApiError ? error.status : 401}); }
}
export async function POST(request: NextRequest) {
 try {
  const body = await request.json() as HandleUploadBody;
  const result = await handleUpload({body, request,
   onBeforeGenerateToken: async (pathname, payload) => {
    requireSameOriginJson(request, 32000);
    const actor = await requireWorkOrderActor();
    const input = z.object({workOrderId:z.string().uuid().optional(),mime:z.enum(ORDER_ALLOWED_FILE_TYPES),purpose:z.enum(["production","order","finance","qr"]).default("production"),qrToken:z.string().min(32).max(200).optional()}).parse(JSON.parse(payload || "{}"));
    const key = validateStorageKey(pathname);
    if (!key.startsWith(`uploads/${actor.tenantId}/${actor.userId}/`) || !/^[a-f0-9-]{36}$/.test(key.split('/').pop() || '')) throw new WorkOrderApiError("Geçersiz yükleme yolu",403);
    if (input.purpose === "qr") {
      if(!input.qrToken || !hasPermission(actor.role,"orders.qr.photo") || (!input.mime.startsWith("image/") && input.mime!=="application/pdf")) throw new WorkOrderApiError("QR yükleme yetkisi yok",403);
      const [qr] = await sql`SELECT q.order_id,q.allowed_actions FROM order_qr_tokens q JOIN orders o ON o.id=q.order_id AND o.tenant_id=q.tenant_id WHERE q.tenant_id=${actor.tenantId} AND q.token=${input.qrToken} AND q.active=true AND (q.expires_at IS NULL OR q.expires_at>now())`;
      if(!qr || !Array.isArray(qr.allowed_actions) || !qr.allowed_actions.includes("photo.upload")) throw new WorkOrderApiError("QR yükleme yetkisi yok",403);
      if(actor.role==="worker" && !(await sql`SELECT id FROM work_orders w WHERE tenant_id=${actor.tenantId} AND order_id=${qr.order_id} AND (assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.work_order_id=w.id AND p.tenant_id=${actor.tenantId} AND p.assigned_to=${actor.userId}))`).length) throw new WorkOrderApiError("Bu sipariş size atanmamış",403);
    } else if (actor.role === "worker") {
      if(input.purpose!=="production") throw new WorkOrderApiError("Ticari belge yükleyemezsiniz",403);
      if (!input.workOrderId || input.mime === "application/pdf" || !(await sql`SELECT id FROM work_orders w WHERE tenant_id=${actor.tenantId} AND id=${input.workOrderId} AND (assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.work_order_id=w.id AND p.tenant_id=${actor.tenantId} AND p.assigned_to=${actor.userId}))`).length) throw new WorkOrderApiError("Bu işe yükleme yapamazsınız",403);
    } else if (!(input.purpose === "finance" ? hasPermission(actor.role,"finance.documents.upload") : ["owner","admin","office"].includes(actor.role))) throw new WorkOrderApiError("Dosya yükleme yetkiniz yok",403);
    return {allowedContentTypes:[input.mime],maximumSizeInBytes:10*1024*1024,validUntil:Date.now()+10*60*1000,addRandomSuffix:false,allowOverwrite:false};
   }
  });
  return NextResponse.json(result);
 } catch(error) { return NextResponse.json({error:error instanceof WorkOrderApiError ? error.message : "Yükleme başlatılamadı"},{status:error instanceof WorkOrderApiError ? error.status : 400}); }
}
