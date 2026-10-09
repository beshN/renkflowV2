import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { sql, withTransaction } from "@/lib/db";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
  type WorkOrderActor,
} from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { hasPermission } from "@/lib/features/auth/permissions";
const entity = z.enum(["order", "customer"]);
const querySchema = z.object({
  entityType: entity,
  entityId: z.uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const noteSchema = z
  .object({
    entityType: entity,
    entityId: z.uuid(),
    action: z.literal("note_added"),
    note: z.string().trim().min(1).max(2000),
  })
  .strict();
async function entityAccess(
  db: any,
  a: WorkOrderActor,
  type: "order" | "customer",
  id: string,
  write = false,
) {
  if (
    a.role === "worker" ||
    !hasPermission(
      a.role,
      type === "order"
        ? write
          ? "orders.edit"
          : "orders.view"
        : write
          ? "customers.edit"
          : "customers.view",
    )
  )
    throw new WorkOrderApiError("Bu aktivite kaydına erişim yetkiniz yok", 403);
  const rows =
    type === "order"
      ? await db`SELECT id FROM orders WHERE tenant_id=${a.tenantId} AND id=${id} FOR SHARE`
      : await db`SELECT id FROM customers WHERE tenant_id=${a.tenantId} AND id=${id} FOR SHARE`;
  if (!rows.length) throw new WorkOrderApiError("Kayıt bulunamadı", 404);
}
function failure(e: unknown) {
  if (e instanceof WorkOrderApiError)
    return redactedJson({ error: e.message }, { status: e.status });
  if (e instanceof ZodError || e instanceof SyntaxError)
    return redactedJson(
      { error: "Aktivite bilgileri geçersiz" },
      { status: 400 },
    );
  console.error("[ActivityLogs]", e instanceof Error ? e.message : "failed");
  return redactedJson(
    { error: "Aktivite işlemi tamamlanamadı" },
    { status: 500 },
  );
}
export async function GET(req: NextRequest) {
  try {
    const a = await requireWorkOrderActor(),
      p = querySchema.parse({
        entityType: req.nextUrl.searchParams.get("entityType"),
        entityId: req.nextUrl.searchParams.get("entityId"),
        limit: req.nextUrl.searchParams.get("limit") || undefined,
      });
    await entityAccess(sql, a, p.entityType, p.entityId);
    const rows =
      await sql`SELECT al.*,u.name AS actor_display_name FROM activity_logs al LEFT JOIN users u ON u.id=al.actor_id
 WHERE al.tenant_id=${a.tenantId} AND al.entity_type=${p.entityType} AND al.entity_id=${p.entityId} ORDER BY al.created_at DESC,al.id DESC LIMIT ${p.limit}`;
    const logs = [...rows]
      .reverse()
      .map((row: any) => ({
        id: row.id,
        action: row.action,
        actorName: row.actor_display_name || row.actor_name || "Sistem",
        actorId: row.actor_id,
        note: row.note,
        changes: row.changes,
        metadata: row.metadata,
        createdAt: row.created_at,
      }));
    return redactedJson(
      { logs, total: logs.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 16000);
    const a = await requireWorkOrderActor(),
      body = await req.text();
    if (Buffer.byteLength(body) > 16000)
      throw new WorkOrderApiError("İstek çok büyük", 413);
    const p = noteSchema.parse(JSON.parse(body));
    const log = await withTransaction(async (tx) => {
      await entityAccess(tx, a, p.entityType, p.entityId, true);
      const [user] = await tx`SELECT name FROM users WHERE id=${a.userId}`;
      return (
        await tx`INSERT INTO activity_logs(tenant_id,entity_type,entity_id,action,actor_id,actor_name,note)VALUES(${a.tenantId},${p.entityType},${p.entityId},'note_added',${a.userId},${user?.name || "Kullanıcı"},${p.note})RETURNING *`
      )[0];
    });
    return redactedJson({ log }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
