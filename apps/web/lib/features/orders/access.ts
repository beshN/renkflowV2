import { sql } from "@/lib/db";
import type { Order } from "@/lib/types";
import { canViewFinancialFields, type UserRole } from "../auth/permissions";

/** Allowlist technical values so future commercial fields cannot silently reach a worker. */
export function technicalOrder(order: Order): Order {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tenantId: order.tenantId,
    customerName: order.customerName,
    date: order.date,
    deliveryDate: order.deliveryDate,
    status: order.status,
    priority: order.priority,
    productName: order.productName,
    quantity: order.quantity,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    version: order.version,
    productionManaged: order.productionManaged,
    financialHidden: true,
    documents: [],
    items: order.items?.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      color: item.color,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      projectionMm: item.projectionMm,
      mountingHeightMm: item.mountingHeightMm,
      awningConfiguration: item.awningConfiguration,
      awningPreview: item.awningPreview,
      motorType: item.motorType,
      ledType: item.ledType,
      fabricType: item.fabricType,
    })),
  } as unknown as Order;
}

/** General order readers share the same assignment and financial boundary, including server actions. */
export async function visibleOrdersForActor(
  orders: Order[],
  actor: { tenantId: string; userId: string; role: UserRole },
): Promise<Order[]> {
  if (canViewFinancialFields(actor.role)) return orders;
  const assigned =
    await sql`SELECT DISTINCT w.order_id FROM work_orders w WHERE w.tenant_id=${actor.tenantId}
    AND (w.assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations p
      WHERE p.tenant_id=w.tenant_id AND p.work_order_id=w.id AND p.assigned_to=${actor.userId}))`;
  const ids = new Set(assigned.map((row: any) => row.order_id));
  return orders.filter((order) => ids.has(order.id)).map(technicalOrder);
}
