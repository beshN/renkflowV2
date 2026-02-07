-- ============================================
-- Database Indexes for Performance Optimization
-- RenkFlow V2
-- ============================================

-- Orders Table Indexes
-- Primary lookup by tenant and status (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status 
ON orders(tenant_id, status);

-- Date-based queries for reports and filtering
CREATE INDEX IF NOT EXISTS idx_orders_tenant_date 
ON orders(tenant_id, created_at DESC);

-- Customer lookup within tenant
CREATE INDEX IF NOT EXISTS idx_orders_tenant_customer 
ON orders(tenant_id, customer_name);

-- Delivery date for scheduling views
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date 
ON orders(delivery_date) 
WHERE delivery_date IS NOT NULL;

-- Order number lookup (unique within tenant)
CREATE INDEX IF NOT EXISTS idx_orders_order_number 
ON orders(tenant_id, order_number);

-- Full-text search on customer name and product
CREATE INDEX IF NOT EXISTS idx_orders_search 
ON orders USING gin(to_tsvector('simple', coalesce(customer_name, '') || ' ' || coalesce(product_name, '')));

-- ============================================
-- Users Table Indexes
-- ============================================

-- Email lookup (unique, used for auth)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- Email verification status
CREATE INDEX IF NOT EXISTS idx_users_email_verified 
ON users(email_verified) 
WHERE email_verified = false;

-- ============================================
-- Tenant Members Table Indexes
-- ============================================

-- User's tenants lookup
CREATE INDEX IF NOT EXISTS idx_tenant_members_user 
ON tenant_members(user_id);

-- Tenant's members lookup
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant 
ON tenant_members(tenant_id);

-- Role-based queries
CREATE INDEX IF NOT EXISTS idx_tenant_members_role 
ON tenant_members(tenant_id, role);

-- ============================================
-- Documents Table Indexes
-- ============================================

-- Order documents lookup
CREATE INDEX IF NOT EXISTS idx_documents_order 
ON documents(order_id);

-- ============================================
-- Audit Trail Indexes (if table exists)
-- ============================================

-- Time-based audit queries
CREATE INDEX IF NOT EXISTS idx_audit_trail_created 
ON audit_trail(created_at DESC);

-- User activity lookup
CREATE INDEX IF NOT EXISTS idx_audit_trail_user 
ON audit_trail(user_id, created_at DESC);

-- Entity lookup
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity 
ON audit_trail(entity_type, entity_id);

-- ============================================
-- Partial Indexes for Common Filters
-- ============================================

-- Active orders (not delivered or cancelled)
CREATE INDEX IF NOT EXISTS idx_orders_active 
ON orders(tenant_id, created_at DESC) 
WHERE status NOT IN ('delivered', 'cancelled');

-- Pending orders only
CREATE INDEX IF NOT EXISTS idx_orders_pending 
ON orders(tenant_id, created_at DESC) 
WHERE status = 'pending';

-- In production orders
CREATE INDEX IF NOT EXISTS idx_orders_in_production 
ON orders(tenant_id, created_at DESC) 
WHERE status = 'in_production';

-- ============================================
-- Statistics
-- ============================================

-- Run ANALYZE to update statistics after creating indexes
ANALYZE orders;
ANALYZE users;
ANALYZE tenant_members;
ANALYZE documents;
