-- Migration to fix department constraint
-- Run this in Supabase SQL Editor

-- Drop the old constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_department_check;

-- Add the new constraint with correct values
ALTER TABLE orders ADD CONSTRAINT orders_department_check 
  CHECK (department IN ('cam', 'demir', 'tente', 'kumas'));

-- Also fix the status constraint if needed
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'in-progress', 'completed', 'delivered', 'new', 'to-paint', 'waiting-material', 'production-issue', 'ready'));
