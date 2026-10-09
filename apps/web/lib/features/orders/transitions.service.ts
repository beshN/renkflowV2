import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { hasPermission } from "../auth/permissions";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { applyOrderStatus } from "@/lib/features/sales/order-status.server";
export const TransitionCommandSchema = z
  .object({
    commandId: z.uuid(),
    version: z.number().int().positive(),
    newStatus: z.string().max(40),
    note: z.string().trim().max(2000).default(""),
  })
  .strict();
export async function transitionOrder(
  a: WorkOrderActor,
  id: string,
  raw: unknown,
) {
  if (!hasPermission(a.role, "orders.edit"))
    throw new WorkOrderApiError("Sipariş durumu değiştirme yetkiniz yok", 403);
  z.uuid().parse(id);
  const d = TransitionCommandSchema.parse(raw),
    hash = createHash("sha256")
      .update(JSON.stringify({ id, ...d }))
      .digest("hex");
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [prior] =
      await tx`SELECT actor_id,request_hash,result FROM order_transition_commands WHERE tenant_id=${a.tenantId} AND command_id=${d.commandId}`;
    if (prior) {
      if (prior.actor_id !== a.userId || prior.request_hash !== hash)
        throw new WorkOrderApiError(
          "İşlem anahtarı başka bir istekte kullanılmış",
          409,
        );
      // A replay answers as before and says so: what follows a change (notices) is not done twice.
      return { ...prior.result, replayed: true };
    }
    const [order] =
      await tx`SELECT id,status,version FROM orders WHERE tenant_id=${a.tenantId} AND id=${id} FOR UPDATE`;
    if (!order) throw new WorkOrderApiError("Sipariş bulunamadı", 404);
    if (order.version !== d.version)
      throw new WorkOrderApiError(
        "Sipariş başka bir cihazda değişti. Güncel kaydı açın.",
        409,
      );
    if (
      (
        await tx`SELECT id FROM work_orders WHERE tenant_id=${a.tenantId} AND order_id=${id} AND recipe_id IS NOT NULL LIMIT 1`
      ).length
    )
      throw new WorkOrderApiError(
        "Bu siparişin durumu üretim ve sevkiyat kayıtlarından hesaplanır. İlgili operasyon ekranını kullanın.",
        409,
      );
    if (order.status === d.newStatus)
      throw new WorkOrderApiError("Bu durum geçişine izin verilmiyor", 409);
    await applyOrderStatus(tx, { tenantId: a.tenantId, orderId: id, from: order.status, to: d.newStatus, actorId: a.userId, note: d.note });
    const result = {
      orderId: id,
      previousStatus: order.status,
      newStatus: d.newStatus,
      version: order.version + 1,
    };
    await tx`INSERT INTO order_transition_commands(tenant_id,command_id,actor_id,order_id,request_hash,result)VALUES(${a.tenantId},${d.commandId},${a.userId},${id},${hash},${JSON.stringify(result)}::text::jsonb)`;
    return result;
  });
}
