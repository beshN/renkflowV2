import 'server-only';

import { columnExists } from '@/lib/db/schema-guard';
import { sql } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { available, thresholdStatus, type ThresholdRow } from './reorder';

/** Roles that may create a purchase order, and so decide the purchase draft suggestion. */
export const PURCHASE_DRAFT_ROLES = ['owner', 'admin', 'office'] as const;

/**
 * Every active item with a minimum stock: usable stock, reservations, orders still to arrive and in
 * draft, and its last sent purchase line. Each table is summed once per item, not per row.
 */
export async function thresholdRows(db: any, tenantId: string): Promise<ThresholdRow[]> {
  const withPolicy = await columnExists('inventory_items', 'max_stock');
  const rows = await db`
    WITH items AS (
      SELECT id, sku, name, stock_uom, min_stock,
        ${withPolicy ? db`max_stock, lead_time_days, order_multiple` : db`NULL::numeric AS max_stock, NULL::int AS lead_time_days, NULL::numeric AS order_multiple`}
      FROM inventory_items
      WHERE tenant_id = ${tenantId} AND active = true AND min_stock > 0 AND item_type <> 'finished_good'
    ), usable AS (
      SELECT id FROM warehouses WHERE tenant_id = ${tenantId} AND warehouse_type IN ('RAW', 'REUSABLE_REMNANTS')
    ), stock AS (
      SELECT b.item_id, sum(b.on_hand_qty) AS qty FROM stock_balances b JOIN items i ON i.id = b.item_id
      WHERE b.tenant_id = ${tenantId} AND b.warehouse_id IN (SELECT id FROM usable) GROUP BY b.item_id
    ), reserved AS (
      SELECT rl.item_id, sum(rl.reserved_qty - rl.consumed_qty - rl.released_qty) AS qty
      FROM stock_reservation_lines rl JOIN stock_reservations rh ON rh.id = rl.reservation_id JOIN items i ON i.id = rl.item_id
      WHERE rl.tenant_id = ${tenantId} AND rh.status = 'active' AND rl.warehouse_id IN (SELECT id FROM usable) GROUP BY rl.item_id
    ), rejected AS (
      -- Rejected on receipt never arrives, although the order line stays open.
      SELECT gl.purchase_order_line_id AS line_id, sum(gl.rejected_qty) AS qty
      FROM goods_receipt_lines gl JOIN goods_receipts gr ON gr.id = gl.goods_receipt_id AND gr.tenant_id = gl.tenant_id
      WHERE gl.tenant_id = ${tenantId} AND gr.status = 'submitted' AND gl.rejected_qty > 0 GROUP BY gl.purchase_order_line_id
    ), ordered AS (
      SELECT l.item_id,
        sum(CASE WHEN po.status IN ('submitted', 'partially_received') THEN greatest(l.ordered_qty - l.received_qty - coalesce(r.qty, 0), 0) ELSE 0 END) AS incoming,
        sum(CASE WHEN po.status = 'draft' THEN l.ordered_qty ELSE 0 END) AS drafted
      FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id
      JOIN items i ON i.id = l.item_id LEFT JOIN rejected r ON r.line_id = l.id
      WHERE l.tenant_id = ${tenantId} AND po.status IN ('draft', 'submitted', 'partially_received') GROUP BY l.item_id
    ), usage AS (
      -- Average daily use over 90 days: material issued out of usable warehouses (submitted entries).
      SELECT l.item_id, -sum(l.quantity_delta) / 90.0 AS per_day
      FROM stock_entry_lines l JOIN stock_entries e ON e.id = l.stock_entry_id AND e.tenant_id = l.tenant_id JOIN items i ON i.id = l.item_id
      WHERE l.tenant_id = ${tenantId} AND e.status = 'submitted' AND e.entry_type IN ('MATERIAL_ISSUE', 'MANUFACTURE') AND l.quantity_delta < 0
        AND l.warehouse_id IN (SELECT id FROM usable) AND e.submitted_at >= now() - interval '90 days'
      GROUP BY l.item_id
    ), last_purchase AS (
      -- The last order actually sent; drafts (including ones this suggestion made) are not a purchase.
      SELECT DISTINCT ON (l.item_id) l.item_id, po.supplier_id, s.name AS supplier_name, coalesce(s.is_active, false) AS supplier_active,
        l.warehouse_id, (w.active AND w.warehouse_type = 'RAW') AS warehouse_ok, l.unit_price, coalesce(po.currency, 'TRY') AS currency, l.metadata, po.purchase_order_number
      FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id
      JOIN items i ON i.id = l.item_id
      LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.tenant_id = po.tenant_id
      LEFT JOIN warehouses w ON w.id = l.warehouse_id AND w.tenant_id = l.tenant_id
      WHERE l.tenant_id = ${tenantId} AND po.status IN ('submitted', 'partially_received', 'received')
      ORDER BY l.item_id, po.created_at DESC, l.position DESC
    )
    SELECT i.*, coalesce(us.per_day, 0) AS per_day, coalesce(st.qty, 0) AS on_hand, coalesce(rs.qty, 0) AS reserved, coalesce(o.incoming, 0) AS incoming, coalesce(o.drafted, 0) AS drafted,
      lp.supplier_id, lp.supplier_name, lp.supplier_active, lp.warehouse_id, lp.warehouse_ok, lp.unit_price, lp.currency, lp.metadata, lp.purchase_order_number
    FROM items i LEFT JOIN stock st ON st.item_id = i.id LEFT JOIN reserved rs ON rs.item_id = i.id
    LEFT JOIN ordered o ON o.item_id = i.id LEFT JOIN last_purchase lp ON lp.item_id = i.id LEFT JOIN usage us ON us.item_id = i.id
    ORDER BY i.name`;
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
    policy: {
      maxStock: r.max_stock == null ? null : Number(r.max_stock),
      leadTimeDays: r.lead_time_days == null ? null : Number(r.lead_time_days),
      orderMultiple: r.order_multiple == null ? null : Number(r.order_multiple),
      dailyUsage: Math.max(0, Math.round(Number(r.per_day) * 1000) / 1000),
    },
    last: r.warehouse_id
      ? {
          supplierId: r.supplier_id,
          supplierName: r.supplier_name,
          supplierActive: Boolean(r.supplier_active),
          warehouseId: r.warehouse_id,
          warehouseUsable: Boolean(r.warehouse_ok),
          unitPrice: r.unit_price === null ? null : Number(r.unit_price),
          currency: r.currency,
          lengthMm: r.metadata?.lengthMm == null ? null : Number(r.metadata.lengthMm),
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
  const items = rows.flatMap((row) => {
    const status = thresholdStatus(row);
    if (status.state === 'ok') return [];
    return [{
      itemId: row.itemId,
      sku: row.sku,
      name: row.name,
      uom: row.uom,
      minStock: row.minStock,
      available: available(row),
      incoming: row.incoming,
      drafted: row.drafted,
      state: status.state,
      shortfall: status.shortfall,
      reason: status.state === 'unknown' ? status.reason : null,
      supplierName: status.state === 'draftable' ? status.supplierName : null,
    }];
  });
  return { items, canDraft: (PURCHASE_DRAFT_ROLES as readonly string[]).includes(actor.role) };
}
