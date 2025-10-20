-- Add paint send and return date columns to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS paint_send_date DATE,
ADD COLUMN IF NOT EXISTS paint_return_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN orders.paint_send_date IS 'Boyaya gidiş tarihi';
COMMENT ON COLUMN orders.paint_return_date IS 'Boyadan geliş tarihi';
