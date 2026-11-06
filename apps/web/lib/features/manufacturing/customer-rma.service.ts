import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { tableExists } from "@/lib/db/schema-guard";
import { withTransaction } from "@/lib/db/transaction";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { requireCap } from "../field/common.server";
import { COUNT_UNITS } from "../inventory/vocabulary";
import { CustomerRmaInput, CustomerRmaDecision } from "./customer-rma";
const fail = (message: string, status = 409): never => {
  throw new WorkOrderApiError(message, status);
};
async function access(a: WorkOrderActor, action: "view" | "create" | "edit") {
  if (["worker", "member"].includes(a.role))
    fail("Müşteri iadesi için yetkiniz yok", 403);
  await requireCap(a, "orders", "view", "Müşteri iadesi");
  await requireCap(a, "service", "view", "Müşteri iadesi");
  await requireCap(a, "service", action, "Müşteri iadesi");
}
async function ready() {
  if (!(await tableExists("customer_rma_lines")))
    fail("Müşteri iadesi için veritabanı güncellemesi bekleniyor");
}
// Manual orders explicitly marked delivered use their line quantity only when no native shipment exists for that line.
// Delivered quantities always retain the source order item's unit. No conversion or cross-line totals.
export async function customerRmaSources(a: WorkOrderActor, orderId: string) {
  await access(a, "view");
  const [o] =
    await sql`SELECT id FROM orders WHERE tenant_id=${a.tenantId} AND id=${orderId}`;
  if (!o) fail("Sipariş bulunamadı", 404);
  return sql`SELECT i.id,i.product_name,i.quantity_unit AS uom,
 CASE WHEN o.status='delivered' AND NOT EXISTS(SELECT 1 FROM production_shipments ps JOIN work_orders pw ON pw.tenant_id=ps.tenant_id AND pw.id=ps.work_order_id WHERE ps.tenant_id=${a.tenantId} AND ps.order_id=o.id AND pw.order_item_id=i.id)
 THEN i.quantity ELSE COALESCE((SELECT sum(s.quantity) FROM production_shipments s JOIN work_orders w ON w.tenant_id=s.tenant_id AND w.id=s.work_order_id
 WHERE s.tenant_id=${a.tenantId} AND s.order_id=o.id AND s.status='delivered' AND w.order_item_id=i.id AND w.production_uom=i.quantity_unit),0) END AS delivered_qty
 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.tenant_id=${a.tenantId} AND o.id=${orderId}`;
}
export async function customerRmas(a: WorkOrderActor, id?: string) {
  await access(a, "view");
  await ready();
  const rows = await sql`SELECT r.*,o.order_number,o.customer_name,
 COALESCE((SELECT json_agg(l) FROM customer_rma_lines l WHERE l.tenant_id=r.tenant_id AND l.rma_id=r.id),'[]'::json) AS lines
 FROM customer_rmas r JOIN orders o ON o.tenant_id=r.tenant_id AND o.id=r.order_id
 WHERE r.tenant_id=${a.tenantId} AND (${id || null}::uuid IS NULL OR r.id=${id || null}::uuid) ORDER BY r.created_at DESC LIMIT 300`;
  if (id && !rows.length) fail("Müşteri iadesi bulunamadı", 404);
  return rows;
}
async function audit(
  tx: any,
  a: WorkOrderActor,
  id: string,
  action: string,
  changes: Record<string, { from: unknown; to: unknown }>,
) {
  await tx`INSERT INTO activity_logs(tenant_id,entity_type,entity_id,action,actor_id,changes)
 VALUES(${a.tenantId},'customer_rma',${id},${action},${a.userId},${JSON.stringify(changes)}::text::jsonb)`;
}
export async function createCustomerRma(a: WorkOrderActor, raw: unknown) {
  await access(a, "create");
  await ready();
  const d = CustomerRmaInput.parse(raw),
    t = a.tenantId;
  return withTransaction(async ({ sql: tx }) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t},0))`;
    const [source] =
      await tx`SELECT i.*,o.order_number,o.status AS order_status FROM order_items i JOIN orders o ON o.id=i.order_id
 WHERE o.tenant_id=${t} AND i.id=${d.sourceLineId} FOR UPDATE OF i,o`;
    if (!source) fail("Sipariş kalemi bulunamadı", 404);
    const [old] =
      await tx`SELECT r.*,l.order_item_id,l.quantity,l.reason,l.photo_attachment_id FROM customer_rmas r JOIN customer_rma_lines l ON l.tenant_id=r.tenant_id AND l.rma_id=r.id WHERE r.tenant_id=${t} AND r.idempotency_key=${d.idempotencyKey}`;
    if (old) {
      if (
        old.order_item_id !== d.sourceLineId ||
        Number(old.quantity) !== d.quantity ||
        old.reason !== d.reason ||
        old.photo_attachment_id !== (d.photoAttachmentId || null) ||
        (d.serviceTicketId && old.service_ticket_id !== d.serviceTicketId)
      )
        fail("İşlem anahtarı başka bir iadede kullanılmış");
      return old;
    }
    if (COUNT_UNITS.has(source.quantity_unit) && !Number.isInteger(d.quantity))
      fail("Adet biriminde tam sayı gerekli", 400);
    const [available] =
      await tx`SELECT (CASE WHEN ${source.order_status}='delivered' AND NOT EXISTS(SELECT 1 FROM production_shipments ps JOIN work_orders pw ON pw.tenant_id=ps.tenant_id AND pw.id=ps.work_order_id WHERE ps.tenant_id=${t} AND ps.order_id=${source.order_id} AND pw.order_item_id=${source.id})
 THEN ${source.quantity}::numeric ELSE COALESCE((SELECT sum(s.quantity) FROM production_shipments s JOIN work_orders w ON w.tenant_id=s.tenant_id AND w.id=s.work_order_id WHERE s.tenant_id=${t} AND s.order_id=${source.order_id} AND s.status='delivered' AND w.order_item_id=${source.id} AND w.production_uom=${source.quantity_unit}),0) END)
 -COALESCE((SELECT sum(l.quantity) FROM customer_rma_lines l WHERE l.tenant_id=${t} AND l.order_item_id=${source.id}),0) >= ${d.quantity}::numeric AS enough`;
    if (!available.enough) fail("İade miktarı kalan teslim miktarını aşamaz");
    if (d.photoAttachmentId) {
      const [f] =
        await tx`SELECT id FROM record_attachments WHERE tenant_id=${t} AND id=${d.photoAttachmentId} AND entity_type='order' AND entity_id=${source.order_id} AND mime_type LIKE 'image/%' AND deleted_at IS NULL`;
      if (!f) fail("Sipariş fotoğrafı bulunamadı", 404);
    }
    const [ticket] = d.serviceTicketId
      ? await tx`SELECT id FROM service_tickets WHERE tenant_id=${t} AND id=${d.serviceTicketId} AND order_id=${source.order_id}`
      : await tx`SELECT id FROM service_tickets WHERE tenant_id=${t} AND order_id=${source.order_id} ORDER BY created_at DESC,id LIMIT 1`;
    if (d.serviceTicketId && !ticket) fail("Servis kaydı bulunamadı", 404);
    const [r] =
      await tx`INSERT INTO customer_rmas(tenant_id,return_number,order_id,service_ticket_id,idempotency_key,created_by,updated_by) VALUES(${t},${"RMA-" + randomUUID().toUpperCase()},${source.order_id},${ticket?.id || null},${d.idempotencyKey},${a.userId},${a.userId}) RETURNING *`;
    await tx`INSERT INTO customer_rma_lines(tenant_id,rma_id,order_id,order_item_id,quantity,uom,reason,photo_attachment_id,created_by) VALUES(${t},${r.id},${source.order_id},${source.id},${d.quantity},${source.quantity_unit},${d.reason},${d.photoAttachmentId || null},${a.userId})`;
    await audit(tx, a, r.id, "created", {
      decision: { from: null, to: "pending" },
      serviceTicketId: { from: null, to: ticket?.id || null },
    });
    return r;
  });
}
export async function decideCustomerRma(
  a: WorkOrderActor,
  id: string,
  raw: unknown,
) {
  await access(a, "edit");
  await ready();
  const { decision } = CustomerRmaDecision.parse(raw),
    t = a.tenantId;
  if (decision === "replace")
    await requireCap(a, "production", "create", "Değişim taslak iş emri");
  return withTransaction(async ({ sql: tx }) => {
    const [r] =
      await tx`SELECT * FROM customer_rmas WHERE tenant_id=${t} AND id=${id} FOR UPDATE`;
    if (!r) fail("Müşteri iadesi bulunamadı", 404);
    if (r.decision === decision) return r;
    if (r.decision !== "pending")
      fail("Karar yalnız bekleyen iadeye verilebilir");
    let wo = null;
    if (decision === "replace") {
      const [l] =
        await tx`SELECT * FROM customer_rma_lines WHERE tenant_id=${t} AND rma_id=${id}`;
      const [w] =
        await tx`INSERT INTO work_orders(tenant_id,title,description,category,status,source,created_by,order_id,order_item_id,planned_qty,production_uom,customer_rma_approval_pending)
 VALUES(${t},${"Taslak değişim · " + r.return_number},'İnsan onayı bekleniyor; üretim reçetesi ve malzeme planı ayrıca hazırlanmalıdır.','general','blocked','manual',${a.userId},${r.order_id},${l.order_item_id},${l.quantity},${l.uom},true) RETURNING id`;
      wo = w.id;
    }
    const [updated] =
      await tx`UPDATE customer_rmas SET decision=${decision},replacement_work_order_id=${wo},decided_at=now(),updated_at=now(),updated_by=${a.userId} WHERE tenant_id=${t} AND id=${id} RETURNING *`;
    await audit(tx, a, id, "decision", {
      decision: { from: "pending", to: decision },
      workOrderId: { from: null, to: wo },
    });
    return updated;
  });
}
export async function approveCustomerRmaReplacement(
  a: WorkOrderActor,
  id: string,
) {
  await access(a, "edit");
  await requireCap(a, "production", "approve", "Değişim iş emri insan onayı");
  await ready();
  return withTransaction(async ({ sql: tx }) => {
    const [r] =
      await tx`SELECT * FROM customer_rmas WHERE tenant_id=${a.tenantId} AND id=${id} FOR UPDATE`;
    if (!r) fail("Müşteri iadesi bulunamadı", 404);
    if (r.decision !== "replace") fail("Değişim kararı gerekli");
    if (r.replacement_approved_at) return r;
    await tx`UPDATE work_orders SET customer_rma_approval_pending=false,updated_at=now() WHERE tenant_id=${a.tenantId} AND id=${r.replacement_work_order_id}`;
    const [updated] =
      await tx`UPDATE customer_rmas SET replacement_approved_by=${a.userId},replacement_approved_at=now(),updated_by=${a.userId},updated_at=now() WHERE tenant_id=${a.tenantId} AND id=${id} RETURNING *`;
    await audit(tx, a, id, "replacement_approved", {
      replacementApproved: { from: false, to: true },
      workOrderId: { from: null, to: r.replacement_work_order_id },
    });
    return updated;
  });
}
