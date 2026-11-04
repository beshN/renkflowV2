import type { WorkOrderActor } from '@/lib/features/work-orders/security';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { ROUTE_ROLES } from '@/lib/auth/permissions';

/** order_items inherits its tenant through orders; every other join is tenant-scoped. */
export async function readShipmentLoadList(sql: any, actor: WorkOrderActor, id: string) {
  if (!(ROUTE_ROLES['/shipments'] ?? []).includes(actor.role))
    throw new WorkOrderApiError('Sevkiyat kayıtlarına erişim yetkiniz yok', 403);
  const [shipment] = await sql`
    SELECT id, shipment_number, customer_name, carrier, tracking_number, status
    FROM shipments WHERE tenant_id=${actor.tenantId} AND id=${id}`;
  if (!shipment) throw new WorkOrderApiError('Sevkiyat bulunamadı', 404);
  const items = await sql`
    SELECT si.id, si.product_name, si.quantity, si.order_item_id,
      o.order_number, COALESCE(w.production_uom, oi.quantity_unit) AS uom,
      w.id AS work_order_id
    FROM shipment_items si
    JOIN shipments s ON s.id=si.shipment_id AND s.tenant_id=si.tenant_id
    LEFT JOIN orders o ON o.id=si.order_id AND o.tenant_id=si.tenant_id
    LEFT JOIN order_items oi ON oi.id=si.order_item_id AND oi.order_id=o.id
    LEFT JOIN production_shipments ps ON ps.erp_shipment_id=s.id
      AND ps.tenant_id=s.tenant_id AND ps.order_id=o.id
    LEFT JOIN work_orders w ON w.id=ps.work_order_id AND w.tenant_id=ps.tenant_id
      AND w.order_id=o.id AND w.order_item_id=oi.id
    WHERE si.tenant_id=${actor.tenantId} AND s.tenant_id=${actor.tenantId} AND s.id=${id}
    ORDER BY si.created_at, si.id`;
  return { ...shipment, items };
}

