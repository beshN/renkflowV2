-- Add 'servis' to department enum
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_department_check;
ALTER TABLE orders ADD CONSTRAINT orders_department_check 
  CHECK (department IN ('cam', 'pergola', 'makasli', 'aluminyum-tavan', 'servis'));
