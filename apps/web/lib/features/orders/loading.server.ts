import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { withTransaction } from "@/lib/db";
import { resolveMemberAccess } from "@/lib/security/member-access.server";
import { can } from "@/lib/security/access-matrix";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { shipProducedQuantity } from "../manufacturing/platform.service";
import { stableJson } from "../products/configuration";
const Input = z
  .object({
    commandId: z.uuid(),
    orderId: z.uuid(),
    technicalRevisionId: z.uuid(),
    lines: z
      .array(
        z.object({
          workOrderId: z.uuid(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(100),
    photos: z.array(z.string().max(500)).min(1).max(6),
    checkedIds: z.array(z.string().max(100)).max(100),
    vehiclePlate: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();
export async function loadOrder(a: WorkOrderActor, raw: unknown) {
  const d = Input.parse(raw),
    access = await resolveMemberAccess(a.userId, a.tenantId);
  if (!access || access.deactivated || !can(access, "production", "edit"))
    throw new WorkOrderApiError("Yükleme yetkiniz yok", 403);
  if (new Set(d.lines.map((l) => l.workOrderId)).size !== d.lines.length)
    throw new WorkOrderApiError("Ürün aynı yüklemede yinelenemez", 400);
  const hash = createHash("sha256").update(stableJson(d)).digest("hex");
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [old] =
      await tx`SELECT actor_id,request_hash,result FROM production_commands WHERE tenant_id=${a.tenantId} AND command_id=${d.commandId}`;
    if (old) {
      if (old.actor_id !== a.userId || old.request_hash !== hash)
        throw new WorkOrderApiError(
          "İşlem anahtarı farklı yüklemede kullanılmış",
          409,
        );
      return { ...old.result, replayed: true };
    }
    const shipments = [];
    for (const l of d.lines) {
      const [job] =
        await tx`SELECT id,technical_revision_id FROM work_orders WHERE tenant_id=${a.tenantId} AND id=${l.workOrderId} AND order_id=${d.orderId}`;
      if (!job) throw new WorkOrderApiError("Ürün bu siparişe ait değil", 404);
      if (
        !job.technical_revision_id &&
        (d.checkedIds.length !== 1 || d.checkedIds[0] !== "product")
      )
        throw new WorkOrderApiError(
          "Ürün ve aksesuar tamlık kontrolünü tamamlayın",
          400,
        );
      const result = await shipProducedQuantity(
        tx,
        a,
        {
          ...l,
          technicalRevisionId: d.technicalRevisionId,
          photos: d.photos,
          checkedIds: d.checkedIds,
          vehiclePlate: d.vehiclePlate,
          notes: d.notes,
        },
        d.commandId + ":" + l.workOrderId,
      );
      shipments.push({ id: result.id, quantity: l.quantity });
    }
    const result = { shipments };
    await tx`INSERT INTO production_commands(tenant_id,command_id,actor_id,request_hash,result) VALUES(${a.tenantId},${d.commandId},${a.userId},${hash},${JSON.stringify(result)}::text::jsonb)`;
    return result;
  });
}
