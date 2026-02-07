/**
 * Supplier Management Types
 * Tedarikçi yönetimi için tip tanımlamaları
 */

import { z } from 'zod';

// ============================================
// Supplier Status & Categories
// ============================================

export const SupplierStatusSchema = z.enum([
  'active',      // Aktif tedarikçi
  'inactive',    // Pasif
  'preferred',   // Tercih edilen
  'blacklisted', // Kara liste
]);

export const SupplierCategorySchema = z.enum([
  'raw_material',
  'logistics',
  'equipment',
  'service',
  'other',
]);

// ============================================
// Main Supplier Schema
// ============================================

export const SupplierSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  // Temel Bilgiler
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  
  // Adres
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().default('Türkiye'),
  }).optional(),
  
  // Firma Bilgileri
  taxNumber: z.string().optional(),
  taxOffice: z.string().optional(),
  category: SupplierCategorySchema.optional(),
  website: z.string().optional(),
  
  // Durum & Kategorizasyon
  status: SupplierStatusSchema.default('active'),
  reliabilityScore: z.number().min(1).max(5).default(3),
  
  // Performans Metrikleri
  averageDeliveryTime: z.number().default(0), // Gün cinsinden
  fulfillmentRate: z.number().default(0), // % olarak
  qualityRating: z.number().default(0), // 1-5 arası
  
  // Finansal
  paymentTerms: z.number().default(30), // Gün cinsinden
  creditLimit: z.number().default(0),
  currentBalance: z.number().default(0),
  
  // İlişki Yönetimi
  assignedTo: z.string().uuid().optional(), // Sorumlu
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  
  // İstatistikler
  totalOrders: z.number().default(0),
  lastOrderDate: z.string().datetime().optional(),
  lastInteractionDate: z.string().datetime().optional(),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================
// Supplier Interaction/Activity
// ============================================

export const SupplierInteractionTypeSchema = z.enum([
  'order',       // Sipariş
  'delivery',    // Teslimat
  'payment',     // Ödeme
  'complaint',   // Şikayet
  'meeting',     // Görüşme
  'contract',    // Kontrat
]);

export const SupplierInteractionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  supplierId: z.string().uuid(),
  
  type: SupplierInteractionTypeSchema,
  description: z.string(),
  
  // İlişkili sipariş
  relatedOrderId: z.string().uuid().optional(),
  relatedInvoiceId: z.string().uuid().optional(),
  
  // Zamanlama
  date: z.string().datetime(),
  
  // Kim yaptı
  createdBy: z.string().uuid(),
  createdByName: z.string(),
  
  createdAt: z.string().datetime(),
});

// ============================================
// Supplier Performance Report
// ============================================

export const SupplierPerformanceSchema = z.object({
  supplierId: z.string().uuid(),
  period: z.string(), // YYYY-MM
  
  // Metrikler
  onTimeDeliveryRate: z.number().default(0), // %
  qualityDefectRate: z.number().default(0), // %
  averageResponseTime: z.number().default(0), // Saat
  orderFulfillmentRate: z.number().default(0), // %
  
  // Finansal
  totalSpend: z.number().default(0),
  paymentCompliance: z.number().default(0), // %
  
  // Genel Değerlendirme
  overallScore: z.number().default(0), // 1-100
  rating: z.enum(['A', 'B', 'C', 'D', 'F']),
});

// ============================================
// Input Schemas
// ============================================

export const CreateSupplierSchema = z.object({
  companyName: z.string().min(1, 'Firma adı zorunludur'),
  contactName: z.string().optional(),
  email: z.string().email('Geçerli e-posta giriniz').optional(),
  phone: z.string().optional(),
  
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().default('Türkiye'),
  }).optional(),
  
  taxNumber: z.string().optional(),
  taxOffice: z.string().optional(),
  category: SupplierCategorySchema.optional(),
  
  paymentTerms: z.number().default(30),
  creditLimit: z.number().default(0),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

// ============================================
// Types
// ============================================

export type SupplierStatus = z.infer<typeof SupplierStatusSchema>;
export type SupplierCategory = z.infer<typeof SupplierCategorySchema>;
export type Supplier = z.infer<typeof SupplierSchema>;
export type SupplierInteractionType = z.infer<typeof SupplierInteractionTypeSchema>;
export type SupplierInteraction = z.infer<typeof SupplierInteractionSchema>;
export type SupplierPerformance = z.infer<typeof SupplierPerformanceSchema>;
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;

// ============================================
// Labels
// ============================================

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  active: 'Aktif',
  inactive: 'Pasif',
  preferred: 'Tercih Edilen',
  blacklisted: 'Kara Liste',
};

export const SUPPLIER_STATUS_COLORS: Record<SupplierStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  preferred: 'bg-blue-100 text-blue-700',
  blacklisted: 'bg-red-100 text-red-700',
};

export const SUPPLIER_CATEGORY_LABELS: Record<SupplierCategory, string> = {
  raw_material: 'Hammadde',
  logistics: 'Lojistik',
  equipment: 'Ekipman',
  service: 'Hizmet',
  other: 'Diğer',
};

export const SUPPLIER_INTERACTION_LABELS: Record<SupplierInteractionType, string> = {
  order: 'Sipariş',
  delivery: 'Teslimat',
  payment: 'Ödeme',
  complaint: 'Şikayet',
  meeting: 'Görüşme',
  contract: 'Kontrat',
};
