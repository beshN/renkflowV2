/**
 * RenkFlow AI Tools
 * Yapılandırılmış araç fonksiyonları — AI bu fonksiyonlarla DB'ye güvenli erişir
 * Hiçbir tool doğrudan SQL üretmez veya kritik işlem başlatmaz
 */

import 'server-only';
import { sql } from '@/lib/db';

export interface ToolContext {
  tenantId: string;
  userId: string;
}

// ============================================
// findOrder — Sipariş arama ve detay
// ============================================

export async function findOrder(ctx: ToolContext, query: string) {
  const rows = await sql`
    SELECT
      o.id,
      o.order_number,
      o.customer_name,
      o.product_name,
      o.status,
      o.priority,
      o.total_amount,
      o.currency,
      o.delivery_date,
      o.payment_status,
      o.shipment_status,
      o.created_at,
      o.updated_at,
      c.company_name AS customer_company
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
    WHERE o.tenant_id = ${ctx.tenantId}
      AND (
        o.order_number ILIKE ${'%' + query + '%'}
        OR o.customer_name ILIKE ${'%' + query + '%'}
        OR o.product_name ILIKE ${'%' + query + '%'}
      )
    ORDER BY o.created_at DESC
    LIMIT 10
  `;
  return rows;
}

// ============================================
// searchCustomer — Müşteri arama
// ============================================

export async function searchCustomer(ctx: ToolContext, query: string) {
  const rows = await sql`
    SELECT
      c.id,
      c.full_name,
      c.company_name,
      c.phone,
      c.email,
      COUNT(o.id) AS order_count,
      SUM(o.total_amount) AS total_revenue
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.tenant_id = c.tenant_id
    WHERE c.tenant_id = ${ctx.tenantId}
      AND c.is_active = true
      AND (
        c.full_name ILIKE ${'%' + query + '%'}
        OR c.company_name ILIKE ${'%' + query + '%'}
        OR c.phone ILIKE ${'%' + query + '%'}
      )
    GROUP BY c.id
    ORDER BY total_revenue DESC NULLS LAST
    LIMIT 10
  `;
  return rows;
}

// ============================================
// getInventory — Stok seviyeleri
// ============================================

export async function getInventory(ctx: ToolContext, filter?: { itemName?: string; lowStockOnly?: boolean }) {
  const rows = await sql`
    SELECT
      i.id,
      i.sku,
      i.name,
      i.item_type,
      i.stock_uom,
      i.min_stock,
      COALESCE(b.on_hand_qty, 0) AS on_hand_qty,
      COALESCE(r.reserved_qty, 0) AS reserved_qty,
      COALESCE(b.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0) AS available_qty,
      w.name AS warehouse_name
    FROM inventory_items i
    LEFT JOIN stock_balances b ON b.item_id = i.id AND b.tenant_id = i.tenant_id
    LEFT JOIN warehouses w ON w.id = b.warehouse_id AND w.tenant_id = i.tenant_id
    LEFT JOIN LATERAL (
      SELECT SUM(rl.reserved_qty - rl.consumed_qty - rl.released_qty) AS reserved_qty
      FROM stock_reservation_lines rl
      JOIN stock_reservations rh ON rh.id = rl.reservation_id
      WHERE rl.tenant_id = i.tenant_id
        AND rl.item_id = i.id
        AND rh.status = 'active'
    ) r ON true
    WHERE i.tenant_id = ${ctx.tenantId}
      AND i.active = true
      ${filter?.itemName ? sql`AND i.name ILIKE ${'%' + filter.itemName + '%'}` : sql``}
      ${filter?.lowStockOnly ? sql`AND COALESCE(b.on_hand_qty, 0) <= i.min_stock` : sql``}
    ORDER BY i.name
    LIMIT 50
  `;
  return rows;
}

// ============================================
// getCriticalStock — Kritik stok uyarıları
// ============================================

