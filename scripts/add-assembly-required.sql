-- Add assembly_required column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assembly_required BOOLEAN DEFAULT false;

-- Add comment to the column
COMMENT ON COLUMN orders.assembly_required IS 'Montaj yapılıp yapılmayacağını belirtir';
