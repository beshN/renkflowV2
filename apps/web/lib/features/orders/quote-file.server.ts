import "server-only";
import { columnExists } from "@/lib/db/schema-guard";
import { WorkOrderApiError } from "../work-orders/security";
import { storeVisualization } from "../product-3d/storage";
import { syncLeadQuoteState } from "../field/quote-sync.server";

/** One early file per quote; no sale, reservation or production is posted here. */
export async function ensureQuoteFile(
  tx: any,
  tenantId: string,
  quotationId: string,
) {
  if (!(await columnExists("orders", "quotation_id"))) return null;
  const [q] =
    await tx`SELECT * FROM quotations WHERE tenant_id=${tenantId} AND id=${quotationId}`;
  const items =
    await tx`SELECT * FROM quotation_items WHERE tenant_id=${tenantId} AND quotation_id=${quotationId} ORDER BY position,id`;
  if (!q) throw new WorkOrderApiError("Teklif bulunamadı", 404);
  const [old] =
    await tx`SELECT * FROM orders WHERE tenant_id=${tenantId} AND quotation_id=${quotationId} FOR UPDATE`;
  if (old) {
    if (old.provisional)
      await tx`UPDATE orders SET customer_id=${q.customer_id},customer_name=${q.customer_name},currency=${q.currency},product_name=${items[0]?.product_name || "Teklif"},quantity=${items.reduce((n: number, i: any) => n + Number(i.quantity), 0)},updated_at=now(),version=version+1 WHERE id=${old.id} AND tenant_id=${tenantId}`;
    return old;
  }
  // Existing conversions are linked, never duplicated or reclassified as an unapproved sale.
  if (q.converted_to_order_id) {
    const [linked] =
      await tx`UPDATE orders SET quotation_id=${quotationId},accepted_quotation_revision=${q.revision || 1} WHERE tenant_id=${tenantId} AND id=${q.converted_to_order_id} RETURNING *`;
    return linked;
  }
  const [file] =
    await tx`INSERT INTO orders(tenant_id,quotation_id,technical_file_required,provisional,order_number,customer_id,customer_name,status,total_amount,currency,product_name,quantity,custom_fields,assigned_to)
    VALUES(${tenantId},${quotationId},true,true,${"SIP-" + crypto.randomUUID().slice(0, 12).toUpperCase()},${q.customer_id},${q.customer_name},'pending_approval',0,${q.currency},${items[0]?.product_name || "Teklif"},${items.reduce((n: number, i: any) => n + Number(i.quantity), 0)},'{}',${q.created_by}) RETURNING *`;
  return file;
}

/** Customer approval copies the accepted commercial snapshot into the same file. */
export async function acceptQuoteFile(
  tx: any,
  tenantId: string,
  quotationId: string,
) {
  const file = await ensureQuoteFile(tx, tenantId, quotationId);
  await syncLeadQuoteState(tx, tenantId, quotationId);
  if (!file || !file.provisional) return file;
  const [q] =
    await tx`SELECT * FROM quotations WHERE tenant_id=${tenantId} AND id=${quotationId}`;
  if (!["accepted", "converted"].includes(q.status))
    throw new WorkOrderApiError("Önce müşteri onayı gerekli", 409);
  const items =
    await tx`SELECT * FROM quotation_items WHERE tenant_id=${tenantId} AND quotation_id=${quotationId} ORDER BY position,id`;
  if (!items.length) throw new WorkOrderApiError("Teklif kalemi gerekli", 409);
  for (const i of items) {
    const [line] =
      await tx`INSERT INTO order_items(order_id,product_name,quantity,unit_price,total_price,description,color,width_mm,height_mm,projection_mm,mounting_height_mm,awning_configuration,awning_preview,motor_type,led_type,fabric_type,notes,product_configuration)
      VALUES(${file.id},${i.product_name},${i.quantity},${i.unit_price},${i.total_price},${i.description},${i.color},${i.width_mm},${i.height_mm},${i.projection_mm},${i.mounting_height_mm},${i.awning_configuration ? JSON.stringify(i.awning_configuration) : null}::text::jsonb,${i.awning_preview},${i.awning_configuration?.motor || null},${i.awning_configuration?.led || null},${i.awning_configuration?.fabricName || null},${i.notes},${i.product_configuration ? JSON.stringify(i.product_configuration) : null}::text::jsonb) RETURNING id`;
    await storeVisualization(
      tx,
      "order_items",
      tenantId,
      line.id,
      i.product_visualization,
    );
  }
  const [accepted] =
    await tx`UPDATE orders SET provisional=false,accepted_quotation_revision=${q.revision || 1},status='approved',total_amount=${q.total_amount},updated_at=now(),version=version+1 WHERE tenant_id=${tenantId} AND id=${file.id} RETURNING *`;
  return accepted;
}

/** Shared gate for all old and new production entry points. Legacy standalone orders stay usable. */
export async function requireCommercialApproval(
  tx: any,
  tenantId: string,
  orderId: string,
  allowHeld = false,
) {
  if (!(await columnExists("orders", "quotation_id"))) return;
  const [o] =
    await tx`SELECT provisional,quotation_id,accepted_quotation_revision,status FROM orders WHERE tenant_id=${tenantId} AND id=${orderId}`;
  if (!o) throw new WorkOrderApiError("Sipariş bulunamadı", 404);
  if (
    o.provisional ||
    o.status === "cancelled" ||
    (!allowHeld && o.status === "on_hold")
  )
    throw new WorkOrderApiError(
      "Müşteri onayı olmayan veya bekletilen siparişte üretim yapılamaz",
      409,
    );
  if (!o.quotation_id) return;
  const [q] =
    await tx`SELECT status,revision FROM quotations WHERE tenant_id=${tenantId} AND id=${o.quotation_id}`;
  if (
    !q ||
    !["accepted", "converted"].includes(q.status) ||
    q.revision !== o.accepted_quotation_revision
  )
    throw new WorkOrderApiError(
      "Güncel teklif sürümü için müşteri onayı gerekli",
      409,
    );
}

/** A commercial revision invalidates the earlier approval before any production may proceed. */
export async function reopenQuoteFile(
  tx: any,
  tenantId: string,
  quotationId: string,
) {
  if (!(await columnExists("orders", "quotation_id"))) return;
  const [o] =
    await tx`SELECT id FROM orders WHERE tenant_id=${tenantId} AND quotation_id=${quotationId} FOR UPDATE`;
  if (!o) return;
  if (
    (
      await tx`SELECT id FROM work_orders WHERE tenant_id=${tenantId} AND order_id=${o.id} AND status<>'cancelled'`
    ).length
  )
    throw new WorkOrderApiError(
      "Üretime açılmış siparişi kontrollü revizyonla yönetin",
      409,
    );
  await tx`DELETE FROM order_items WHERE order_id=${o.id}`;
  await tx`UPDATE order_technical_revisions SET status='superseded' WHERE tenant_id=${tenantId} AND order_id=${o.id}`;
  await tx`UPDATE orders SET provisional=true,accepted_quotation_revision=NULL,total_amount=0,status='pending_approval',version=version+1 WHERE tenant_id=${tenantId} AND id=${o.id}`;
}
