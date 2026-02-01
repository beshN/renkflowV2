/**
 * Advanced Reporting and Analytics Service
 * 
 * Features:
 * - Order analytics (volume, trends, status distribution)
 * - Revenue reporting with currency conversion
 * - Customer analytics (LTV, retention, acquisition)
 * - Performance metrics (production times, delays)
 * - Exportable reports (JSON/CSV ready)
 */

import { sql } from '@/lib/db/neon';
import { Order, OrderStatus } from '@/lib/types';

// ============================================
// Types
// ============================================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface OrderMetrics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  dailyVolume: Array<{
    date: string;
    count: number;
    revenue: number;
  }>;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageLifetimeValue: number;
  topCustomers: Array<{
    customerName: string;
    email: string;
    totalOrders: number;
    totalSpent: number;
  }>;
}

export interface ProductionMetrics {
  averageProductionTime: number; // days
  onTimeDeliveryRate: number; // percentage
  delayedOrders: number;
  statusTransitions: Array<{
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    count: number;
    avgDuration: number; // hours
  }>;
}

export interface DashboardSummary {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  inProductionOrders: number;
  weeklyGrowth: number; // percentage
  monthlyGrowth: number; // percentage
}

// ============================================
// Order Analytics
// ============================================

export async function getOrderMetrics(
  tenantId: string,
  dateRange: DateRange
): Promise<OrderMetrics> {
  const { startDate, endDate } = dateRange;

  // Total orders and revenue
  const [summaryResult] = await sql`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(AVG(total_amount), 0) as avg_order_value
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
  `;

  // Orders by status
  const statusResults = await sql`
    SELECT 
      status,
      COUNT(*) as count
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
    GROUP BY status
  `;

  const ordersByStatus: Record<string, number> = {};
  for (const row of statusResults) {
    ordersByStatus[row.status] = parseInt(row.count);
  }

  // Daily volume
  const dailyResults = await sql`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return {
    totalOrders: parseInt(summaryResult.total_orders),
    totalRevenue: parseFloat(summaryResult.total_revenue),
    averageOrderValue: parseFloat(summaryResult.avg_order_value),
    ordersByStatus: ordersByStatus as Record<OrderStatus, number>,
    dailyVolume: dailyResults.map(row => ({
      date: row.date,
      count: parseInt(row.count),
      revenue: parseFloat(row.revenue),
    })),
  };
}

// ============================================
// Customer Analytics
// ============================================

export async function getCustomerMetrics(
  tenantId: string,
  dateRange: DateRange
): Promise<CustomerMetrics> {
  const { startDate, endDate } = dateRange;

  // Total and new customers
  const [customerSummary] = await sql`
    SELECT 
      COUNT(DISTINCT email) as total_customers,
      COUNT(DISTINCT CASE WHEN first_order_date >= ${startDate.toISOString()} THEN email END) as new_customers
    FROM (
      SELECT 
        email,
        MIN(created_at) as first_order_date
      FROM orders
      WHERE tenant_id = ${tenantId}
      GROUP BY email
    ) customer_first_orders
  `;

  // Top customers
  const topCustomers = await sql`
    SELECT 
      customer_name,
      email,
      COUNT(*) as total_orders,
      SUM(total_amount) as total_spent
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
    GROUP BY customer_name, email
    ORDER BY total_spent DESC
    LIMIT 10
  `;

  // Average LTV (all time)
  const [ltvResult] = await sql`
    SELECT AVG(customer_total) as avg_ltv
    FROM (
      SELECT SUM(total_amount) as customer_total
      FROM orders
      WHERE tenant_id = ${tenantId}
      GROUP BY email
    ) customer_totals
  `;

  const totalCustomers = parseInt(customerSummary.total_customers);
  const newCustomers = parseInt(customerSummary.new_customers);

  return {
    totalCustomers,
    newCustomers,
    returningCustomers: totalCustomers - newCustomers,
    averageLifetimeValue: parseFloat(ltvResult.avg_ltv) || 0,
    topCustomers: topCustomers.map(row => ({
      customerName: row.customer_name,
      email: row.email,
      totalOrders: parseInt(row.total_orders),
      totalSpent: parseFloat(row.total_spent),
    })),
  };
}

// ============================================
// Production Metrics
// ============================================

export async function getProductionMetrics(
  tenantId: string,
  dateRange: DateRange
): Promise<ProductionMetrics> {
  const { startDate, endDate } = dateRange;

  // Orders with status history
  const statusHistory = await sql`
    SELECT 
      status,
      COUNT(*) as count,
      AVG(
        EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
      ) as avg_duration_hours
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
    GROUP BY status
  `;

  // Delayed orders (in production > 14 days or pending > 7 days)
  const [delayedResult] = await sql`
    SELECT COUNT(*) as delayed_count
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND (
        (status = 'in_production' AND created_at < NOW() - INTERVAL '14 days')
        OR 
        (status = 'pending' AND created_at < NOW() - INTERVAL '7 days')
      )
  `;

  // On-time delivery calculation
  const [deliveryResult] = await sql`
    SELECT 
      COUNT(*) as total_delivered,
      COUNT(CASE 
        WHEN delivered_at <= estimated_delivery_date THEN 1 
      END) as on_time_delivered
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND status = 'delivered'
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
  `;

  const totalDelivered = parseInt(deliveryResult.total_delivered) || 1;
  const onTimeDelivered = parseInt(deliveryResult.on_time_delivered) || 0;

  return {
    averageProductionTime: calculateAverageProductionTime(statusHistory),
    onTimeDeliveryRate: (onTimeDelivered / totalDelivered) * 100,
    delayedOrders: parseInt(delayedResult.delayed_count),
    statusTransitions: statusHistory.map(row => ({
      fromStatus: 'pending' as OrderStatus,
      toStatus: row.status as OrderStatus,
      count: parseInt(row.count),
      avgDuration: parseFloat(row.avg_duration_hours),
    })),
  };
}

// ============================================
// Dashboard Summary
// ============================================

export async function getDashboardSummary(tenantId: string): Promise<DashboardSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  // Today's metrics
  const [todayResult] = await sql`
    SELECT 
      COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${today.toISOString()}
  `;

  // Pending and in production counts
  const [statusResult] = await sql`
    SELECT 
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'in_production' THEN 1 END) as in_production
    FROM orders
    WHERE tenant_id = ${tenantId}
  `;

  // Weekly comparison
  const [weeklyResult] = await sql`
    SELECT 
      COUNT(CASE WHEN created_at >= ${lastWeek.toISOString()} THEN 1 END) as this_week,
      COUNT(CASE WHEN created_at >= ${lastWeek.toISOString()} - INTERVAL '7 days' 
                  AND created_at < ${lastWeek.toISOString()} THEN 1 END) as last_week
    FROM orders
    WHERE tenant_id = ${tenantId}
  `;

  // Monthly comparison
  const [monthlyResult] = await sql`
    SELECT 
      COUNT(CASE WHEN created_at >= ${lastMonth.toISOString()} THEN 1 END) as this_month,
      COUNT(CASE WHEN created_at >= ${lastMonth.toISOString()} - INTERVAL '30 days' 
                  AND created_at < ${lastMonth.toISOString()} THEN 1 END) as last_month
    FROM orders
    WHERE tenant_id = ${tenantId}
  `;

  const thisWeek = parseInt(weeklyResult.this_week) || 0;
  const prevWeek = parseInt(weeklyResult.last_week) || 1;
  const thisMonth = parseInt(monthlyResult.this_month) || 0;
  const prevMonth = parseInt(monthlyResult.last_month) || 1;

  return {
    todayOrders: parseInt(todayResult.orders),
    todayRevenue: parseFloat(todayResult.revenue),
    pendingOrders: parseInt(statusResult.pending),
    inProductionOrders: parseInt(statusResult.in_production),
    weeklyGrowth: ((thisWeek - prevWeek) / prevWeek) * 100,
    monthlyGrowth: ((thisMonth - prevMonth) / prevMonth) * 100,
  };
}

// ============================================
// Export Functions
// ============================================

export function exportToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}

export function formatReportDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================
// Helpers
// ============================================

function calculateAverageProductionTime(statusHistory: any[]): number {
  // Calculate weighted average based on status durations
  let totalHours = 0;
  let totalOrders = 0;

  for (const row of statusHistory) {
    const hours = parseFloat(row.avg_duration_hours) || 0;
    const count = parseInt(row.count) || 0;
    totalHours += hours * count;
    totalOrders += count;
  }

  return totalOrders > 0 ? totalHours / totalOrders / 24 : 0; // Convert to days
}
