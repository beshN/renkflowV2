import { NextRequest, NextResponse } from 'next/server';
import { getStockBalances } from '@/lib/features/manufacturing/inventory.service';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
    const itemType = searchParams.get('itemType') || '';

    // Use enriched query with search/filter support
    const rows = await sql`
      SELECT
        b.item_id AS id,
        b.item_id,
        i.sku,
        i.name AS item_name,
        i.item_type,
        i.stock_uom,
        i.min_stock,
        b.warehouse_id,
        w.code AS warehouse_code,
        w.name AS warehouse_name,
        b.on_hand_qty,
        COALESCE(r.reserved_qty, 0) AS reserved_qty,
        b.on_hand_qty - COALESCE(r.reserved_qty, 0) AS available_qty,
        b.updated_at
      FROM stock_balances b
      JOIN inventory_items i ON i.id = b.item_id AND i.tenant_id = b.tenant_id
      JOIN warehouses w ON w.id = b.warehouse_id AND w.tenant_id = b.tenant_id
      LEFT JOIN LATERAL (
        SELECT SUM(rl.reserved_qty - rl.consumed_qty - rl.released_qty) AS reserved_qty
        FROM stock_reservation_lines rl
        JOIN stock_reservations rh ON rh.id = rl.reservation_id
        WHERE rl.tenant_id = b.tenant_id
          AND rl.item_id = b.item_id
          AND rl.warehouse_id = b.warehouse_id
          AND rh.status = 'active'
      ) r ON true
      WHERE b.tenant_id = ${actor.tenantId}
        AND i.active = true
        ${search ? sql`AND (i.name ILIKE ${'%' + search + '%'} OR i.sku ILIKE ${'%' + search + '%'})` : sql``}
        ${itemType ? sql`AND i.item_type = ${itemType}` : sql``}
        ${lowStockOnly ? sql`AND b.on_hand_qty - COALESCE(r.reserved_qty, 0) <= i.min_stock` : sql``}
      ORDER BY i.name, w.code
      LIMIT 200
    `;

    return NextResponse.json({
      success: true,
      items: rows,
      total: rows.length,
      // Legacy field for backward compat
      data: rows,
    });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Inventory balances error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
