-- Add status_notes column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_notes TEXT;

-- Add status_date column for paint dates
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_date DATE;

-- Update existing orders to have empty status notes
UPDATE orders SET status_notes = '' WHERE status_notes IS NULL;
UPDATE orders SET status_date = NULL WHERE status_date IS NULL;
