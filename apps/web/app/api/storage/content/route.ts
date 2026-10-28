import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { readFile, validateStorageKey } from "@/lib/storage";
import { requireWorkOrderActor, WorkOrderApiError } from "@/lib/features/work-orders/security";
import { tableExists } from "@/lib/db/schema-guard";
import { DEFAULT_PRESET } from "@/lib/security/access-matrix";
import { hiddenFieldsOf, resolveMemberAccess } from "@/lib/security/member-access.server";
import { storageContentAllowed, type ContentActor, type FileOwner } from "@/lib/features/storage/content-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The records of this firm that point at the key: they decide who may open it (content-access.ts). */
async function owners(actor: ContentActor, key: string): Promise<FileOwner[]> {
  const found: FileOwner[] = [];
  const [doc] = await sql`SELECT EXISTS(SELECT 1 FROM documents d JOIN orders o ON o.id=d.order_id WHERE d.tenant_id=${actor.tenantId} AND o.tenant_id=${actor.tenantId} AND d.file_path=${key}) AS found`;
  if (doc?.found) found.push({ kind: "order_document" });
  if (await tableExists("order_documents")) {
    const [fin] = await sql`SELECT EXISTS(SELECT 1 FROM order_documents d JOIN orders o ON o.id=d.order_id WHERE d.tenant_id=${actor.tenantId} AND o.tenant_id=${actor.tenantId} AND d.file_url=${key}) AS found`;
    if (fin?.found) found.push({ kind: "finance_document" });
  }
  const files = await sql`SELECT f.id, (f.work_order_id IN(SELECT id FROM work_orders w WHERE tenant_id=${actor.tenantId} AND (assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.work_order_id=w.id AND p.tenant_id=${actor.tenantId} AND p.assigned_to=${actor.userId})))) AS assigned
    FROM production_files f WHERE f.tenant_id=${actor.tenantId} AND f.file_path=${key}`;
  for (const f of files as Array<{ assigned: boolean | null }>) found.push({ kind: "production_file", assignedToActor: Boolean(f.assigned) });
  return found;
}

export async function GET(request: NextRequest) {
 try {
  const actor = await requireWorkOrderActor();
  const key = validateStorageKey(request.nextUrl.searchParams.get("key") || "");
  const access = actor.access ?? (await resolveMemberAccess(actor.userId, actor.tenantId));
  if (!access) throw new WorkOrderApiError("Unauthorized", 401);
  const narrowed = access.roleKey !== DEFAULT_PRESET[access.base];
  const content: ContentActor = {
    userId: actor.userId, tenantId: actor.tenantId, role: access.base,
    narrowed: narrowed ? { permissions: access.permissions, hidden: access.hidden } : null,
    hidden: hiddenFieldsOf(access),
  };
  // Refused and unknown files read the same, so a key's existence is not disclosed.
  if (!storageContentAllowed(content, key, await owners(content, key))) return new Response("Not found", {status:404});
  const file = await readFile(key);
  return new Response(file.body, {headers: {"Content-Type":file.contentType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox","Content-Disposition":"inline"}});
 } catch(error) {
  return new Response("Dosya alınamadı", {status: error instanceof WorkOrderApiError ? error.status : 400});
 }
}
