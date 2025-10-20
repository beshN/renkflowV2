-- Remove department check constraint to allow all department values
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_department_check;
