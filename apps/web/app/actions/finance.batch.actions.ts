'use server';

/**
 * Finance Batch Operations
 * Enterprise-grade bulk operations with transaction safety and audit logging
 */

import { revalidatePath } from 'next/cache';
import { sql, withTransaction } from '@/lib/db';
import {
  getServerUserContext,
  requirePermission,
} from '@/lib/auth/serverAuth';
import { AuditLogService } from '@/lib/services/auditLog.service';
import { assertPeriodWritable, periodFromDateInput } from '@/lib/features/accounting/period-lock';
import { 
  ValidationError, 
  NotFoundError,
  ForbiddenError,
} from '@/lib/utils/errorHandler';
import { z } from 'zod';

// ============================================
// Validation Schemas
// ============================================

const BatchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const BatchUpdateEmployeesSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(100),
  updates: z.object({
    active: z.boolean().optional(),
    title: z.string().optional(),
  }),
});

// ============================================
// Types
// ============================================

export interface BatchOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: { id: string; error: string }[];
}

// ============================================
// Batch Delete Payments
// ============================================

export async function batchDeletePayments(
  paymentIds: string[]
): Promise<BatchOperationResult> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.payments.delete');

  // Validate input
  const validated = BatchDeleteSchema.safeParse({ ids: paymentIds });
  if (!validated.success) {
    throw new ValidationError('Geçersiz veri', { ids: validated.error.issues.map(e => e.message) });
  }

  const result: BatchOperationResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  };

  // Get existing payments for audit log
  const existingPaymentsResult = await sql`
    SELECT id, order_id, amount, currency, method, note, paid_at
    FROM payments
    WHERE id = ANY(${paymentIds}::uuid[])
    AND tenant_id = ${context.tenantId}
  `;
  const existingPayments = existingPaymentsResult as any[];

  const existingIds = new Set((existingPayments as { id: string }[]).map(p => p.id));

  // Use transaction for atomicity
  await withTransaction(async (tx) => {
    for (const paymentId of paymentIds) {
      try {
        if (!existingIds.has(paymentId)) {
          result.errors.push({ id: paymentId, error: 'Ödeme bulunamadı' });
          result.failed++;
          continue;
        }

        const payment = existingPayments.find((p: any) => p.id === paymentId);
        if (!payment) {
          result.errors.push({ id: paymentId, error: 'Ödeme bulunamadı' });
          result.failed++;
          continue;
        }
        await assertPeriodWritable({
          tenantId: context.tenantId,
          period: periodFromDateInput(payment.paid_at as string),
          actionLabel: 'Toplu ödeme silme',
        });

        await tx`
          DELETE FROM payments 
          WHERE id = ${paymentId} AND tenant_id = ${context.tenantId}
        `;
        
        // Log audit event
        await AuditLogService.log({
          tenantId: context.tenantId,
          userId: context.userId,
          userEmail: context.email,
          userRole: context.role,
          action: 'payment.batch_delete',
          entityType: 'payment',
          entityId: paymentId,
          oldValues: payment ? {
            orderId: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
          } : undefined,
          metadata: { batchSize: paymentIds.length },
        });

        result.processed++;
      } catch (error) {
        result.errors.push({ 
          id: paymentId, 
          error: error instanceof Error ? error.message : 'Bilinmeyen hata' 
        });
        result.failed++;
      }
    }
  });

  result.success = result.failed === 0;

  revalidatePath('/finance');
  revalidatePath('/finance/payments');

  return result;
}

// ============================================
// Batch Delete Documents
// ============================================

