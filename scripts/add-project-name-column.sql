-- Add project_name column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS project_name TEXT;

-- Add comment to the column
COMMENT ON COLUMN orders.project_name IS 'Project name for the order';
