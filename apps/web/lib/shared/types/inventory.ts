/**
 * Inventory Management Types
 * Stok ve envanter yönetimi için tip tanımlamaları
 */

import { z } from 'zod';

// ============================================
// Enums
// ============================================

export const InventoryCategorySchema = z.enum([
  'raw_material',      // Ham madde
  'finished_goods',    // Bitmiş ürün
  'semi_finished',     // Yarı mamul
  'consumable',        // Sarf malzeme
  'spare_part',        // Yedek parça
  'packaging',         // Ambalaj
]);

export const InventoryUnitSchema = z.enum([
  'piece',      // Adet
  'kg',         // Kilogram
  'meter',      // Metre
  'square_meter', // Metrekare
  'cubic_meter',  // Metreküp
  'liter',      // Litre
  'roll',       // Rulo
  'box',        // Kutu
  'palette',    // Palet
]);

export const StockMovementTypeSchema = z.enum([
  'in',           // Giriş
  'out',          // Çıkış
  'adjustment',   // Düzeltme
  'transfer',     // Transfer
  'return',       // İade
  'waste',        // Fire/Atık
  'production',   // Üretim
]);

// ============================================
// Base Schemas
// ============================================

export const InventoryItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sku: z.string().min(1), // Stok Kodu
  name: z.string().min(1),
  description: z.string().optional(),
  category: InventoryCategorySchema,
  unit: InventoryUnitSchema,
  
  // Stock Levels
  currentStock: z.number().default(0),
  minStockLevel: z.number().default(0), // Kritik seviye
  maxStockLevel: z.number().optional(), // Maksimum stok
  reorderPoint: z.number().default(0),  // Sipariş noktası
  
  // Location
  warehouseId: z.string().uuid().optional(),
  location: z.string().optional(), // Raf/Bölüm bilgisi
  
  // Financial
  unitCost: z.number().default(0), // Birim maliyet
  sellingPrice: z.number().optional(),
  currency: z.string().default('TRY'),
  
  // Supplier
  supplierId: z.string().uuid().optional(),
  supplierName: z.string().optional(),
  supplierSku: z.string().optional(),
  
  // Barcode/QR
  barcode: z.string().optional(),
  qrCode: z.string().optional(),
  
  // Metadata
  dimensions: z.object({
    length: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    weight: z.number().optional(),
  }).optional(),
  
  // Tracking
  isActive: z.boolean().default(true),
  isTrackable: z.boolean().default(true), // Parti/Seri takibi
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastMovementAt: z.string().datetime().optional(),
});

export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  itemId: z.string().uuid(),
  
  // Movement Details
  type: StockMovementTypeSchema,
  quantity: z.number(),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  
  // References
  orderId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  
  // Location
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  
  // Batch/Lot tracking
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(), // SKT
  
  // Reason
  reason: z.string().optional(),
  notes: z.string().optional(),
  
  // User
  createdBy: z.string().uuid().optional(),
  createdByName: z.string().optional(),
  
  // Timestamps
  createdAt: z.string().datetime(),
});

export const WarehouseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  
  // Contact
  managerName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  
  // Capacity
  capacity: z.number().optional(),
  currentUsage: z.number().default(0),
  
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================
// Input Schemas
// ============================================

export const CreateInventoryItemSchema = z.object({
  sku: z.string().min(1, 'Stok kodu zorunludur'),
  name: z.string().min(1, 'Ürün adı zorunludur'),
  description: z.string().optional(),
  category: InventoryCategorySchema,
  unit: InventoryUnitSchema,
  minStockLevel: z.number().min(0).default(0),
  maxStockLevel: z.number().optional(),
  reorderPoint: z.number().min(0).default(0),
  warehouseId: z.string().uuid().optional(),
  location: z.string().optional(),
  unitCost: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).optional(),
  supplierId: z.string().uuid().optional(),
  supplierName: z.string().optional(),
  barcode: z.string().optional(),
  isTrackable: z.boolean().default(true),
});

export const UpdateInventoryItemSchema = CreateInventoryItemSchema.partial();

export const CreateStockMovementSchema = z.object({
  itemId: z.string().uuid(),
  type: StockMovementTypeSchema,
  quantity: z.number().refine(val => val !== 0, 'Miktar 0 olamaz'),
  unitPrice: z.number().optional(),
  orderId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateWarehouseSchema = z.object({
  name: z.string().min(1, 'Depo adı zorunludur'),
  code: z.string().min(1, 'Depo kodu zorunludur'),
  address: z.string().optional(),
  managerName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  capacity: z.number().optional(),
});

// ============================================
// Types
// ============================================

export type InventoryCategory = z.infer<typeof InventoryCategorySchema>;
export type InventoryUnit = z.infer<typeof InventoryUnitSchema>;
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;

export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type StockMovement = z.infer<typeof StockMovementSchema>;
export type Warehouse = z.infer<typeof WarehouseSchema>;

export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemSchema>;
export type CreateStockMovementInput = z.infer<typeof CreateStockMovementSchema>;
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>;

// ============================================
// Category Labels
// ============================================

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  raw_material: 'Ham Madde',
  finished_goods: 'Bitmiş Ürün',
  semi_finished: 'Yarı Mamul',
  consumable: 'Sarf Malzeme',
  spare_part: 'Yedek Parça',
  packaging: 'Ambalaj',
};

export const INVENTORY_UNIT_LABELS: Record<InventoryUnit, string> = {
  piece: 'Adet',
  kg: 'Kg',
  meter: 'Metre',
  square_meter: 'm²',
  cubic_meter: 'm³',
  liter: 'Litre',
  roll: 'Rulo',
  box: 'Kutu',
  palette: 'Palet',
};

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  in: 'Giriş',
  out: 'Çıkış',
  adjustment: 'Düzeltme',
  transfer: 'Transfer',
  return: 'İade',
  waste: 'Fire',
  production: 'Üretim',
};

// ============================================
// Helper Types
// ============================================

export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  categoryBreakdown: Record<InventoryCategory, number>;
}

export interface StockAlert {
  itemId: string;
  itemName: string;
  sku: string;
  currentStock: number;
  minStockLevel: number;
  shortageAmount: number;
  severity: 'critical' | 'warning';
}

export interface InventoryTransaction {
  id: string;
  itemName: string;
  sku: string;
  type: StockMovementType;
  quantity: number;
  date: string;
  userName: string;
}
