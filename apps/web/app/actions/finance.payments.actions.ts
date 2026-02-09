'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import {
  getServerUserContext,
  requirePermission,
  AuthorizationError,
} from '@/lib/auth/serverAuth';
import {
  Payment,
  CreatePaymentInput,
  CreatePaymentSchema,
  OrderWithPayments,
} from '@/lib/types/finance';
import { isMissingRelationError, tableExists } from '@/lib/db/schema-guard';
import { assertPeriodWritable, periodFromDateInput } from '@/lib/features/accounting/period-lock';

/**
 * Create a new payment for an order
 */
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.payments.create');

  // Validate input
  const validated = CreatePaymentSchema.parse(input);

  // Verify order belongs to tenant
  const orderCheck = await sql`
    SELECT id, tenant_id FROM orders 
    WHERE id = ${validated.orderId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;

  const orderCheckRows = orderCheck as any[];
  if (orderCheckRows.length === 0) {
    throw new Error('Sipariş bulunamadı');
  }

  const paidAtIso = validated.paidAt || new Date().toISOString();
  await assertPeriodWritable({
    tenantId: context.tenantId,
    period: periodFromDateInput(paidAtIso),
    actionLabel: 'Ödeme kaydı',
  });

  // Insert payment
  const result = await sql`
    INSERT INTO payments (
      tenant_id, order_id, amount, currency, method, paid_at, note, created_by
    ) VALUES (
      ${context.tenantId},
      ${validated.orderId},
      ${validated.amount},
      ${validated.currency || 'TRY'},
      ${validated.method},
      ${paidAtIso},
      ${validated.note || null},
      ${context.userId}
    )
    RETURNING *
  `;

  revalidatePath('/finance');
  revalidatePath('/finance/payments');
  revalidatePath(`/orders/${validated.orderId}`);

  const rows = result as any[];
  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    method: row.method,
    paidAt: row.paid_at,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * List all payments for a specific order
 */
export async function listPaymentsByOrder(orderId: string): Promise<Payment[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.payments.view');

  const result = await sql`
    SELECT p.* 
    FROM payments p
    JOIN orders o ON p.order_id = o.id AND o.tenant_id = p.tenant_id
    WHERE p.order_id = ${orderId} 
    AND p.tenant_id = ${context.tenantId}
    ORDER BY p.paid_at DESC
  `;

  const rows = result as any[];
  return rows.map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    method: row.method,
    paidAt: row.paid_at,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

/**
 * List all payments for tenant (for overview)
 */
export async function listAllPayments(options?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<Payment[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.payments.view');

  const paymentsTableReady = await tableExists('payments');
  if (!paymentsTableReady) {
    return [];
  }

  try {
    let query;
    
    if (options?.startDate && options?.endDate) {
      query = sql`
        SELECT * FROM payments 
        WHERE tenant_id = ${context.tenantId}
        AND paid_at >= ${options.startDate}::timestamptz
        AND paid_at <= ${options.endDate}::timestamptz
        ORDER BY paid_at DESC
        LIMIT ${options?.limit || 100}
      `;
    } else {
      query = sql`
        SELECT * FROM payments 
        WHERE tenant_id = ${context.tenantId}
        ORDER BY paid_at DESC
        LIMIT ${options?.limit || 100}
      `;
    }

    const result = await query;
    const rows = result as any[];

    return rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      orderId: row.order_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      method: row.method,
      paidAt: row.paid_at,
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  } catch (error) {
    if (isMissingRelationError(error, ['payments'])) {
      return [];
    }
    throw error;
  }
}

/**
 * Delete a payment (owner/admin only)
 */
export async function deletePayment(paymentId: string): Promise<void> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.payments.delete');

  // Verify payment belongs to tenant
  const paymentCheck = await sql`
    SELECT id, order_id, paid_at FROM payments 
    WHERE id = ${paymentId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;

  const paymentCheckRows = paymentCheck as any[];
  if (paymentCheckRows.length === 0) {
    throw new Error('Ödeme bulunamadı');
  }

  await assertPeriodWritable({
    tenantId: context.tenantId,
    period: periodFromDateInput(paymentCheckRows[0].paid_at as string),
    actionLabel: 'Ödeme silme',
  });

  await sql`
    DELETE FROM payments 
    WHERE id = ${paymentId} AND tenant_id = ${context.tenantId}
  `;

  revalidatePath('/finance');
  revalidatePath('/finance/payments');
  revalidatePath(`/orders/${paymentCheckRows[0].order_id}`);
}

/**
 * Get orders with payment summary
 */
export async function getOrdersWithPayments(): Promise<OrderWithPayments[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.payments.view');

  const paymentsTableReady = await tableExists('payments');

  try {
    const result = paymentsTableReady
      ? await sql`
          SELECT 
            o.id,
            o.order_number,
            o.customer_name,
            o.status,
            o.created_at as date,
            o.delivery_date,
            o.total_amount,
            o.currency,
            COALESCE(SUM(p.amount), 0) as paid_amount
          FROM orders o
          LEFT JOIN payments p ON o.id = p.order_id AND p.tenant_id = o.tenant_id
          WHERE o.tenant_id = ${context.tenantId}
          GROUP BY o.id, o.order_number, o.customer_name, o.status, o.created_at, o.delivery_date, o.total_amount, o.currency
          ORDER BY o.created_at DESC
        `
      : await sql`
          SELECT
            o.id,
            o.order_number,
            o.customer_name,
            o.status,
            o.created_at as date,
            o.delivery_date,
            o.total_amount,
            o.currency,
            0 as paid_amount
          FROM orders o
          WHERE o.tenant_id = ${context.tenantId}
          ORDER BY o.created_at DESC
        `;

    const rows = result as any[];
    return rows.map((row: any) => ({
      id: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      status: row.status,
      date: row.date,
      deliveryDate: row.delivery_date,
      totalAmount: parseFloat(row.total_amount),
      paidAmount: parseFloat(row.paid_amount),
      remainingAmount: parseFloat(row.total_amount) - parseFloat(row.paid_amount),
      currency: row.currency,
    }));
  } catch (error) {
    if (isMissingRelationError(error, ['payments', 'orders'])) {
      return [];
    }
    throw error;
  }
}

/**
 * Get this month's total payments
 */
export async function getThisMonthPaymentsTotal(): Promise<number> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.payments.view');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const result = await sql`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE tenant_id = ${context.tenantId}
    AND paid_at >= ${startOfMonth.toISOString()}
    AND paid_at <= ${endOfMonth.toISOString()}
  `;

  const rows = result as any[];
  return parseFloat(rows[0]?.total || '0');
}

/**
 * Get outstanding receivables (total order amounts minus payments)
 */
export async function getOutstandingReceivables(): Promise<number> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.payments.view');

  const result = await sql`
    SELECT 
      COALESCE(SUM(o.total_amount), 0) - COALESCE(SUM(p.total_paid), 0) as outstanding
    FROM orders o
    LEFT JOIN (
      SELECT order_id, SUM(amount) as total_paid
      FROM payments
      WHERE tenant_id = ${context.tenantId}
      GROUP BY order_id
    ) p ON o.id = p.order_id
    WHERE o.tenant_id = ${context.tenantId}
    AND o.status != 'delivered'
  `;

  const rows = result as any[];
  return parseFloat(rows[0]?.outstanding || '0');
}
