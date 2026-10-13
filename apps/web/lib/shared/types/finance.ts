/**
 * Finance Module Type Definitions
 * Enterprise-grade Zod schemas + TypeScript types
 * 15+ validation schemas for payments, documents, employees, ledger
 */

import { z } from 'zod';
import { CurrencySchema } from '@/lib/types/currency';

// ============================================
// Common Validation Helpers
// ============================================

const uuidSchema = z.string().uuid('Geçersiz ID formatı');
const positiveNumberSchema = z.number().positive('Değer pozitif olmalıdır');
const currencySchema = CurrencySchema.default('TRY');
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı (YYYY-MM-DD)');
const optionalStringSchema = z.string().optional().nullable();

// ============================================
// Payment Types
// ============================================

export const PaymentMethodSchema = z.enum(['cash', 'bank_transfer', 'credit_card', 'check', 'other']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  currency: currencySchema,
  method: PaymentMethodSchema,
  paidAt: z.string(),
  note: z.string().nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const CreatePaymentSchema = z.object({
  commandId: z.string().uuid().optional(),
  orderId: z.string().uuid(),
  amount: z.number().positive('Tutar pozitif olmalı'),
  currency: currencySchema,
  method: PaymentMethodSchema,
  paidAt: z.string().datetime().optional(),
  note: z.string().optional(),
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

// ============================================
// Order Document Types
// ============================================

export const OrderDocumentTypeSchema = z.enum([
  'invoice',
  'delivery_note',
  'receipt',
  'contract',
  'other',
]);
export type OrderDocumentType = z.infer<typeof OrderDocumentTypeSchema>;

export const OrderDocumentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  type: OrderDocumentTypeSchema,
  fileName: z.string(),
  fileUrl: z.string().url(),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nullable().optional(),
  uploadedBy: z.string().uuid().nullable().optional(),
  uploadedAt: z.string().datetime(),
});
export type OrderDocument = z.infer<typeof OrderDocumentSchema>;

export const UploadOrderDocumentSchema = z.object({
  orderId: z.string().uuid(),
  type: OrderDocumentTypeSchema,
  fileName: z.string(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().optional(),
});
export type UploadOrderDocumentInput = z.infer<typeof UploadOrderDocumentSchema>;

// ============================================
// Employee Types
// ============================================

export const EmployeeSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  fullName: z.string().min(1),
  title: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

export const CreateEmployeeSchema = z.object({
  fullName: z.string().min(1, 'İsim zorunludur'),
  title: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

// ============================================
// Employee Ledger Entry Types
// ============================================

export const LedgerEntryKindSchema = z.enum(['salary', 'advance', 'deduction', 'payment', 'bonus']);
export type LedgerEntryKind = z.infer<typeof LedgerEntryKindSchema>;

export const EmployeeLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  kind: LedgerEntryKindSchema,
  amount: z.number().positive(),
  currency: currencySchema,
  entryDate: z.string(), // YYYY-MM-DD
  note: z.string().nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type EmployeeLedgerEntry = z.infer<typeof EmployeeLedgerEntrySchema>;

export const CreateLedgerEntrySchema = z.object({
  commandId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  kind: LedgerEntryKindSchema,
  amount: z.number().positive('Tutar pozitif olmalı'),
  currency: currencySchema,
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formatında olmalı'),
  note: z.string().optional(),
});
export type CreateLedgerEntryInput = z.infer<typeof CreateLedgerEntrySchema>;

// ============================================
// Finance Overview Types
// ============================================

export interface FinanceOverview {
  thisMonthRevenue: number;
  thisMonthPayments: number;
  outstandingReceivables: number;
  thisMonthPayrollCost: number;
  currency: string;
}

export interface OrderWithPayments {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  date?: string;
  deliveryDate?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
}

// ============================================
// Utility Type Maps
// ============================================

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Nakit',
  bank_transfer: 'Banka Transferi',
  credit_card: 'Kredi Kartı',
  check: 'Çek',
  other: 'Diğer',
};

export const DOCUMENT_TYPE_LABELS: Record<OrderDocumentType, string> = {
  invoice: 'Fatura',
  delivery_note: 'İrsaliye',
  receipt: 'Makbuz',
  contract: 'Sözleşme',
  other: 'Diğer',
};

export const LEDGER_KIND_LABELS: Record<LedgerEntryKind, string> = {
  salary: 'Maaş ödemesi',
  advance: 'Avans',
  deduction: 'Kesinti',
  payment: 'Diğer ödeme',
  bonus: 'Prim',
};
