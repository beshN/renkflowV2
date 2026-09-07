const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../apps/web/lib/db/drizzle-schema.ts');
let content = fs.readFileSync(schemaPath, 'utf8');

const manufacturingSchema = `
// ============================================
// Native Manufacturing & Inventory
// ============================================

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  itemType: text('item_type', { enum: ['raw_material', 'finished_good', 'reusable_remnant', 'scrap', 'consumable'] }).default('raw_material').notNull(),
  stockUom: text('stock_uom').default('adet').notNull(),
  profileSection: text('profile_section'),
  standardLengthM: decimal('standard_length_m', { precision: 18, scale: 6 }),
  weightPerMeterKg: decimal('weight_per_meter_kg', { precision: 18, scale: 6 }),
  minStock: decimal('min_stock', { precision: 18, scale: 6 }),
  maxStock: decimal('max_stock', { precision: 18, scale: 6 }),
  active: boolean('active').default(true).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantSku: unique().on(table.tenantId, table.sku),
}));

export const warehouses = pgTable('warehouses', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  warehouseType: text('warehouse_type', { enum: ['RAW', 'WIP', 'FINISHED', 'REUSABLE_REMNANTS', 'SCRAP', 'REJECTED'] }).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantWhCode: unique().on(table.tenantId, table.code),
}));

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  purchaseOrderNumber: text('purchase_order_number').notNull(),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  status: text('status', { enum: ['draft', 'submitted', 'partially_received', 'received', 'cancelled'] }).default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantPoNumber: unique().on(table.tenantId, table.purchaseOrderNumber),
}));

export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'restrict' }).notNull(),
  itemId: uuid('item_id').references(() => inventoryItems.id, { onDelete: 'restrict' }).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }).notNull(),
  orderedQty: decimal('ordered_qty', { precision: 18, scale: 6 }).notNull(),
  receivedQty: decimal('received_qty', { precision: 18, scale: 6 }).default('0').notNull(),
  uom: text('uom').notNull(),
  unitPrice: decimal('unit_price', { precision: 18, scale: 6 }),
});

export const goodsReceipts = pgTable('goods_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  receiptNumber: text('receipt_number').notNull(),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'restrict' }),
  status: text('status', { enum: ['draft', 'submitted'] }).default('draft').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  receivedBy: uuid('received_by').references(() => users.id, { onDelete: 'set null' }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantGrNumber: unique().on(table.tenantId, table.receiptNumber),
  uniqueTenantGrIdemp: unique().on(table.tenantId, table.idempotencyKey),
}));

export const goodsReceiptLines = pgTable('goods_receipt_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  goodsReceiptId: uuid('goods_receipt_id').references(() => goodsReceipts.id, { onDelete: 'restrict' }).notNull(),
  purchaseOrderLineId: uuid('purchase_order_line_id').references(() => purchaseOrderLines.id, { onDelete: 'restrict' }),
  itemId: uuid('item_id').references(() => inventoryItems.id, { onDelete: 'restrict' }).notNull(),
  acceptedWarehouseId: uuid('accepted_warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }).notNull(),
  rejectedWarehouseId: uuid('rejected_warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }),
  acceptedQty: decimal('accepted_qty', { precision: 18, scale: 6 }).default('0').notNull(),
  rejectedQty: decimal('rejected_qty', { precision: 18, scale: 6 }).default('0').notNull(),
  uom: text('uom').notNull(),
});

export const workOrders = pgTable('work_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['open', 'in_progress', 'blocked', 'done', 'cancelled'] }).default('open').notNull(),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'critical'] }).default('medium').notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
  productionItemId: uuid('production_item_id').references(() => inventoryItems.id, { onDelete: 'restrict' }),
  plannedQty: decimal('planned_qty', { precision: 18, scale: 6 }),
  producedQty: decimal('produced_qty', { precision: 18, scale: 6 }).default('0').notNull(),
  productionUom: text('production_uom'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

`;

const injectionMarker = '// ============================================\n// Type Exports\n// ============================================';

if (!content.includes(manufacturingSchema.trim().substring(0, 50))) {
  content = content.replace(injectionMarker, manufacturingSchema + '\n' + injectionMarker);
  
  // also add types
  const typesSchema = `
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type NewGoodsReceipt = typeof goodsReceipts.$inferInsert;
export type WorkOrder = typeof workOrders.$inferSelect;
`;
  content = content + '\n' + typesSchema;
  fs.writeFileSync(schemaPath, content);
  console.log('Schema updated successfully');
} else {
  console.log('Schema already updated');
}
