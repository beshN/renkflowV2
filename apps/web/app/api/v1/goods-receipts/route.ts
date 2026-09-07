import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');
    
    const rows = await sql`
      SELECT 
        gr.id,
        gr.receipt_number,
        gr.status,
        gr.created_at,
        po.purchase_order_number,
        s.name as supplier_name,
        u.name as received_by_name,
        (
          SELECT json_agg(json_build_object(
            'item_id', grl.item_id,
            'item_name', i.name,
            'accepted_qty', grl.accepted_qty,
            'rejected_qty', grl.rejected_qty,
            'uom', grl.uom,
            'accepted_warehouse_name', w.name
          ))
          FROM goods_receipt_lines grl
          JOIN inventory_items i ON i.id = grl.item_id
          JOIN warehouses w ON w.id = grl.accepted_warehouse_id
          WHERE grl.goods_receipt_id = gr.id
        ) as lines
      FROM goods_receipts gr
      LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN users u ON u.id = gr.received_by
      WHERE gr.tenant_id = ${actor.tenantId}
      ORDER BY gr.created_at DESC
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
