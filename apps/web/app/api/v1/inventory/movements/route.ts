import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');

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
        (
          SELECT json_agg(json_build_object(
            'item_id', l.item_id,
            'item_name', i.name,
            'sku', i.sku,
            'warehouse_id', l.warehouse_id,
            'warehouse_name', w.name,
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
      ORDER BY e.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
