/**
 * Customer CRM Types
 * Müşteri ilişkileri yönetimi için tip tanımlamaları
 */

import { z } from 'zod';

// ============================================
// Customer Status & Categories
// ============================================

export const CustomerStatusSchema = z.enum([
  'active',      // Aktif müşteri
  'inactive',    // Pasif
  'vip',         // VIP müşteri
  'prospect',    // Potansiyel
  'churned',     // Kaybedilmiş
]);

export const CustomerIndustrySchema = z.enum([
  'manufacturing',
  'retail',
  'wholesale',
  'construction',
  'hospitality',
  'healthcare',
  'education',
  'other',
]);

// ============================================
// Main Customer Schema
// ============================================

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  // Temel Bilgiler
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  
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
  industry: CustomerIndustrySchema.optional(),
  website: z.string().optional(),
  
  // Durum & Kategorizasyon
  status: CustomerStatusSchema.default('active'),
  category: z.enum(['a', 'b', 'c']).default('c'), // ABC analizi
  priority: z.number().min(1).max(5).default(3),
  
  // Finansal
  creditLimit: z.number().default(0),
  currentBalance: z.number().default(0),
  totalRevenue: z.number().default(0),
  
  // İlişki Yönetimi
  assignedTo: z.string().uuid().optional(), // Satış temsilcisi
  assignedToName: z.string().optional(),
  source: z.enum(['referral', 'website', 'social', 'email', 'call', 'other']).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  
  // İstatistikler
  totalOrders: z.number().default(0),
  lastOrderDate: z.string().datetime().optional(),
  lastContactDate: z.string().datetime().optional(),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================
// Customer Interaction/Activity
// ============================================

export const InteractionTypeSchema = z.enum([
  'call',        // Telefon görüşmesi
  'email',       // E-posta
  'meeting',     // Yüz yüze görüşme
  'note',        // Not
  'order',       // Sipariş
  'complaint',   // Şikayet
  'feedback',    // Geri bildirim
]);

export const CustomerInteractionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  
  type: InteractionTypeSchema,
  subject: z.string(),
  content: z.string(),
  
  // Görüşme detayları
  duration: z.number().optional(), // Dakika olarak
  outcome: z.enum(['success', 'follow_up', 'no_answer', 'voicemail', 'other']).optional(),
  
  // Zamanlama
  scheduledAt: z.string().datetime().optional(), // Planlanan
  completedAt: z.string().datetime().optional(),  // Tamamlanan
  
  // Kim yaptı
  createdBy: z.string().uuid(),
  createdByName: z.string(),
  
  // Hatırlatma
  reminderAt: z.string().datetime().optional(),
  isCompleted: z.boolean().default(false),
  
  createdAt: z.string().datetime(),
});

// ============================================
// Customer Segments
// ============================================

export const CustomerSegmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  
  // Segment kriterleri
  criteria: z.object({
    minRevenue: z.number().optional(),
    maxRevenue: z.number().optional(),
    minOrders: z.number().optional(),
    statuses: z.array(CustomerStatusSchema).optional(),
    industries: z.array(CustomerIndustrySchema).optional(),
    tags: z.array(z.string()).optional(),
  }),
  
  // Otomatik özellikler
  autoAssignTags: z.array(z.string()).optional(),
  autoPriority: z.number().optional(),
  
  customerCount: z.number().default(0),
  createdAt: z.string().datetime(),
});

// ============================================
// Input Schemas
// ============================================

export const CreateCustomerSchema = z.object({
  companyName: z.string().min(1, 'Firma adı zorunludur'),
  contactName: z.string().optional(),
  email: z.string().email('Geçerli e-posta giriniz').optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().default('Türkiye'),
  }).optional(),
  
  taxNumber: z.string().optional(),
  taxOffice: z.string().optional(),
  industry: CustomerIndustrySchema.optional(),
  website: z.string().optional(),
  
  status: CustomerStatusSchema.default('active'),
  creditLimit: z.number().default(0),
  assignedTo: z.string().uuid().optional(),
  source: z.enum(['referral', 'website', 'social', 'email', 'call', 'other']).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const CreateInteractionSchema = z.object({
  customerId: z.string().uuid(),
  type: InteractionTypeSchema,
  subject: z.string().min(1, 'Konu zorunludur'),
  content: z.string().min(1, 'İçerik zorunludur'),
  duration: z.number().optional(),
  outcome: z.enum(['success', 'follow_up', 'no_answer', 'voicemail', 'other']).optional(),
  scheduledAt: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
});

// ============================================
// Types
// ============================================

export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;
export type CustomerIndustry = z.infer<typeof CustomerIndustrySchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type InteractionType = z.infer<typeof InteractionTypeSchema>;
export type CustomerInteraction = z.infer<typeof CustomerInteractionSchema>;
export type CustomerSegment = z.infer<typeof CustomerSegmentSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type CreateInteractionInput = z.infer<typeof CreateInteractionSchema>;

// ============================================
// Labels
// ============================================

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: 'Aktif',
  inactive: 'Pasif',
  vip: 'VIP',
  prospect: 'Potansiyel',
  churned: 'Kaybedilmiş',
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  vip: 'bg-purple-100 text-purple-700',
  prospect: 'bg-blue-100 text-blue-700',
  churned: 'bg-red-100 text-red-700',
};

export const INDUSTRY_LABELS: Record<CustomerIndustry, string> = {
  manufacturing: 'Üretim',
  retail: 'Perakende',
  wholesale: 'Toptan',
  construction: 'İnşaat',
  hospitality: 'Konaklama/Turizm',
  healthcare: 'Sağlık',
  education: 'Eğitim',
  other: 'Diğer',
};

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  call: 'Telefon Görüşmesi',
  email: 'E-posta',
  meeting: 'Yüz Yüze Görüşme',
  note: 'Not',
  order: 'Sipariş',
  complaint: 'Şikayet',
  feedback: 'Geri Bildirim',
};

export const INTERACTION_TYPE_ICONS: Record<InteractionType, string> = {
  call: '📞',
  email: '✉️',
  meeting: '🤝',
  note: '📝',
  order: '📦',
  complaint: '⚠️',
  feedback: '💬',
};

// ============================================
// Statistics
// ============================================

export interface CustomerStatistics {
  totalCustomers: number;
  activeCustomers: number;
  vipCustomers: number;
  newThisMonth: number;
  churnedThisMonth: number;
  totalRevenue: number;
  averageOrderValue: number;
  topCustomers: Customer[];
}