export async function batchDeleteDocuments(
  documentIds: string[]
): Promise<BatchOperationResult> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.delete');

  // Validate input
  const validated = BatchDeleteSchema.safeParse({ ids: documentIds });
  if (!validated.success) {
    throw new ValidationError('Geçersiz veri', { ids: validated.error.issues.map(e => e.message) });
  }

  const result: BatchOperationResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  };

  // Get existing documents for audit log and object storage deletion
  const existingDocsResult = await sql`
    SELECT id, order_id, file_name, file_url, type
    FROM order_documents
    WHERE id = ANY(${documentIds}::uuid[])
    AND tenant_id = ${context.tenantId}
  `;
  const existingDocs = existingDocsResult as any[];

  const existingIds = new Set((existingDocs as { id: string }[]).map(d => d.id));

  // Import storage helpers
  const { deleteFile } = await import('@/lib/storage/gcs');

  await withTransaction(async (tx) => {
    for (const docId of documentIds) {
      try {
        if (!existingIds.has(docId)) {
          result.errors.push({ id: docId, error: 'Belge bulunamadı' });
          result.failed++;
          continue;
        }

        const doc = (existingDocs as { id: string; order_id?: string; file_name?: string; file_url?: string; type?: string }[]).find(d => d.id === docId);

        // Delete from object storage
        if (doc?.file_url) {
          try {
            await deleteFile(doc.file_url);
          } catch (storageError) {
            console.error('Storage delete error:', storageError);
          }
        }

        // Delete from database
        await tx`
          DELETE FROM order_documents 
          WHERE id = ${docId} AND tenant_id = ${context.tenantId}
        `;

        // Log audit event
        await AuditLogService.log({
          tenantId: context.tenantId,
          userId: context.userId,
          userEmail: context.email,
          userRole: context.role,
          action: 'document.batch_delete',
          entityType: 'order_document',
          entityId: docId,
          oldValues: doc ? {
            orderId: doc.order_id,
            fileName: doc.file_name,
            type: doc.type,
          } : undefined,
          metadata: { batchSize: documentIds.length },
        });

        result.processed++;
      } catch (error) {
        result.errors.push({ 
          id: docId, 
          error: error instanceof Error ? error.message : 'Bilinmeyen hata' 
        });
        result.failed++;
      }
    }
  });

  result.success = result.failed === 0;

  revalidatePath('/finance');
  revalidatePath('/finance/documents');

  return result;
}

// ============================================
// Batch Update Employees
// ============================================

export async function batchUpdateEmployees(
  employeeIds: string[],
  updates: { active?: boolean; title?: string }
): Promise<BatchOperationResult> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.employees.edit');

  // Validate input
  const validated = BatchUpdateEmployeesSchema.safeParse({ employeeIds, updates });
  if (!validated.success) {
    throw new ValidationError('Geçersiz veri');
  }

  if (Object.keys(updates).length === 0) {
    throw new ValidationError('En az bir güncelleme alanı gerekli');
  }

  const result: BatchOperationResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  };

  // Get existing employees for audit log
  const existingEmployeesResult = await sql`
    SELECT id, full_name, title, active
    FROM employees
    WHERE id = ANY(${employeeIds}::uuid[])
    AND tenant_id = ${context.tenantId}
  `;
  const existingEmployees = existingEmployeesResult as any[];

  const existingIds = new Set(existingEmployees.map((e: any) => e.id));

  await withTransaction(async (tx) => {
    for (const empId of employeeIds) {
      try {
        if (!existingIds.has(empId)) {
          result.errors.push({ id: empId, error: 'Çalışan bulunamadı' });
          result.failed++;
          continue;
        }

        const oldEmployee = existingEmployees.find((e: any) => e.id === empId);

        // Build dynamic update
        if (updates.active !== undefined && updates.title !== undefined) {
          await tx`
            UPDATE employees SET
              active = ${updates.active},
              title = ${updates.title},
              updated_at = NOW()
            WHERE id = ${empId} AND tenant_id = ${context.tenantId}
          `;
        } else if (updates.active !== undefined) {
          await tx`
            UPDATE employees SET
              active = ${updates.active},
              updated_at = NOW()
            WHERE id = ${empId} AND tenant_id = ${context.tenantId}
          `;
        } else if (updates.title !== undefined) {
          await tx`
            UPDATE employees SET
              title = ${updates.title},
              updated_at = NOW()
            WHERE id = ${empId} AND tenant_id = ${context.tenantId}
          `;
        }

        // Log audit event
        await AuditLogService.log({
          tenantId: context.tenantId,
          userId: context.userId,
          userEmail: context.email,
          userRole: context.role,
          action: 'employee.batch_update',
          entityType: 'employee',
          entityId: empId,
          oldValues: oldEmployee ? {
            active: oldEmployee.active,
            title: oldEmployee.title,
          } : undefined,
          newValues: updates,
          metadata: { batchSize: employeeIds.length },
        });

        result.processed++;
      } catch (error) {
        result.errors.push({ 
          id: empId, 
          error: error instanceof Error ? error.message : 'Bilinmeyen hata' 
        });
        result.failed++;
      }
    }
  });

  result.success = result.failed === 0;

  revalidatePath('/finance/employees');

  return result;
}

