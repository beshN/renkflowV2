'use server';

/**
 * Finance Overview Actions
 * Dashboard statistics and aggregations
 */

import { sql } from '@/lib/db';
import {
  getServerUserContext,
  requirePermission,
} from '@/lib/auth/serverAuth';
import { AuditLogService } from '@/lib/services/auditLog.service';

// ============================================
// Types
// ============================================

export interface FinanceOverviewData {
  // Revenue & Payments
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  thisMonthPayments: number;
  lastMonthPayments: number;
  outstandingReceivables: number;
  collectionRate: number;
  
  // Payroll
  thisMonthPayroll: number;
  lastMonthPayroll: number;
  employeeCount: number;
  activeEmployeeCount: number;
  
  // Orders
  orderCount: number;
  paidOrderCount: number;
  partialPaidOrderCount: number;
  unpaidOrderCount: number;
  
  // Documents
  documentCount: number;
  thisMonthDocumentCount: number;
  
  // Trends
  paymentTrend: number; // percentage change
  payrollTrend: number;
  
  // Period info
  periodStart: string;
  periodEnd: string;
}

export interface DailyPaymentData {
  date: string;
  amount: number;
  count: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface TopCustomerData {
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  orderCount: number;
}

// ============================================
// Finance Overview
// ============================================

export async function getFinanceOverview(): Promise<FinanceOverviewData> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.view');

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Parallel queries for performance
  const [
    thisMonthPaymentsResult,
    lastMonthPaymentsResult,
    outstandingResult,
    payrollThisMonth,
    payrollLastMonth,
    employeeCounts,
    orderCounts,
    documentCounts,
  ] = await Promise.all([
    // This month payments
    sql`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM payments
      WHERE tenant_id = ${context.tenantId}
      AND paid_at >= ${thisMonthStart.toISOString()}
    `,
    
    // Last month payments
    sql`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM payments
      WHERE tenant_id = ${context.tenantId}
      AND paid_at >= ${lastMonthStart.toISOString()}
      AND paid_at <= ${lastMonthEnd.toISOString()}
    `,
    
    // Outstanding receivables (orders with remaining balance)
    sql`
      SELECT 
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COALESCE(SUM(COALESCE(p.paid, 0)), 0) as total_paid
      FROM orders o
      LEFT JOIN (
        SELECT order_id, SUM(amount) as paid
        FROM payments
        WHERE tenant_id = ${context.tenantId}
        GROUP BY order_id
      ) p ON o.id = p.order_id
      WHERE o.tenant_id = ${context.tenantId}
    `,
    
    // This month payroll
    sql`
      SELECT COALESCE(SUM(CASE WHEN kind IN ('salary', 'payment') THEN amount ELSE 0 END), 0) as total
      FROM employee_ledger_entries
      WHERE tenant_id = ${context.tenantId}
      AND entry_date >= ${thisMonthStart.toISOString().split('T')[0]}
    `,
    
    // Last month payroll
    sql`
      SELECT COALESCE(SUM(CASE WHEN kind IN ('salary', 'payment') THEN amount ELSE 0 END), 0) as total
      FROM employee_ledger_entries
      WHERE tenant_id = ${context.tenantId}
      AND entry_date >= ${lastMonthStart.toISOString().split('T')[0]}
      AND entry_date <= ${lastMonthEnd.toISOString().split('T')[0]}
    `,
    
    // Employee counts
    sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM employees
      WHERE tenant_id = ${context.tenantId}
    `,
    
    // Order payment status counts
    sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE COALESCE(p.paid, 0) >= o.total_amount) as paid,
        COUNT(*) FILTER (WHERE COALESCE(p.paid, 0) > 0 AND COALESCE(p.paid, 0) < o.total_amount) as partial,
        COUNT(*) FILTER (WHERE COALESCE(p.paid, 0) = 0) as unpaid
      FROM orders o
      LEFT JOIN (
        SELECT order_id, SUM(amount) as paid
        FROM payments
        WHERE tenant_id = ${context.tenantId}
        GROUP BY order_id
      ) p ON o.id = p.order_id
      WHERE o.tenant_id = ${context.tenantId}
    `,
    
    // Document counts
    sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE uploaded_at >= ${thisMonthStart.toISOString()}) as this_month
      FROM order_documents
      WHERE tenant_id = ${context.tenantId}
    `,
  ]);

  // Cast all results to any[]
  const thisMonthPaymentsRows = thisMonthPaymentsResult as any[];
  const lastMonthPaymentsRows = lastMonthPaymentsResult as any[];
  const outstandingRows = outstandingResult as any[];
  const payrollThisMonthRows = payrollThisMonth as any[];
  const payrollLastMonthRows = payrollLastMonth as any[];
  const employeeCountsRows = employeeCounts as any[];
  const orderCountsRows = orderCounts as any[];
  const documentCountsRows = documentCounts as any[];

  const thisMonthPayments = parseFloat(thisMonthPaymentsRows[0]?.total || '0');
  const lastMonthPayments = parseFloat(lastMonthPaymentsRows[0]?.total || '0');
  const totalRevenue = parseFloat(outstandingRows[0]?.total_revenue || '0');
  const totalPaid = parseFloat(outstandingRows[0]?.total_paid || '0');
  const thisMonthPayrollTotal = parseFloat(payrollThisMonthRows[0]?.total || '0');
  const lastMonthPayrollTotal = parseFloat(payrollLastMonthRows[0]?.total || '0');

  // Calculate trends
  const paymentTrend = lastMonthPayments > 0 
    ? ((thisMonthPayments - lastMonthPayments) / lastMonthPayments) * 100 
    : 0;
  
  const payrollTrend = lastMonthPayrollTotal > 0 
    ? ((thisMonthPayrollTotal - lastMonthPayrollTotal) / lastMonthPayrollTotal) * 100 
    : 0;

  // Collection rate
  const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

  return {
    thisMonthRevenue: totalRevenue,
    lastMonthRevenue: totalRevenue, // Would need historical tracking
    thisMonthPayments,
    lastMonthPayments,
    outstandingReceivables: Math.max(0, totalRevenue - totalPaid),
    collectionRate,
    
    thisMonthPayroll: thisMonthPayrollTotal,
    lastMonthPayroll: lastMonthPayrollTotal,
    employeeCount: parseInt(employeeCountsRows[0]?.total || '0'),
    activeEmployeeCount: parseInt(employeeCountsRows[0]?.active || '0'),
    
    orderCount: parseInt(orderCountsRows[0]?.total || '0'),
    paidOrderCount: parseInt(orderCountsRows[0]?.paid || '0'),
    partialPaidOrderCount: parseInt(orderCountsRows[0]?.partial || '0'),
    unpaidOrderCount: parseInt(orderCountsRows[0]?.unpaid || '0'),
    
    documentCount: parseInt(documentCountsRows[0]?.total || '0'),
    thisMonthDocumentCount: parseInt(documentCountsRows[0]?.this_month || '0'),
    
    paymentTrend,
    payrollTrend,
    
    periodStart: thisMonthStart.toISOString(),
    periodEnd: now.toISOString(),
  };
}

// ============================================
// Daily Payment Trend
// ============================================

export async function getDailyPaymentTrend(days: number = 30): Promise<DailyPaymentData[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.view');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await sql`
    SELECT 
      DATE(paid_at) as date,
      COALESCE(SUM(amount), 0) as amount,
      COUNT(*) as count
    FROM payments
    WHERE tenant_id = ${context.tenantId}
    AND paid_at >= ${startDate.toISOString()}
    GROUP BY DATE(paid_at)
    ORDER BY date ASC
  `;

  // Fill in missing days
  const rows = result as any[];
  const data: DailyPaymentData[] = [];
  const resultMap = new Map(rows.map((r: any) => [r.date, r]));

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const row = resultMap.get(dateStr);
    data.push({
      date: dateStr,
      amount: row ? parseFloat(row.amount) : 0,
      count: row ? parseInt(row.count) : 0,
    });
  }

  return data;
}

// ============================================
// Payment Method Breakdown
// ============================================

export async function getPaymentMethodBreakdown(
  startDate?: string,
  endDate?: string
): Promise<PaymentMethodBreakdown[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.view');

  let query = sql`
    SELECT 
      method,
      COALESCE(SUM(amount), 0) as amount,
      COUNT(*) as count
    FROM payments
    WHERE tenant_id = ${context.tenantId}
  `;

  if (startDate && endDate) {
    query = sql`
      SELECT 
        method,
        COALESCE(SUM(amount), 0) as amount,
        COUNT(*) as count
      FROM payments
      WHERE tenant_id = ${context.tenantId}
      AND paid_at >= ${startDate}
      AND paid_at <= ${endDate}
      GROUP BY method
      ORDER BY amount DESC
    `;
  } else {
    query = sql`
      SELECT 
        method,
        COALESCE(SUM(amount), 0) as amount,
        COUNT(*) as count
      FROM payments
      WHERE tenant_id = ${context.tenantId}
      GROUP BY method
      ORDER BY amount DESC
    `;
  }

  const result = await query;
  const rows = result as any[];

  // Calculate total for percentages
  const total = rows.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);

  return rows.map((r: any) => ({
    method: r.method,
    amount: parseFloat(r.amount),
    count: parseInt(r.count),
    percentage: total > 0 ? (parseFloat(r.amount) / total) * 100 : 0,
  }));
}

// ============================================
// Top Customers by Revenue
// ============================================

export async function getTopCustomers(limit: number = 10): Promise<TopCustomerData[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.view');

  const result = await sql`
    SELECT 
      o.customer_name,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(SUM(o.total_amount), 0) as total_amount,
      COALESCE(SUM(COALESCE(p.paid, 0)), 0) as paid_amount
    FROM orders o
    LEFT JOIN (
      SELECT order_id, SUM(amount) as paid
      FROM payments
      WHERE tenant_id = ${context.tenantId}
      GROUP BY order_id
    ) p ON o.id = p.order_id
    WHERE o.tenant_id = ${context.tenantId}
    GROUP BY o.customer_name
    ORDER BY total_amount DESC
    LIMIT ${limit}
  `;

  const rows = result as any[];
  return rows.map((r: any) => ({
    customerId: '', // No customer table yet
    customerName: r.customer_name,
    totalAmount: parseFloat(r.total_amount),
    paidAmount: parseFloat(r.paid_amount),
    orderCount: parseInt(r.order_count),
  }));
}

// ============================================
// Monthly Summary
// ============================================

export interface MonthlySummary {
  month: string;
  year: number;
  revenue: number;
  payments: number;
  payroll: number;
  netIncome: number;
  orderCount: number;
}

export async function getMonthlySummary(months: number = 12): Promise<MonthlySummary[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.view');

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const [payments, payroll] = await Promise.all([
    sql`
      SELECT 
        EXTRACT(YEAR FROM paid_at) as year,
        EXTRACT(MONTH FROM paid_at) as month,
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count
      FROM payments
      WHERE tenant_id = ${context.tenantId}
      AND paid_at >= ${startDate.toISOString()}
      GROUP BY EXTRACT(YEAR FROM paid_at), EXTRACT(MONTH FROM paid_at)
      ORDER BY year, month
    `,
    sql`
      SELECT 
        EXTRACT(YEAR FROM entry_date) as year,
        EXTRACT(MONTH FROM entry_date) as month,
        COALESCE(SUM(CASE WHEN kind IN ('salary', 'payment') THEN amount ELSE 0 END), 0) as total
      FROM employee_ledger_entries
      WHERE tenant_id = ${context.tenantId}
      AND entry_date >= ${startDate.toISOString().split('T')[0]}
      GROUP BY EXTRACT(YEAR FROM entry_date), EXTRACT(MONTH FROM entry_date)
      ORDER BY year, month
    `,
  ]);

  // Create a map for easy lookup
  const paymentsRows = payments as any[];
  const payrollRows = payroll as any[];
  const paymentMap = new Map(paymentsRows.map((p: any) => [`${p.year}-${p.month}`, p]));
  const payrollMap = new Map(payrollRows.map((p: any) => [`${p.year}-${p.month}`, p]));

  const result: MonthlySummary[] = [];
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  for (let i = 0; i < months; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    
    const paymentData = paymentMap.get(key);
    const payrollData = payrollMap.get(key);
    
    const paymentsTotal = paymentData ? parseFloat(paymentData.total) : 0;
    const payrollTotal = payrollData ? parseFloat(payrollData.total) : 0;

    result.push({
      month: monthNames[date.getMonth()],
      year: date.getFullYear(),
      revenue: paymentsTotal, // Simplified - would need orders data
      payments: paymentsTotal,
      payroll: payrollTotal,
      netIncome: paymentsTotal - payrollTotal,
      orderCount: paymentData ? parseInt(paymentData.count) : 0,
    });
  }

  return result;
}

// ============================================
// Audit Log Summary for Dashboard
// ============================================

export async function getAuditLogSummary(days: number = 7) {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.view');

  // Only owner/admin can see audit summary
  if (context.role !== 'owner' && context.role !== 'admin') {
    return null;
  }

  return AuditLogService.getSummary(context.tenantId, days);
}
