-- Add manufacturing_steps column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS manufacturing_steps TEXT[];

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_manufacturing_steps ON orders USING GIN (manufacturing_steps);

COMMENT ON COLUMN orders.manufacturing_steps IS 'Array of selected manufacturing step descriptions';
