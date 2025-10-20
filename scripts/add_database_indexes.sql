-- Add indexes for better query performance

-- Index on order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);

-- Index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Index on department for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_department ON orders(department);

-- Index on customer_name for faster searching
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);

-- Composite index for common queries (status + created_at)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Index on order_files for faster joins
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON order_files(order_id);

-- Index on activity_logs for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_order_id ON activity_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
