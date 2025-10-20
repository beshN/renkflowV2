-- Verify and add project_name column if it doesn't exist
DO $$ 
BEGIN
    -- Check if project_name column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'project_name'
    ) THEN
        -- Add project_name column
        ALTER TABLE orders ADD COLUMN project_name TEXT;
        RAISE NOTICE 'project_name column added successfully';
    ELSE
        RAISE NOTICE 'project_name column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
