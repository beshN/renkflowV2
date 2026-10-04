import "server-only";
import { createHash } from "node:crypto";
import { sql, withTransaction } from "@/lib/db";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { hasPermission } from "../auth/permissions";
import { ViewCommandSchema, type SavedOrderView } from "./saved-views";
function allowed(a: WorkOrderActor) {
  if (!hasPermission(a.role, "orders.view"))
    throw new WorkOrderApiError("Sipariş erişim yetkiniz yok", 403);
}
export async function listSavedViews(
  a: WorkOrderActor,
): Promise<SavedOrderView[]> {
  allowed(a);
  return await sql`SELECT id,name,filters,pinned,version FROM workspace_views WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND resource='orders' ORDER BY pinned DESC,lower(name),id`;
}
export async function savedViewCommand(a: WorkOrderActor, raw: unknown) {
  allowed(a);
  const d = ViewCommandSchema.parse(raw),
    hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${"views:" + a.tenantId + ":" + a.userId},0))`;
    const [prior] =
      await tx`SELECT request_hash,result FROM workspace_view_commands WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND command_id=${d.commandId}`;
    if (prior) {
      if (prior.request_hash !== hash)
        throw new WorkOrderApiError(
          "Bu işlem kimliği farklı bir istek için kullanılmış",
          409,
        );
      return prior.result;
    }
    if (d.action !== "create") {
      const [current] =
        await tx`SELECT version FROM workspace_views WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND id=${d.id} AND resource='orders' FOR UPDATE`;
      if (!current) throw new WorkOrderApiError("Görünüm bulunamadı", 404);
      if (current.version !== d.version)
        throw new WorkOrderApiError(
          "Görünüm başka bir cihazda değişti. Listeyi yenileyip tekrar deneyin.",
          409,
        );
    }
    if (d.action === "create") {
      const [count] =
        await tx`SELECT COUNT(*) AS n FROM workspace_views WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND resource='orders'`;
      if (Number(count.n) >= 50)
        throw new WorkOrderApiError(
          "En fazla 50 kişisel görünüm saklanabilir",
          409,
        );
    }
    if (d.action !== "delete") {
      const [duplicate] =
        await tx`SELECT id FROM workspace_views WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND resource='orders' AND lower(name)=lower(${d.name}) AND id<>${d.action === "update" ? d.id : "00000000-0000-0000-0000-000000000000"}`;
      if (duplicate)
        throw new WorkOrderApiError(
          "Bu isimde bir görünümünüz var. Başka bir isim seçin.",
          409,
        );
    }
    let result;
    if (d.action === "create")
      result = (
        await tx`INSERT INTO workspace_views(tenant_id,user_id,resource,name,filters,pinned) VALUES(${a.tenantId},${a.userId},'orders',${d.name},${JSON.stringify(d.filters)}::text::jsonb,${d.pinned}) RETURNING id,name,filters,pinned,version`
      )[0];
    else if (d.action === "update")
      result = (
        await tx`UPDATE workspace_views SET name=${d.name},filters=${JSON.stringify(d.filters)}::text::jsonb,pinned=${d.pinned},version=version+1,updated_at=now() WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND id=${d.id} RETURNING id,name,filters,pinned,version`
      )[0];
    else {
      await tx`DELETE FROM workspace_views WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND id=${d.id}`;
      result = { id: d.id, deleted: true };
    }
    await tx`INSERT INTO workspace_view_commands(tenant_id,user_id,command_id,request_hash,result)VALUES(${a.tenantId},${a.userId},${d.commandId},${hash},${JSON.stringify(result)}::text::jsonb)`;
    return result;
  });
}
