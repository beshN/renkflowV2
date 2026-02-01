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
  brandColor: text('brand_color').default('#6366f1'),
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
  status: text('status', { enum: ['pending', 'in_production', 'delivered'] }).default('pending'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('₺'),
  deliveryDate: date('delivery_date'),
  notes: text('notes'),
  customFields: jsonb('custom_fields').default({}),
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
