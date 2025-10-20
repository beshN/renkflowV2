-- Add son_teslim_tarihi (delivery date) column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS son_teslim_tarihi DATE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_son_teslim_tarihi 
ON orders(son_teslim_tarihi);

-- Add comment
COMMENT ON COLUMN orders.son_teslim_tarihi IS 'Son teslim tarihi - Delivery deadline date';
