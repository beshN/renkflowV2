import { AwningConfigurationSchema, AwningPreviewSchema } from '@/lib/features/awning/configuration';
/**
 * Type Definitions for RenkFlow
 * Hybrid Solution: Branded Types + Zod Inference
 * Single Source of Truth for Domain Types
 */

import { z } from 'zod';
import { CurrencySchema, type CurrencyCode } from './currency';

// ============================================
// Branded Types - Compile-time ID Safety
// ============================================

declare const brand: unique symbol;
export type Brand<T, TBrand extends string> = T & { [brand]: TBrand };

export type OrderId = Brand<string, 'OrderId'>;
export type TenantId = Brand<string, 'TenantId'>;
export type UserId = Brand<string, 'UserId'>;
export type DocumentId = Brand<string, 'DocumentId'>;

// Brand constructors
export function createOrderId(id: string): OrderId {
  return id as OrderId;
}

export function createTenantId(id: string): TenantId {
  return id as TenantId;
}

export function createUserId(id: string): UserId {
  return id as UserId;
}

export function createDocumentId(id: string): DocumentId {
  return id as DocumentId;
}

// ============================================
// Zod Schemas - Single Source of Truth
// ============================================

export const OrderStatusSchema = z.enum(['pending', 'in_production', 'delivered']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type Priority = z.infer<typeof PrioritySchema>;

export type Currency = CurrencyCode;

export { CurrencySchema };

/**
 * Safely parse a currency value from string/form data
 * Returns valid currency code or default 'TRY'
 */
export function safeParseCurrency(value: string | null | undefined): Currency {
  const result = CurrencySchema.safeParse(value);
  return result.success ? result.data : 'TRY';
}

export const ViewModeSchema = z.enum(['grid', 'kanban', 'calendar', 'timeline']);
export type ViewMode = z.infer<typeof ViewModeSchema>;

export const DocumentSchema = z.object({
  id: z.string().transform(createDocumentId),
  name: z.string().min(1),
  url: z.string().url(),
  size: z.number().int().nonnegative(),
  uploadedAt: z.string().datetime(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const OrderSchema = z.object({
  financialHidden: z.boolean().optional(),
  productionManaged: z.boolean().optional(),
  version: z.number().int().positive().optional(),
  items: z.array(z.object({ id: z.string(), productName:z.string(), customParameters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).optional(), quantityUnit:z.string().optional(), quantity:z.number(), unitPrice:z.number(), totalPrice:z.number(), color:z.string().nullable().optional(), widthMm:z.number().nullable().optional(), heightMm:z.number().nullable().optional(), projectionMm:z.number().nullable().optional(), mountingHeightMm:z.number().nullable().optional(), awningConfiguration:AwningConfigurationSchema.nullable().optional(), awningPreview:z.string().nullable().optional(), motorType:z.string().nullable().optional(), ledType:z.string().nullable().optional(), fabricType:z.string().nullable().optional(), notes:z.string().nullable().optional() })).optional(),
  id: z.string().transform(createOrderId),
  orderNumber: z.string().min(1),
  customerName: z.string().min(1, 'Müşteri adı gerekli'),
  email: z.string().email('Geçerli email giriniz').optional().or(z.literal('')),
  phone: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formatı gerekli'),
  deliveryDate: z.string().regex(/^(\d{4})-(\d{2})-(\d{2})$/).optional(),
  totalAmount: z.number().nonnegative('Toplam tutar negatif olamaz'),
  currency: CurrencySchema.default('TRY'),
  status: OrderStatusSchema,
  priority: PrioritySchema.optional(),
  notes: z.string().optional(),
  productName: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  documents: z.array(DocumentSchema).default([]),
  customFields: z.record(z.string(), z.string()).optional(),
  tenantId: z.string().transform(createTenantId).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

export const NewOrderItemSchema = z.object({
  quantityUnit: z.string().trim().min(1).max(24).optional(),
  customParameters: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/), z.union([z.string().max(500), z.number().finite(), z.boolean()])).refine(v => Object.keys(v).length <= 30).optional(),
  awningConfiguration: AwningConfigurationSchema.optional(),
  awningPreview: AwningPreviewSchema.optional(),
  projectionMm: z.number().positive().optional(),
  mountingHeightMm: z.number().positive().optional(),
  productName: z.string().min(1, 'Ürün adı gerekli'),
  quantity: z.coerce.number().int().positive('Miktar pozitif olmalı').default(1),
  unitPrice: z.coerce.number().nonnegative().optional(),
  totalPrice: z.coerce.number().nonnegative().default(0),
  color: z.string().optional(),
  widthMm: z.coerce.number().positive().optional(),
  heightMm: z.coerce.number().positive().optional(),
  motorType: z.string().optional(),
  ledType: z.string().optional(),
  fabricType: z.string().optional(),
  notes: z.string().optional(),
});
export type NewOrderItemData = z.infer<typeof NewOrderItemSchema>;

export const NewOrderFormSchema = z.object({
  customerName: z.string().min(1, 'Müşteri adı gerekli'),
  email: z.string().email('Geçerli email giriniz').optional().or(z.literal('')),
  phone: z.string().optional(),
  productName: z.string().min(1, 'Ürün adı gerekli'),
  quantity: z.coerce.number().int().positive('Miktar pozitif olmalı'),
  totalAmount: z.coerce.number().nonnegative('Toplam tutar negatif olamaz'),
  currency: CurrencySchema.default('TRY'),
  deliveryDate: z.string().regex(/^(\d{4})-(\d{2})-(\d{2})$/).optional(),
  notes: z.string().optional(),
  specialNotes: z.string().optional(),
  items: z.array(NewOrderItemSchema).optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});
export type NewOrderFormData = z.infer<typeof NewOrderFormSchema>;

export const UpdateOrderFormSchema = NewOrderFormSchema.partial().extend({
  status: OrderStatusSchema.optional(),
});
export type UpdateOrderFormData = z.infer<typeof UpdateOrderFormSchema>;

// ============================================
// Auth Types
// ============================================

export const UserRoleSchema = z.enum(['owner', 'admin', 'accountant', 'member', 'office', 'worker']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().transform(createUserId),
  name: z.string().min(1),
  email: z.string().email(),
  role: UserRoleSchema.default('member'),
  avatar: z.string().url().optional(),
  tenantId: z.string().transform(createTenantId).optional(),
  tenantName: z.string().optional(),
  tenantIndustry: z.string().optional(),
  templateKey: z.string().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
});
export type User = z.infer<typeof UserSchema>;

// ============================================
// UI Types
// ============================================

export const StatsCardDataSchema = z.object({
  title: z.string(),
  value: z.union([z.string(), z.number()]),
  icon: z.any(), // Changed to allow LucideIcon component
  trend: z.object({
    value: z.number(),
    isPositive: z.boolean(),
  }).optional(),
  color: z.string().optional(),
});
export type StatsCardData = z.infer<typeof StatsCardDataSchema>;

export interface MenuItem {
  icon: string;
  label: string;
  href: string;
}

export interface ProductionStage {
  id: string;
  name: string;
  orders: Order[];
  color: string;
}

// ============================================
// Settings Types
// ============================================

export const CompanySettingsSchema = z.object({
  companyName: z.string().min(1),
  taxNumber: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string().email(),
  currency: CurrencySchema.default('TRY'),
  language: z.enum(['tr', 'en']).default('tr'),
});
export type CompanySettings = z.infer<typeof CompanySettingsSchema>;

// ============================================
// API Response Types
// ============================================

export const APISuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
  });

export const APIErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.string()).optional(),
});

export type APIError = z.infer<typeof APIErrorSchema>;

// ============================================
// Type Guards
// ============================================

export function isOrder(value: unknown): value is Order {
  return OrderSchema.safeParse(value).success;
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return OrderStatusSchema.safeParse(value).success;
}

export function isDocument(value: unknown): value is Document {
  return DocumentSchema.safeParse(value).success;
}

// ============================================
// Database Types
// ============================================

export interface ConnectionInfo {
  status: 'connected' | 'disconnected' | 'error';
  lastConnectedAt: Date | null;
  errorMessage: string | null;
  latencyMs: number | null;
}

// ============================================
// Re-export Finance Types
// ============================================
export * from './finance';
