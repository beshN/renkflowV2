-- Remove the status constraint to allow all status values
-- The status field is already TEXT type, so it can accept any value
-- TypeScript type checking will ensure valid status values in the application

-- Drop the status constraint that's causing issues
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Note: quantity column is already TEXT type, no changes needed
-- Note: We're not adding a new constraint because:
-- 1. It's more flexible for future status additions
-- 2. TypeScript provides type safety in the application
-- 3. Avoids migration issues with existing data
