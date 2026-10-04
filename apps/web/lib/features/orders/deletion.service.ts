import "server-only";
import { randomUUID } from "node:crypto";
import { sql, withTransaction } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { WorkOrderApiError } from "../work-orders/security";

export async function deleteUnlinkedOrder(
  tenantId: string,
  orderId: string,
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId},0))`;
    const [order] =
      await tx`SELECT id,status FROM orders WHERE tenant_id=${tenantId} AND id=${orderId} FOR UPDATE`;
    if (!order) throw new WorkOrderApiError("Sipariş bulunamadı", 404);
    if (!["new", "pending", "pending_approval"].includes(order.status))
      throw new WorkOrderApiError(
        "İşleme alınmış sipariş silinemez. İptal akışını kullanın.",
        409,
      );
    const [linked] = await tx`SELECT
      EXISTS(SELECT 1 FROM order_transition_commands WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM work_orders WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM payments WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM order_documents WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM shipment_items WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM quotations WHERE tenant_id=${tenantId} AND converted_to_order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM tax_transactions WHERE tenant_id=${tenantId} AND related_order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM journal_entry_lines l JOIN journal_entries j ON j.id=l.journal_entry_id WHERE j.tenant_id=${tenantId} AND l.order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM stock_reservations WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM customer_tracking_links WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM notification_outbox WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM intake_drafts WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM production_shipments WHERE tenant_id=${tenantId} AND order_id=${orderId}) OR
      EXISTS(SELECT 1 FROM stock_movements WHERE tenant_id=${tenantId} AND order_id=${orderId}) AS present`;
    if (linked.present)
      throw new WorkOrderApiError(
        "Bu sipariş üretim, teklif, stok veya finans kayıtlarına bağlı. Geçmişi korumak için silinemez.",
        409,
      );
    await tx`INSERT INTO storage_cleanup_queue(tenant_id,order_id,file_path)
      SELECT tenant_id,order_id,file_path FROM documents WHERE tenant_id=${tenantId} AND order_id=${orderId}
      AND (file_path LIKE ${"orders/" + orderId + "/%"} OR file_path LIKE ${"uploads/" + tenantId + "/%"}) ON CONFLICT(tenant_id,file_path) DO NOTHING`;
    await tx`DELETE FROM orders WHERE tenant_id=${tenantId} AND id=${orderId}`;
  });
}

/** File deletion happens only after the DB commit. A lease makes failures and worker restarts retryable. */
export async function drainStorageCleanup(
  removeFile: (path: string) => Promise<void> = deleteFile,
  limit = 20,
) {
  let done = 0;
  for (let i = 0; i < limit; i++) {
    const lease = randomUUID();
    const task = await withTransaction(async (tx) => {
      const [row] = await tx`SELECT * FROM storage_cleanup_queue WHERE
        (status='pending' AND next_attempt_at<=now()) OR (status='processing' AND lease_expires_at<now())
        ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!row) return null;
      await tx`UPDATE storage_cleanup_queue SET status='processing',lease_id=${lease},lease_expires_at=now()+interval '5 minutes',attempts=attempts+1 WHERE id=${row.id}`;
      return row;
    });
    if (!task) break;
    try {
      if (
        (!task.file_path.startsWith("orders/" + task.order_id + "/") && !task.file_path.startsWith("uploads/" + task.tenant_id + "/")) ||
        task.file_path.split("/").includes("..")
      )
        throw new Error("Geçersiz dosya yolu");
      // Never remove a key that another surviving document references.
      if (
        (
          await sql`SELECT id FROM documents WHERE file_path=${task.file_path} UNION ALL SELECT id FROM order_documents WHERE file_url=${task.file_path} UNION ALL SELECT id FROM production_files WHERE file_path=${task.file_path} LIMIT 1`
        ).length
      )
        throw new Error("Dosya halen bir kayda bağlı");
      await removeFile(task.file_path);
      await sql`UPDATE storage_cleanup_queue SET status='done',completed_at=now(),lease_id=null,lease_expires_at=null,last_error=null WHERE id=${task.id} AND lease_id=${lease}`;
      done++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Dosya silinemedi";
      await sql`UPDATE storage_cleanup_queue SET status=CASE WHEN attempts>=10 THEN 'failed' ELSE 'pending' END,
        next_attempt_at=now()+${Math.min(3600, 30 * 2 ** Number(task.attempts))}*interval '1 second',
        lease_id=null,lease_expires_at=null,last_error=${message.slice(0, 500)} WHERE id=${task.id} AND lease_id=${lease}`;
    }
  }
  return { done };
}
