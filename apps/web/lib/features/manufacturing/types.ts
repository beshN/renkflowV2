import { z } from 'zod';

export const PositiveQuantitySchema = z.coerce.number().positive().finite().max(1_000_000_000);
export const NonNegativeQuantitySchema = z.coerce.number().min(0).finite().max(1_000_000_000);

export const StockEntryTypeSchema = z.enum([
  'MATERIAL_RECEIPT',
  'MATERIAL_TRANSFER',
  'MATERIAL_ISSUE',
  'MANUFACTURE',
  'STOCK_RECONCILIATION',
  'REVERSAL',
]);

export const StockEntryLineInputSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  quantityDelta: z.coerce.number().finite().refine((value) => value !== 0, 'Miktar sıfır olamaz'),
  uom: z.string().trim().min(1).max(24),
  unitCost: NonNegativeQuantitySchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const PostStockEntryInputSchema = z.object({
  entryType: StockEntryTypeSchema,
  idempotencyKey: z.string().trim().min(8).max(160),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().uuid().optional(),
  note: z.string().trim().max(1000).optional(),
  lines: z.array(StockEntryLineInputSchema).min(1).max(500),
});

export const CreateBomInputSchema = z.object({
  bomCode: z.string().trim().min(2).max(80),
  finishedItemId: z.string().uuid(),
  version: z.number().int().positive(),
  outputQty: PositiveQuantitySchema.default(1),
  outputUom: z.string().trim().min(1).max(24),
  isDefault: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: PositiveQuantitySchema,
    uom: z.string().trim().min(1).max(24),
    sourceWarehouseId: z.string().uuid().optional(),
    scrapRate: z.coerce.number().min(0).max(0.999999).default(0),
  })).min(1).max(500).superRefine((items, context) => {
    const seen = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (seen.has(item.itemId)) {
        context.addIssue({
          code: 'custom',
          message: 'Aynı malzeme BOM içinde bir kez tanımlanabilir',
          path: [index, 'itemId'],
        });
      }
      seen.add(item.itemId);
    }
  }),
});

export const CreateProductionWorkOrderInputSchema = z.object({
  orderId: z.string().uuid(),
  bomId: z.string().uuid(),
  plannedQty: PositiveQuantitySchema,
  sourceWarehouseId: z.string().uuid(),
  wipWarehouseId: z.string().uuid(),
  targetWarehouseId: z.string().uuid(),
  scrapWarehouseId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(240),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  dueAt: z.string().datetime().optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const CompleteProductionRunInputSchema = z.object({
  workOrderId: z.string().uuid(),
  producedQty: PositiveQuantitySchema,
  idempotencyKey: z.string().trim().min(8).max(160),
  actualMaterials: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: PositiveQuantitySchema,
  })).optional(),
  scrap: z.object({
    sourceItemId: z.string().uuid(),
    scrapItemId: z.string().uuid().optional(),
    lengthM: NonNegativeQuantitySchema,
  }).optional(),
});

export const GoodsReceiptInputSchema = z.object({
  receiptNumber: z.string().trim().min(2).max(80),
  purchaseOrderId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
  lines: z.array(z.object({
    purchaseOrderLineId: z.string().uuid().optional(),
    itemId: z.string().uuid(),
    acceptedWarehouseId: z.string().uuid(),
    rejectedWarehouseId: z.string().uuid().optional(),
    acceptedQty: NonNegativeQuantitySchema.default(0),
    rejectedQty: NonNegativeQuantitySchema.default(0),
    uom: z.string().trim().min(1).max(24),
  }).refine((line) => line.acceptedQty + line.rejectedQty > 0, 'Kabul veya red miktarı gerekli')).min(1),
});

export type PostStockEntryInput = z.infer<typeof PostStockEntryInputSchema>;
export type CreateBomInput = z.infer<typeof CreateBomInputSchema>;
export type CreateProductionWorkOrderInput = z.infer<typeof CreateProductionWorkOrderInputSchema>;
export type CompleteProductionRunInput = z.infer<typeof CompleteProductionRunInputSchema>;
export type GoodsReceiptInput = z.infer<typeof GoodsReceiptInputSchema>;

export type ManufacturingActor = {
  tenantId: string;
  userId: string;
};