// ============================================
// Batch Delete Ledger Entries
// ============================================

export async function batchDeleteLedgerEntries(
  entryIds: string[]
): Promise<BatchOperationResult> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.ledger.delete');

  // Validate input
  const validated = BatchDeleteSchema.safeParse({ ids: entryIds });
  if (!validated.success) {
    throw new ValidationError('Geçersiz veri');
  }

  const result: BatchOperationResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  };

  // Get existing entries for audit log
  const existingEntriesResult = await sql`
    SELECT id, employee_id, kind, amount, currency, entry_date
    FROM employee_ledger_entries
    WHERE id = ANY(${entryIds}::uuid[])
    AND tenant_id = ${context.tenantId}
  `;
  const existingEntries = existingEntriesResult as any[];

  const existingIds = new Set(existingEntries.map((e: any) => e.id));

  await withTransaction(async (tx) => {
    for (const entryId of entryIds) {
      try {
        if (!existingIds.has(entryId)) {
          result.errors.push({ id: entryId, error: 'Kayıt bulunamadı' });
          result.failed++;
          continue;
        }

        const entry = existingEntries.find((e: any) => e.id === entryId);

        await tx`
          DELETE FROM employee_ledger_entries 
          WHERE id = ${entryId} AND tenant_id = ${context.tenantId}
        `;

        // Log audit event
        await AuditLogService.log({
          tenantId: context.tenantId,
          userId: context.userId,
          userEmail: context.email,
          userRole: context.role,
          action: 'ledger.delete',
          entityType: 'employee_ledger_entry',
          entityId: entryId,
          oldValues: entry ? {
            employeeId: entry.employee_id,
            kind: entry.kind,
            amount: entry.amount,
            currency: entry.currency,
            entryDate: entry.entry_date,
          } : undefined,
          metadata: { batchSize: entryIds.length },
        });

        result.processed++;
      } catch (error) {
        result.errors.push({ 
          id: entryId, 
          error: error instanceof Error ? error.message : 'Bilinmeyen hata' 
        });
        result.failed++;
      }
    }
  });

  result.success = result.failed === 0;

  revalidatePath('/finance');
  revalidatePath('/finance/employees');

  return result;
}

// ============================================
// Export Audit Log
// ============================================

export async function logExportAction(
  exportType: 'payments' | 'documents' | 'employees' | 'ledger',
  recordCount: number
): Promise<void> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.view');

  const actionMap = {
    payments: 'export.payments',
    documents: 'export.documents',
    employees: 'export.employees',
    ledger: 'export.ledger',
  } as const;

  await AuditLogService.log({
    tenantId: context.tenantId,
    userId: context.userId,
    userEmail: context.email,
    userRole: context.role,
    action: actionMap[exportType],
    entityType: exportType === 'ledger' ? 'employee_ledger_entry' : exportType === 'documents' ? 'order_document' : (exportType.slice(0, -1) as 'payment' | 'employee'),
    metadata: { recordCount, exportType },
  });
}
