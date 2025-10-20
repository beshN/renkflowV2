-- Fix status constraint and convert quantity to text
-- This script updates the orders table to support all status values and text quantities

-- Step 1: Drop the old status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Add new status constraint with all current status values
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'pending',
    'in-progress',
    'completed',
    'delivered',
    'new',
    'to-paint',
    'waiting-material',
    'production-issue',
    'ready',
    'paint-send',
    'paint-return',
    'cancelled'
  ));

-- Step 3: Convert quantity column from INTEGER to TEXT (if not already TEXT)
DO $$ 
BEGIN
  -- Check if quantity is not already TEXT
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND column_name = 'quantity' 
      AND data_type != 'text'
  ) THEN
    -- Convert to TEXT
    ALTER TABLE orders ALTER COLUMN quantity TYPE TEXT USING quantity::TEXT;
  END IF;
END $$;
