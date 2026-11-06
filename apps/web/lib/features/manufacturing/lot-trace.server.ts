import 'server-only';
import { getSql } from '@/lib/db';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { canTraceLots, LotTraceQuerySchema } from './lot-trace';

/** Read-only snapshot, following parent links in both directions, including older remnants. */
export async function traceLots(actor: WorkOrderActor, raw: unknown) {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated) throw new WorkOrderApiError('Unauthorized', 401);
  if (!canTraceLots(access))
    throw new WorkOrderApiError('Bulunamadı', 404);
  const query = LotTraceQuerySchema.parse(raw);
  const t = actor.tenantId;
  return getSql().begin('isolation level repeatable read read only', async (tx: any) => {
    const lots = await tx`
      WITH RECURSIVE chain(id) AS (
        SELECT id FROM stock_lots WHERE tenant_id=${t}
          AND (${query.heat}::text IS NULL OR heat_number=${query.heat})
          AND (${query.supplierLot}::text IS NULL OR supplier_lot_number=${query.supplierLot})
        UNION
        SELECT related.id FROM chain c
        JOIN stock_lots current_lot ON current_lot.id=c.id AND current_lot.tenant_id=${t}
        JOIN stock_lots related ON related.tenant_id=${t} AND (
          related.id::text=current_lot.metadata->>'parentLotId'
          OR related.metadata->>'parentLotId'=current_lot.id::text
        )
      )
      SELECT l.id,l.lot_number,l.supplier_lot_number,l.heat_number,
        l.metadata->>'parentLotId' AS "parentLotId",l.created_at,l.remaining_qty,
        i.stock_uom AS uom,i.sku AS product_code,i.name AS product_name,
        w.id AS warehouse_id,w.name AS warehouse_name
      FROM stock_lots l
      JOIN chain c ON c.id=l.id
      JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=${t}
      JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=${t}
      WHERE l.tenant_id=${t} ORDER BY l.created_at,l.id`;
    if (!lots.length) return { lots: [] };
    const allocations = await tx`
      SELECT m.id,m.lot_id,m.quantity,m.uom,w.id AS work_order_id,w.title,
        o.id AS order_id,o.order_number,o.customer_name
      FROM work_order_material_lots m
      JOIN work_orders w ON w.id=m.work_order_id AND w.tenant_id=${t}
      LEFT JOIN orders o ON o.id=w.order_id AND o.tenant_id=${t}
      WHERE m.tenant_id=${t} AND m.lot_id=ANY(${lots.map((l: any) => l.id)}::uuid[])
      ORDER BY m.created_at,m.id`;
    // Historical profile consumption is already recorded in completed plans. Read it without
    // changing material allocations, quality evidence or rework costing.
    const cuts = await tx`
      SELECT p.id AS cut_plan_id,l.id AS lot_id,w.id AS work_order_id,w.title,
        o.id AS order_id,o.order_number,o.customer_name,
        (SUM((piece.value->>'lengthMm')::numeric) / 1000)::text AS quantity,'m' AS uom
      FROM cutting_plans p
      CROSS JOIN LATERAL jsonb_array_elements(p.result->'bars') bar(value)
      CROSS JOIN LATERAL jsonb_array_elements(bar.value->'pieces') piece(value)
      JOIN stock_lots l ON l.id::text=bar.value->'source'->>'id' AND l.tenant_id=${t}
      JOIN work_orders w ON w.id::text=piece.value->>'workOrderId' AND w.tenant_id=${t}
      LEFT JOIN orders o ON o.id=w.order_id AND o.tenant_id=${t}
      WHERE p.tenant_id=${t} AND p.status='completed' AND l.id=ANY(${lots.map((l: any) => l.id)}::uuid[])
      GROUP BY p.id,l.id,w.id,o.id
      ORDER BY p.created_at,p.id,l.id,w.id`;
    const evidence = [
      ...allocations.map((m: any) => ({ ...m, allocationId: m.id, cutPlanId: null })),
      ...cuts.map((m: any) => ({ ...m, allocationId: null, cutPlanId: m.cut_plan_id })),
    ];
    // Preserve each lot/allocation unit and numeric precision; never total different units.
    return { lots: lots.map((lot: any) => ({ ...lot,
      workOrders: evidence.filter((m: any) => m.lot_id === lot.id).map((m: any) => ({
        id: m.work_order_id, title: m.title, allocationId: m.allocationId, cutPlanId: m.cutPlanId, quantity: m.quantity, uom: m.uom,
        order: m.order_id ? { id: m.order_id, order_number: m.order_number, customer_name: m.customer_name } : null,
      })),
    })) };
  });
}