export async function getCriticalStock(ctx: ToolContext) {
  const rows = await sql`
    SELECT
      i.sku,
      i.name,
      i.min_stock,
      i.stock_uom,
      COALESCE(b.on_hand_qty, 0) AS on_hand_qty,
      COALESCE(b.on_hand_qty, 0) - i.min_stock AS deficit
    FROM inventory_items i
    LEFT JOIN stock_balances b ON b.item_id = i.id AND b.tenant_id = i.tenant_id
    WHERE i.tenant_id = ${ctx.tenantId}
      AND i.active = true
      AND COALESCE(b.on_hand_qty, 0) <= i.min_stock
    ORDER BY deficit ASC
    LIMIT 20
  `;
  return rows;
}

// ============================================
// getProductionStatus — Üretim durumu
// ============================================

export async function getProductionStatus(ctx: ToolContext, workOrderId?: string) {
  if (workOrderId) {
    const rows = await sql`
      SELECT
        wo.id,
        wo.title,
        wo.status,
        wo.priority,
        wo.planned_qty,
        wo.produced_qty,
        wo.due_at,
        wo.reservation_status,
        o.order_number,
        o.customer_name,
        u.name AS assigned_to_name
      FROM work_orders wo
      LEFT JOIN orders o ON o.id = wo.order_id AND o.tenant_id = wo.tenant_id
      LEFT JOIN users u ON u.id = wo.assigned_to
      WHERE wo.tenant_id = ${ctx.tenantId}
        AND wo.id = ${workOrderId}
      LIMIT 1
    `;
    return rows[0] || null;
  }

  // Genel üretim özeti
  const rows = await sql`
    SELECT
      wo.id,
      wo.title,
      wo.status,
      wo.priority,
      wo.planned_qty,
      wo.produced_qty,
      wo.due_at,
      o.order_number,
      o.customer_name,
      u.name AS assigned_to_name
    FROM work_orders wo
    LEFT JOIN orders o ON o.id = wo.order_id AND o.tenant_id = wo.tenant_id
    LEFT JOIN users u ON u.id = wo.assigned_to
    WHERE wo.tenant_id = ${ctx.tenantId}
      AND wo.status NOT IN ('done', 'cancelled')
    ORDER BY
      CASE wo.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      wo.due_at ASC NULLS LAST
    LIMIT 20
  `;
  return rows;
}

// ============================================
// getPurchasingNeeds — Satın alma ihtiyaçları
// ============================================

export async function getPurchasingNeeds(ctx: ToolContext) {
  // Açık material requests
  const requests = await sql`
    SELECT
      mr.id,
      mr.request_number,
      mr.status,
      mr.required_by,
      COUNT(mrl.id) AS line_count
    FROM material_requests mr
    LEFT JOIN material_request_lines mrl ON mrl.material_request_id = mr.id
    WHERE mr.tenant_id = ${ctx.tenantId}
      AND mr.status IN ('draft', 'submitted')
    GROUP BY mr.id
    ORDER BY mr.required_by ASC NULLS LAST
    LIMIT 10
  `;

  // Kritik stoktan satın alma gerektiren itemlar
  const critical = await getCriticalStock(ctx);

  return { openRequests: requests, criticalItems: critical };
}

// ============================================
// getScrapStatistics — Hurda istatistikleri
// ============================================

export async function getScrapStatistics(ctx: ToolContext, days = 30) {
  const rows = await sql`
    SELECT
      i.name AS source_item_name,
      COUNT(sr.id) AS scrap_count,
      SUM(sr.length_m) AS total_length_m,
      SUM(sr.weight_kg) AS total_weight_kg,
      AVG(sr.weight_per_meter_kg) AS avg_weight_per_meter
    FROM scrap_records sr
    JOIN inventory_items i ON i.id = sr.source_item_id AND i.tenant_id = ${ctx.tenantId}
    WHERE sr.tenant_id = ${ctx.tenantId}
      AND sr.created_at >= now() - (${days} || ' days')::interval
    GROUP BY sr.source_item_id, i.name
    ORDER BY total_weight_kg DESC
    LIMIT 10
  `;
  return rows;
}

// ============================================
// getWorkOrders — İş emri listesi
// ============================================

