import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');
    // One material's movements (the stock list's timeline), or all of them.
    const raw = req.nextUrl.searchParams.get('itemId');
    const itemId = raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;

    const rows = await sql`
      SELECT 
        e.id,
        e.entry_number,
        e.entry_type,
        e.status,
        e.reference_type,
        e.reference_id,
        e.note,
        e.created_at,
        u.name as submitted_by_name,
        -- The order behind a production movement, so every movement can be traced to its cause.
        (
          SELECT o.order_number FROM work_orders w JOIN orders o ON o.id = w.order_id AND o.tenant_id = w.tenant_id
          WHERE w.tenant_id = e.tenant_id AND w.id = CASE
            WHEN e.reference_type IN ('work_order', 'shipment') THEN e.reference_id
            WHEN e.reference_type = 'rework' THEN (SELECT r.work_order_id FROM production_rework r WHERE r.tenant_id = e.tenant_id AND r.id = e.reference_id)
          END
        ) as order_number,
        (SELECT g.receipt_number FROM goods_receipts g WHERE g.tenant_id = e.tenant_id AND g.id = e.reference_id AND e.reference_type = 'goods_receipt') as receipt_number,
        (
          SELECT json_agg(json_build_object(
            'item_id', l.item_id,
            'item_name', i.name,
            'sku', i.sku,
            'warehouse_id', l.warehouse_id,
            'warehouse_name', w.name,
            'warehouse_type', w.warehouse_type,
            'quantity_delta', l.quantity_delta,
            'uom', l.uom
          ))
          FROM stock_entry_lines l
          JOIN inventory_items i ON i.id = l.item_id
          JOIN warehouses w ON w.id = l.warehouse_id
          WHERE l.stock_entry_id = e.id
        ) as lines
      FROM stock_entries e
      LEFT JOIN users u ON u.id = e.submitted_by
      WHERE e.tenant_id = ${actor.tenantId}
        AND (${itemId}::uuid IS NULL OR EXISTS (SELECT 1 FROM stock_entry_lines x WHERE x.stock_entry_id = e.id AND x.item_id = ${itemId}::uuid))
      ORDER BY e.created_at DESC
      LIMIT 100
    `;

    return redactedJson({
      success: true,
      data: rows
    });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return redactedJson({ error: error.message }, { status: error.status });
    }
    return redactedJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}
