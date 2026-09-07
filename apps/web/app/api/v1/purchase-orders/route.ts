import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');
    
    const rows = await sql`
      SELECT 
        po.id,
        po.purchase_order_number,
        po.status,
        po.created_at,
        s.name as supplier_name,
        (
          SELECT json_agg(json_build_object(
            'item_id', pol.item_id,
            'item_name', i.name,
            'ordered_qty', pol.ordered_qty,
            'received_qty', pol.received_qty,
            'uom', pol.uom,
            'unit_price', pol.unit_price
          ))
          FROM purchase_order_lines pol
          JOIN inventory_items i ON i.id = pol.item_id
          WHERE pol.purchase_order_id = po.id
        ) as lines
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.tenant_id = ${actor.tenantId}
      ORDER BY po.created_at DESC
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
