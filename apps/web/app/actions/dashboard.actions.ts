'use server';

import { unstable_cache } from 'next/cache';
import { sql, sqlQuery } from '@/lib/db';
import { withServerActionTiming } from '@/lib/utils/metrics';
import { getServerUserContext } from '@/lib/auth/serverAuth';
import { hasPermission, type UserRole } from '@/lib/auth/permissions';

export interface DashboardOrdersWidget {
  authorized: boolean;
  createdToday: number;
  createdThisWeek: number;
  byStatus: {
    pending: number;
    inProduction: number;
    delivered: number;
  };
  overdueDeliveries: number;
}

export interface DashboardFinanceWidget {
  authorized: boolean;
  paymentsCollectedThisMonth: number;
  outstandingReceivables: number;
  payrollCostThisMonth: number;
}

export interface DashboardInventoryWidget {
  authorized: boolean;
  lowStockCount: number;
  topLowStock: Array<{
    itemId: string;
    sku: string;
    name: string;
    currentStock: number;
    minStock: number;
  }>;
}

export interface DashboardActivityWidget {
  authorized: boolean;
  events: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    userEmail: string | null;
    createdAt: string;
  }>;
}

export interface SuperDashboardData {
  orders: DashboardOrdersWidget;
  finance: DashboardFinanceWidget;
}

const DASHBOARD_REVALIDATE_SECONDS = 45;

async function queryOrdersWidget(tenantId: string): Promise<DashboardOrdersWidget> {
  const result = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as created_today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW())) as created_this_week,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'in_production') as in_production,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
      COUNT(*) FILTER (WHERE delivery_date < CURRENT_DATE AND status <> 'delivered') as overdue_deliveries
    FROM orders
    WHERE tenant_id = ${tenantId}
  `;

  const rows = result as Array<Record<string, string | number>>;
  const row = rows[0] || {};

  return {
    authorized: true,
    createdToday: Number(row.created_today || 0),
    createdThisWeek: Number(row.created_this_week || 0),
    byStatus: {
      pending: Number(row.pending || 0),
      inProduction: Number(row.in_production || 0),
      delivered: Number(row.delivered || 0),
    },
    overdueDeliveries: Number(row.overdue_deliveries || 0),
  };
}

async function queryFinanceWidget(tenantId: string): Promise<DashboardFinanceWidget> {
  const result = await sql`
    WITH month_bounds AS (
      SELECT
        date_trunc('month', NOW()) as month_start,
        date_trunc('month', NOW()) + interval '1 month' as month_end
    ),
    payments_month AS (
      SELECT COALESCE(SUM(p.amount), 0) as payments_collected_this_month
      FROM payments p, month_bounds b
      WHERE p.tenant_id = ${tenantId}
        AND p.paid_at >= b.month_start
        AND p.paid_at < b.month_end
    ),
    order_totals AS (
      SELECT COALESCE(SUM(o.total_amount), 0) as total_order_amount
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
    ),
    paid_totals AS (
      SELECT COALESCE(SUM(p.amount), 0) as total_paid
      FROM payments p
      WHERE p.tenant_id = ${tenantId}
    ),
    payroll_month AS (
      SELECT COALESCE(SUM(l.amount), 0) as payroll_cost_this_month
      FROM employee_ledger_entries l, month_bounds b
      WHERE l.tenant_id = ${tenantId}
        AND l.entry_date >= b.month_start::date
        AND l.entry_date < b.month_end::date
        AND l.kind IN ('salary', 'payment')
    )
    SELECT
      pm.payments_collected_this_month,
      GREATEST(ot.total_order_amount - pt.total_paid, 0) as outstanding_receivables,
      py.payroll_cost_this_month
    FROM payments_month pm
    CROSS JOIN order_totals ot
    CROSS JOIN paid_totals pt
    CROSS JOIN payroll_month py
  `;

  const rows = result as Array<Record<string, string | number>>;
  const row = rows[0] || {};

  return {
    authorized: true,
    paymentsCollectedThisMonth: Number(row.payments_collected_this_month || 0),
    outstandingReceivables: Number(row.outstanding_receivables || 0),
    payrollCostThisMonth: Number(row.payroll_cost_this_month || 0),
  };
}

async function queryInventoryWidget(tenantId: string): Promise<DashboardInventoryWidget> {
  const result = await sql`
    WITH inventory_data AS (
      SELECT
        i.id,
        i.sku,
        i.name,
        i.min_stock,
        COALESCE(s.current_stock, 0) as current_stock
      FROM inventory_items i
      LEFT JOIN inventory_item_stocks s
        ON s.item_id = i.id
        AND s.tenant_id = i.tenant_id
      WHERE i.tenant_id = ${tenantId}
        AND i.active = true
    ),
    low_stock AS (
      SELECT *
      FROM inventory_data
      WHERE current_stock < min_stock
      ORDER BY (min_stock - current_stock) DESC, name ASC
      LIMIT 5
    )
    SELECT
      (SELECT COUNT(*) FROM inventory_data WHERE current_stock < min_stock) as low_stock_count,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'itemId', id,
              'sku', sku,
              'name', name,
              'currentStock', current_stock,
              'minStock', min_stock
            )
          )
          FROM low_stock
        ),
        '[]'::json
      ) as top_low_stock
  `;

  const rows = result as Array<Record<string, unknown>>;
  const row = rows[0] || {};

  return {
    authorized: true,
    lowStockCount: Number(row.low_stock_count || 0),
    topLowStock: Array.isArray(row.top_low_stock)
      ? (row.top_low_stock as Array<{
          itemId: string;
          sku: string;
          name: string;
          currentStock: number;
          minStock: number;
        }>).map((entry) => ({
          ...entry,
          currentStock: Number(entry.currentStock || 0),
          minStock: Number(entry.minStock || 0),
        }))
      : [],
  };
}

async function getAuditTimestampColumn(): Promise<'created_at' | 'timestamp'> {
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name IN ('created_at', 'timestamp')
  `;

  const rows = result as Array<{ column_name: string }>;
  return rows.some((row) => row.column_name === 'created_at') ? 'created_at' : 'timestamp';
}

