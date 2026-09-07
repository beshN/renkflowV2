/**
 * Drizzle ORM Schema Definition
 * Single source of truth for database schema
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  decimal,
  date,
  jsonb,
  unique,
  pgSchema,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Tenants (Organizations)
// ============================================

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  logoUrl: text('logo_url'),
  brandColor: text('brand_color').default('#8c5e40'),
  industry: text('industry'),
  templateKey: text('template_key').default('mobilya'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  members: many(tenantMembers),
  invitations: many(invitations),
  customers: many(customers),
  orders: many(orders),
  documents: many(documents),
}));

// ============================================
// Users (Auth.js compatible)
// ============================================

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').unique().notNull(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  password: text('password'),
  verificationToken: text('verification_token'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpires: timestamp('password_reset_expires', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tenantMemberships: many(tenantMembers),
  uploadedDocuments: many(documents),
}));

// ============================================
// Tenant Members (Link Users to Tenants)
// ============================================

export const tenantMembers = pgTable('tenant_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'admin', 'accountant', 'office', 'worker', 'member'] }).default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantUser: unique().on(table.tenantId, table.userId),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMembers.userId],
    references: [users.id],
  }),
}));

// ============================================
// Invitations
// ============================================

export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', { enum: ['admin', 'accountant', 'office', 'worker', 'member'] }).default('member'),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantEmail: unique().on(table.tenantId, table.email),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invitations.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================
// Customers (Tenant Scoped)
// ============================================

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  companyName: text('company_name'),
  taxNumber: text('tax_number'),
  taxOffice: text('tax_office'),
  contacts: jsonb('contacts').default([]),
  billingAddress: text('billing_address'),
  shippingAddress: text('shipping_address'),
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }),
  paymentTerms: integer('payment_terms').default(30),
  notes: text('notes'),
  tags: jsonb('tags').default([]),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  orders: many(orders),
}));

// ============================================
// Orders (Tenant Scoped)
// ============================================

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  orderNumber: text('order_number').notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  customerName: text('customer_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  productName: text('product_name'),
  quantity: integer('quantity').default(1),
  status: text('status', { enum: ['pending', 'in_production', 'delivered', 'new', 'pending_approval', 'approved', 'preparing_materials', 'ready_for_production', 'quality_check', 'ready_for_shipment', 'shipped', 'completed', 'cancelled', 'on_hold'] }).default('pending'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('TRY'),
  deliveryDate: date('delivery_date'),
  notes: text('notes'),
  customFields: jsonb('custom_fields').default({}),
  assignedTo: uuid('assigned_to').references(() => users.id),
  color: text('color'),
  widthMm: decimal('width_mm', { precision: 10, scale: 2 }),
  heightMm: decimal('height_mm', { precision: 10, scale: 2 }),
  motorType: text('motor_type'),
  ledType: text('led_type'),
  fabricType: text('fabric_type'),
  specialNotes: text('special_notes'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).default('medium'),
  paymentStatus: text('payment_status', { enum: ['unpaid', 'partial', 'paid'] }).default('unpaid'),
  shipmentStatus: text('shipment_status', { enum: ['not_shipped', 'ready', 'shipped', 'delivered'] }).default('not_shipped'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantOrderNumber: unique().on(table.tenantId, table.orderNumber),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  documents: many(documents),
}));

// ============================================
// Order Items (Tenant Scoped via Order)
// ============================================

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  color: text('color'),
  widthMm: decimal('width_mm', { precision: 10, scale: 2 }),
  heightMm: decimal('height_mm', { precision: 10, scale: 2 }),
  motorType: text('motor_type'),
  ledType: text('led_type'),
  fabricType: text('fabric_type'),
  notes: text('notes'),
  bomId: uuid('bom_id'),
  productionStatus: text('production_status', { enum: ['not_started', 'in_progress', 'completed', 'on_hold'] }).default('not_started'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

// ============================================
// Documents (Tenant Scoped via Order)
// ============================================

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  filePath: text('file_path').notNull(),
  fileType: text('file_type'),
  size: integer('size'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  entityType: text('entity_type', { enum: ['order', 'customer', 'work_order', 'quotation', 'shipment', 'purchase_order', 'goods_receipt'] }).default('order'),
  entityId: uuid('entity_id'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [documents.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [documents.orderId],
    references: [orders.id],
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

// ============================================
// Activity Logs
// ============================================

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorName: text('actor_name'),
  changes: jsonb('changes').default({}),
  note: text('note'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [activityLogs.tenantId],
    references: [tenants.id],
  }),
  actor: one(users, {
    fields: [activityLogs.actorId],
    references: [users.id],
  }),
}));

// ============================================
// Quotations
// ============================================

export const quotations = pgTable('quotations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  quotationNumber: text('quotation_number').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
  customerName: text('customer_name').notNull(),
  status: text('status', { enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] }).default('draft').notNull(),
  validUntil: date('valid_until'),
  currency: text('currency').default('TRY'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).default('0'),
  notes: text('notes'),
  internalNotes: text('internal_notes'),
  termsAndConditions: text('terms_and_conditions'),
  convertedToOrderId: uuid('converted_to_order_id').references(() => orders.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantQuotationNumber: unique().on(table.tenantId, table.quotationNumber),
}));

export const quotationItems = pgTable('quotation_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  quotationId: uuid('quotation_id').references(() => quotations.id, { onDelete: 'cascade' }).notNull(),
  productName: text('product_name').notNull(),
  description: text('description'),
  color: text('color'),
  widthMm: decimal('width_mm', { precision: 10, scale: 2 }),
  heightMm: decimal('height_mm', { precision: 10, scale: 2 }),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  position: integer('position').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [quotations.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  items: many(quotationItems),
  convertedOrder: one(orders, {
    fields: [quotations.convertedToOrderId],
    references: [orders.id],
  }),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
}));

// ============================================
// Shipments
// ============================================

export const shipments = pgTable('shipments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  shipmentNumber: text('shipment_number').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
  customerName: text('customer_name').notNull(),
  status: text('status', { enum: ['draft', 'ready', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'] }).default('draft').notNull(),
  carrier: text('carrier'),
  trackingNumber: text('tracking_number'),
  scheduledDate: date('scheduled_date'),
  actualDate: date('actual_date'),
  deliveryAddress: text('delivery_address'),
  notes: text('notes'),
  waybillNumber: text('waybill_number'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantShipmentNumber: unique().on(table.tenantId, table.shipmentNumber),
}));

export const shipmentItems = pgTable('shipment_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  shipmentId: uuid('shipment_id').references(() => shipments.id, { onDelete: 'cascade' }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
  orderItemId: uuid('order_item_id').references(() => orderItems.id, { onDelete: 'restrict' }),
  productName: text('product_name').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [shipments.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [shipments.customerId],
    references: [customers.id],
  }),
  items: many(shipmentItems),
}));

export const shipmentItemsRelations = relations(shipmentItems, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentItems.shipmentId],
    references: [shipments.id],
  }),
  order: one(orders, {
    fields: [shipmentItems.orderId],
    references: [orders.id],
  }),
}));

// ============================================
// Suppliers
// ============================================

export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  code: text('code'),
  contactName: text('contact_name'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  taxNumber: text('tax_number'),
  taxOffice: text('tax_office'),
  paymentTerms: integer('payment_terms').default(30),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTenantSupplierName: unique().on(table.tenantId, table.name),
}));

// ============================================
// Newsletter Subscribers
// ============================================

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// SSO Providers
// ============================================

export const ssoProviders = pgTable('sso_providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['saml', 'oidc', 'google', 'azure'] }).notNull(),
  metadata: text('metadata'),
  clientId: text('client_id'),
  clientSecret: text('client_secret'),
  authorizationUrl: text('authorization_url'),
  tokenUrl: text('token_url'),
  userInfoUrl: text('user_info_url'),
  issuerUrl: text('issuer_url'),
  enabled: boolean('enabled').default(true).notNull(),
  allowSignup: boolean('allow_signup').default(false).notNull(),
  domainRestrictions: text('domain_restrictions').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ssoProvidersRelations = relations(ssoProviders, ({ one }) => ({
  tenant: one(tenants, {
    fields: [ssoProviders.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================
// SSO States (PKCE & SAML State)
// ============================================

export const ssoStates = pgTable('sso_states', {
  state: text('state').primaryKey(),
  providerId: uuid('provider_id').references(() => ssoProviders.id, { onDelete: 'cascade' }).notNull(),
  callbackUrl: text('callback_url').notNull(),
  codeVerifier: text('code_verifier'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ============================================
// Push Subscriptions (Web Push)
// ============================================

export const pushSubscriptions = pgTable('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});


export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

// ============================================
// Internal Notifications
// ============================================

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(), // Using text specific ID from service
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  channels: jsonb('channels').$type<string[]>().notNull(), // ['in_app', 'email', 'push']
  read: boolean('read').default(false).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
}));

export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  email: jsonb('email').$type<Record<string, boolean>>().default({}),
  push: jsonb('push').$type<Record<string, boolean>>().default({}),
  inApp: jsonb('in_app').$type<Record<string, boolean>>().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

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


// ============================================
// Type Exports
// ============================================

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;

export type SSOProvider = typeof ssoProviders.$inferSelect;
export type NewSSOProvider = typeof ssoProviders.$inferInsert;

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

export type Quotation = typeof quotations.$inferSelect;
export type NewQuotation = typeof quotations.$inferInsert;

export type QuotationItem = typeof quotationItems.$inferSelect;
export type NewQuotationItem = typeof quotationItems.$inferInsert;

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;

export type ShipmentItem = typeof shipmentItems.$inferSelect;
export type NewShipmentItem = typeof shipmentItems.$inferInsert;

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
