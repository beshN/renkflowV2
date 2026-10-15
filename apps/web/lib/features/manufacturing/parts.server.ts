import "server-only";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { resolveMemberAccess } from "@/lib/security/member-access.server";
import { can } from "@/lib/security/access-matrix";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { requireCommercialApproval } from "../orders/quote-file.server";
import { stableJson } from "../products/configuration";
import { syncDailyStages } from "./daily-progress.server";

const Input = z
  .object({
    commandId: z.uuid(),
    workOrderId: z.uuid(),
    technicalRevisionId: z.uuid(),
    itemId: z.uuid(),
    lengthMm: z.number().positive(),
    targetColor: z.string().min(1).max(100),
    quantity: z.number().int().positive().max(10000),
    action: z.enum(["paint.send", "paint.return"]),
  })
  .strict();
/** Daily quantity entries have permission and evidence checks, not a second manager approval. */
export async function recordPartProgress(a: WorkOrderActor, raw: unknown) {
  const d = Input.parse(raw),
    access = await resolveMemberAccess(a.userId, a.tenantId);
  if (!access || access.deactivated || !can(access, "production", "edit"))
    throw new WorkOrderApiError("Üretim işlemi yetkiniz yok", 403);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [job] =
      await tx`SELECT * FROM work_orders WHERE tenant_id=${a.tenantId} AND id=${d.workOrderId} FOR UPDATE`;
    if (!job || (a.role === "worker" && job.assigned_to !== a.userId))
      throw new WorkOrderApiError("Üretim kaydı bulunamadı", 404);
    await requireCommercialApproval(tx, a.tenantId, job.order_id);
    if (job.technical_revision_id !== d.technicalRevisionId)
      throw new WorkOrderApiError(
        "Teknik sürüm değişti; güncel planı açın",
        409,
      );
    const [revision] =
      await tx`SELECT status FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND id=${d.technicalRevisionId}`;
    if (
      revision?.status !== "approved" &&
      !(revision?.status === "blocked" && d.action === "paint.return")
    )
      throw new WorkOrderApiError("Teknik plan güncel değil", 409);
    const [prior] =
      await tx`SELECT payload,actor_id FROM production_events WHERE tenant_id=${a.tenantId} AND command_id=${d.commandId}`;
    if (prior) {
      if (
        prior.actor_id !== a.userId ||
        stableJson(prior.payload.input) !== stableJson(d)
      )
        throw new WorkOrderApiError(
          "İşlem anahtarı farklı içerikte kullanıldı",
          409,
        );
      return { replayed: true };
    }
    const from = d.action === "paint.send" ? "paint_waiting" : "paint_sent",
      to = d.action === "paint.send" ? "paint_sent" : "paint_returned";
    const parts =
      await tx`SELECT id FROM production_parts WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id} AND technical_revision_id=${d.technicalRevisionId} AND item_id=${d.itemId} AND length_mm=${d.lengthMm} AND target_color=${d.targetColor} AND state=${from} ORDER BY sequence LIMIT ${d.quantity} FOR UPDATE`;
    if (parts.length !== d.quantity)
      throw new WorkOrderApiError(
        "Miktar bu aşamada bekleyen parça sayısını aşıyor",
        409,
      );
    await tx`UPDATE production_parts SET state=${to},paint_sent_at=CASE WHEN ${to}='paint_sent' THEN now() ELSE paint_sent_at END,paint_returned_at=CASE WHEN ${to}='paint_returned' THEN now() ELSE paint_returned_at END,updated_by=${a.userId} WHERE tenant_id=${a.tenantId} AND id=ANY(${parts.map((p: any) => p.id)}::uuid[])`;
    await tx`INSERT INTO production_events(tenant_id,work_order_id,event_type,payload,actor_id,command_id) VALUES(${a.tenantId},${job.id},${d.action},${JSON.stringify({ input: d, partIds: parts.map((p: any) => p.id) })}::text::jsonb,${a.userId},${d.commandId})`;
    await syncDailyStages(tx, a.tenantId, job.id, a.userId);
    return { quantity: d.quantity, state: to };
  });
}