async function queryActivityWidget(tenantId: string): Promise<DashboardActivityWidget> {
  const timeColumn = await getAuditTimestampColumn();

  const query = `
    SELECT
      id,
      action,
      entity_type,
      entity_id,
      user_email,
      ${timeColumn} as created_at
    FROM audit_logs
    WHERE tenant_id = $1
      AND (
        action LIKE 'payment.%'
        OR action LIKE 'document.%'
        OR action LIKE 'employee.%'
        OR action LIKE 'ledger.%'
        OR action LIKE 'order.qr%'
      )
    ORDER BY ${timeColumn} DESC
    LIMIT 10
  `;

  const rows = await sqlQuery(query, [tenantId]);

  return {
    authorized: true,
    events: rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: row.entity_id ? String(row.entity_id) : null,
      userEmail: row.user_email ? String(row.user_email) : null,
      createdAt: String(row.created_at),
    })),
  };
}

const getCachedCoreDashboard = unstable_cache(
  async (tenantId: string, role: UserRole): Promise<SuperDashboardData> => {
    const canViewOrders = hasPermission(role, 'orders.view');
    const canViewFinance = hasPermission(role, 'finance.view');

    const [orders, finance] = await Promise.all([
      canViewOrders
        ? queryOrdersWidget(tenantId)
        : Promise.resolve<DashboardOrdersWidget>({
            authorized: false,
            createdToday: 0,
            createdThisWeek: 0,
            byStatus: { pending: 0, inProduction: 0, delivered: 0 },
            overdueDeliveries: 0,
          }),
      canViewFinance
        ? queryFinanceWidget(tenantId)
        : Promise.resolve<DashboardFinanceWidget>({
            authorized: false,
            paymentsCollectedThisMonth: 0,
            outstandingReceivables: 0,
            payrollCostThisMonth: 0,
          }),
    ]);

    return { orders, finance };
  },
  ['super-dashboard-core'],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS }
);

const getCachedInventoryWidget = unstable_cache(
  async (tenantId: string, role: UserRole): Promise<DashboardInventoryWidget> => {
    if (!hasPermission(role, 'inventory.view')) {
      return {
        authorized: false,
        lowStockCount: 0,
        topLowStock: [],
      };
    }

    return queryInventoryWidget(tenantId);
  },
  ['super-dashboard-inventory'],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS }
);

const getCachedActivityWidget = unstable_cache(
  async (tenantId: string, role: UserRole): Promise<DashboardActivityWidget> => {
    const canViewActivity = hasPermission(role, 'finance.view') || hasPermission(role, 'orders.qr.manage');

    if (!canViewActivity) {
      return {
        authorized: false,
        events: [],
      };
    }

    return queryActivityWidget(tenantId);
  },
  ['super-dashboard-activity'],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS }
);

export async function getSuperDashboardCoreData(): Promise<SuperDashboardData> {
  return withServerActionTiming('dashboard.getSuperDashboardCoreData', async () => {
    const context = await getServerUserContext();
    return getCachedCoreDashboard(context.tenantId, context.role);
  }, { slowMs: 400 });
}

export async function getSuperDashboardInventoryWidget(): Promise<DashboardInventoryWidget> {
  return withServerActionTiming('dashboard.getSuperDashboardInventoryWidget', async () => {
    const context = await getServerUserContext();
    return getCachedInventoryWidget(context.tenantId, context.role);
  }, { slowMs: 400 });
}

export async function getSuperDashboardActivityWidget(): Promise<DashboardActivityWidget> {
  return withServerActionTiming('dashboard.getSuperDashboardActivityWidget', async () => {
    const context = await getServerUserContext();
    return getCachedActivityWidget(context.tenantId, context.role);
  }, { slowMs: 400 });
}