export async function getWorkOrders(ctx: ToolContext, filters?: {
  status?: string;
  assignedToUserId?: string;
  overdueOnly?: boolean;
}) {
  const rows = await sql`
    SELECT
      wo.id,
      wo.title,
      wo.category,
      wo.status,
      wo.priority,
      wo.due_at,
      wo.planned_qty,
      wo.produced_qty,
      o.order_number,
      o.customer_name,
      u.name AS assigned_to_name
    FROM work_orders wo
    LEFT JOIN orders o ON o.id = wo.order_id AND o.tenant_id = wo.tenant_id
    LEFT JOIN users u ON u.id = wo.assigned_to
    WHERE wo.tenant_id = ${ctx.tenantId}
      ${filters?.status ? sql`AND wo.status = ${filters.status}` : sql``}
      ${filters?.assignedToUserId ? sql`AND wo.assigned_to = ${filters.assignedToUserId}` : sql``}
      ${filters?.overdueOnly ? sql`AND wo.due_at < now() AND wo.status NOT IN ('done', 'cancelled')` : sql``}
    ORDER BY wo.due_at ASC NULLS LAST, wo.created_at DESC
    LIMIT 25
  `;
  return rows;
}

// ============================================
// getShipmentStatus — Sevkiyat durumu
// ============================================

export async function getShipmentStatus(ctx: ToolContext, query?: string) {
  const rows = await sql`
    SELECT
      s.id,
      s.shipment_number,
      s.customer_name,
      s.status,
      s.carrier,
      s.tracking_number,
      s.scheduled_date,
      s.actual_date,
      COUNT(si.id) AS item_count
    FROM shipments s
    LEFT JOIN shipment_items si ON si.shipment_id = s.id AND si.tenant_id = s.tenant_id
    WHERE s.tenant_id = ${ctx.tenantId}
      ${query ? sql`AND (s.shipment_number ILIKE ${'%' + query + '%'} OR s.customer_name ILIKE ${'%' + query + '%'})` : sql``}
    GROUP BY s.id
    ORDER BY s.scheduled_date DESC NULLS LAST
    LIMIT 15
  `;
  return rows;
}

// ============================================
// getDashboardSummary — Dashboard özeti
// ============================================

export async function getDashboardSummary(ctx: ToolContext) {
  const [orders, production, stock, overdue] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled', 'delivered')) AS active_count,
        COUNT(*) FILTER (WHERE status IN ('new', 'pending', 'pending_approval')) AS pending_count,
        COUNT(*) FILTER (WHERE status IN ('ready_for_shipment', 'ready')) AS ready_for_shipment,
        COUNT(*) FILTER (WHERE delivery_date = CURRENT_DATE) AS today_deliveries
      FROM orders
      WHERE tenant_id = ${ctx.tenantId}
        AND created_at >= now() - interval '90 days'
    `,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'open') AS open,
        COUNT(*) FILTER (WHERE status = 'blocked') AS blocked
      FROM work_orders
      WHERE tenant_id = ${ctx.tenantId}
    `,
    sql`
      SELECT COUNT(*) AS critical_count
      FROM inventory_items i
      LEFT JOIN stock_balances b ON b.item_id = i.id AND b.tenant_id = i.tenant_id
      WHERE i.tenant_id = ${ctx.tenantId}
        AND i.active = true
        AND COALESCE(b.on_hand_qty, 0) <= i.min_stock
    `,
    sql`
      SELECT COUNT(*) AS overdue_count
      FROM orders
      WHERE tenant_id = ${ctx.tenantId}
        AND delivery_date < CURRENT_DATE
        AND status NOT IN ('completed', 'cancelled', 'delivered', 'shipped')
    `,
  ]);

  return {
    orders: orders[0],
    production: production[0],
    criticalStock: stock[0],
    overdue: overdue[0],
  };
}

// ============================================
// Tool registry — AI tarafından çağrılacak araçlar
// ============================================

export const AI_TOOLS = {
  findOrder,
  searchCustomer,
  getInventory,
  getCriticalStock,
  getProductionStatus,
  getPurchasingNeeds,
  getScrapStatistics,
  getWorkOrders,
  getShipmentStatus,
  getDashboardSummary,
} as const;

export type AIToolName = keyof typeof AI_TOOLS;
