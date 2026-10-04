import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { readFile, validateStorageKey } from "@/lib/storage";
import { requireWorkOrderActor, WorkOrderApiError } from "@/lib/features/work-orders/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
 try {
  const actor = await requireWorkOrderActor();
  const key = validateStorageKey(request.nextUrl.searchParams.get("key") || "");
  const office = ["owner", "admin", "office", "accountant"].includes(actor.role);
  let allowed = false;
  if (office) {
    const [row] = await sql`SELECT EXISTS(SELECT 1 FROM documents d JOIN orders o ON o.id=d.order_id WHERE d.tenant_id=${actor.tenantId} AND o.tenant_id=${actor.tenantId} AND d.file_path=${key}) OR EXISTS(SELECT 1 FROM order_documents d JOIN orders o ON o.id=d.order_id WHERE d.tenant_id=${actor.tenantId} AND o.tenant_id=${actor.tenantId} AND d.file_url=${key}) AS allowed`;
    allowed = row.allowed;
  }
  if (!allowed) {
    const [row] = await sql`SELECT id FROM production_files f WHERE tenant_id=${actor.tenantId} AND file_path=${key} AND (${office} OR (${actor.role === "worker"} AND work_order_id IN(SELECT id FROM work_orders w WHERE tenant_id=${actor.tenantId} AND (assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.work_order_id=w.id AND p.tenant_id=${actor.tenantId} AND p.assigned_to=${actor.userId}))))))`;
    allowed = Boolean(row);
  }
  if (!allowed) return new Response("Not found", {status:404});
  const file = await readFile(key);
  return new Response(file.body, {headers: {"Content-Type":file.contentType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox","Content-Disposition":"inline"}});
 } catch(error) {
  return new Response("Dosya alınamadı", {status: error instanceof WorkOrderApiError ? error.status : 400});
 }
}
