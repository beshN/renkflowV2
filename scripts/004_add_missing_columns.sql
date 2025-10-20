-- Add missing columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_id TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS product_type TEXT,
ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- Update order_id to be unique and not null for new rows
-- First, populate order_id for existing rows if they don't have one
UPDATE public.orders 
SET order_id = id 
WHERE order_id IS NULL;

-- Now make it NOT NULL and UNIQUE
ALTER TABLE public.orders 
ALTER COLUMN order_id SET NOT NULL,
ADD CONSTRAINT orders_order_id_unique UNIQUE (order_id);

-- Set default values for product_type and quantity for existing rows
UPDATE public.orders 
SET product_type = 'Diğer' 
WHERE product_type IS NULL;

UPDATE public.orders 
SET quantity = 1 
WHERE quantity IS NULL;

-- Make product_type and quantity NOT NULL for future inserts
ALTER TABLE public.orders 
ALTER COLUMN product_type SET NOT NULL,
ALTER COLUMN quantity SET NOT NULL;

-- Add check constraint for quantity
ALTER TABLE public.orders 
ADD CONSTRAINT orders_quantity_positive CHECK (quantity > 0);
