import {
  CompleteProductionRunInputSchema,
  CreateBomInputSchema,
  GoodsReceiptInputSchema,
  PostStockEntryInputSchema,
} from '../types';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const WAREHOUSE_ID = '22222222-2222-4222-8222-222222222222';
const WORK_ORDER_ID = '33333333-3333-4333-8333-333333333333';
const FINISHED_ITEM_ID = '44444444-4444-4444-8444-444444444444';

describe('native manufacturing command schemas', () => {
  it('rejects zero-delta stock ledger lines', () => {
    expect(PostStockEntryInputSchema.safeParse({
      entryType: 'MATERIAL_RECEIPT',
      idempotencyKey: 'test-entry-001',
      lines: [{ itemId: ITEM_ID, warehouseId: WAREHOUSE_ID, quantityDelta: 0, uom: 'm' }],
    }).success).toBe(false);
  });

  it('rejects an empty goods receipt line', () => {
    expect(GoodsReceiptInputSchema.safeParse({
      receiptNumber: 'GR-1',
      idempotencyKey: 'test-receipt-001',
      lines: [{
        itemId: ITEM_ID,
        acceptedWarehouseId: WAREHOUSE_ID,
        acceptedQty: 0,
        rejectedQty: 0,
        uom: 'm',
      }],
    }).success).toBe(false);
  });

  it('accepts the pilot production completion payload', () => {
    expect(CompleteProductionRunInputSchema.safeParse({
      workOrderId: WORK_ORDER_ID,
      producedQty: 1,
      idempotencyKey: 'test-completion-001',
      actualMaterials: [{ itemId: ITEM_ID, quantity: 4 }],
      scrap: { sourceItemId: ITEM_ID, lengthM: 0.05 },
    }).success).toBe(true);
  });

  it('rejects duplicate material rows in a BOM snapshot', () => {
    expect(CreateBomInputSchema.safeParse({
      bomCode: 'BOM-DEMO',
      finishedItemId: FINISHED_ITEM_ID,
      version: 1,
      outputQty: 1,
      outputUom: 'adet',
      items: [
        { itemId: ITEM_ID, quantity: 2, uom: 'm' },
        { itemId: ITEM_ID, quantity: 2, uom: 'm' },
      ],
    }).success).toBe(false);
  });
});
