import 'server-only';

import { sql } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { available, thresholdStatus, type ThresholdRow } from './reorder';

/** Every active item with a minimum stock, with usable stock, reservations, orders and its last purchase. */
export async function thresholdRows(db: any, tenantId: string): Promise<ThresholdRow[]> {
  const rows = await db`
    SELECT i.id, i.sku, i.name, i.stock_uom, i.min_stock,
      COALESCE((SELECT sum(b.on_hand_qty) FROM stock_balances b JOIN warehouses w ON w.id = b.warehouse_id AND w.tenant_id = b.tenant_id
        WHERE b.tenant_id = i.tenant_id AND b.item_id = i.id AND w.warehouse_type IN ('RAW', 'REUSABLE_REMNANTS')), 0) AS on_hand,
      COALESCE((SELECT sum(rl.reserved_qty - rl.consumed_qty - rl.released_qty) FROM stock_reservation_lines rl
        JOIN stock_reservations rh ON rh.id = rl.reservation_id JOIN warehouses w ON w.id = rl.warehouse_id AND w.tenant_id = rl.tenant_id
        WHERE rl.tenant_id = i.tenant_id AND rl.item_id = i.id AND rh.status = 'active' AND w.warehouse_type IN ('RAW', 'REUSABLE_REMNANTS')), 0) AS reserved,
      COALESCE((SELECT sum(greatest(l.ordered_qty - l.received_qty, 0)) FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id
        WHERE l.tenant_id = i.tenant_id AND l.item_id = i.id AND po.status IN ('submitted', 'partially_received')), 0) AS incoming,
      COALESCE((SELECT sum(l.ordered_qty) FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id
        WHERE l.tenant_id = i.tenant_id AND l.item_id = i.id AND po.status = 'draft'), 0) AS drafted,
      lp.supplier_id, lp.supplier_name, lp.supplier_active, lp.warehouse_id, lp.unit_price, lp.currency, lp.metadata, lp.purchase_order_number
    FROM inventory_items i
    LEFT JOIN LATERAL (
      SELECT po.supplier_id, s.name AS supplier_name, coalesce(s.is_active, false) AS supplier_active, l.warehouse_id, l.unit_price,
        coalesce(po.currency, 'TRY') AS currency, l.metadata, po.purchase_order_number
      FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id
      LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.tenant_id = po.tenant_id
      WHERE l.tenant_id = i.tenant_id AND l.item_id = i.id AND po.status <> 'cancelled'
      ORDER BY po.created_at DESC, l.position DESC LIMIT 1
    ) lp ON true
    WHERE i.tenant_id = ${tenantId} AND i.active = true AND i.min_stock > 0 AND i.item_type <> 'finished_good'
    ORDER BY i.name
    LIMIT 2000`;
  return rows.map((r: any) => ({
    itemId: r.id,
    sku: r.sku,
    name: r.name,
    uom: r.stock_uom,
    minStock: Number(r.min_stock),
    onHand: Number(r.on_hand),
    reserved: Number(r.reserved),
    incoming: Number(r.incoming),
    drafted: Number(r.drafted),
    last: r.warehouse_id
      ? {
          supplierId: r.supplier_id,
          supplierName: r.supplier_name,
          supplierActive: Boolean(r.supplier_active),
          warehouseId: r.warehouse_id,
          unitPrice: r.unit_price === null ? null : Number(r.unit_price),
          currency: r.currency,
          lengthMm: Number(r.metadata?.lengthMm) || null,
          color: typeof r.metadata?.color === 'string' && r.metadata.color.trim() ? r.metadata.color.trim() : null,
          orderNumber: r.purchase_order_number,
        }
      : null,
  }));
}

/** The items under their minimum, for the stock screen's warning. */
export async function stockThresholdWarnings(actor: WorkOrderActor) {
  if (!['owner', 'admin', 'office', 'accountant'].includes(actor.role)) throw new WorkOrderApiError('Stok eşiklerine erişim yok', 403);
  const rows = await thresholdRows(sql, actor.tenantId);
  return rows
    .map((row) => ({ row, status: thresholdStatus(row) }))
    .filter(({ status }) => status.state !== 'ok')
    .map(({ row, status }) => ({
      itemId: row.itemId,
      sku: row.sku,
      name: row.name,
      uom: row.uom,
      minStock: row.minStock,
      available: available(row),
      incoming: row.incoming,
      drafted: row.drafted,
      state: status.state,
      shortfall: 'shortfall' in status ? status.shortfall : 0,
      reason: status.state === 'unknown' ? status.reason : null,
      supplierName: status.state === 'draftable' ? status.supplierName : null,
    }));
}
