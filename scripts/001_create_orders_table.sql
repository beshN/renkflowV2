-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  product_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed', 'delivered', 'new', 'to-paint', 'waiting-material', 'production-issue', 'ready')),
  department TEXT NOT NULL CHECK (department IN ('cam', 'demir', 'tente', 'kumas')),
  notes TEXT,
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create files table
CREATE TABLE IF NOT EXISTS public.order_files (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'excel', 'image')),
  url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;

-- Create policies for orders (public read/write for now, can be restricted later)
CREATE POLICY "Allow all to view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow all to insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to update orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Allow all to delete orders" ON public.orders FOR DELETE USING (true);

-- Create policies for order_files
CREATE POLICY "Allow all to view files" ON public.order_files FOR SELECT USING (true);
CREATE POLICY "Allow all to insert files" ON public.order_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to update files" ON public.order_files FOR UPDATE USING (true);
CREATE POLICY "Allow all to delete files" ON public.order_files FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_department ON public.orders(department);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON public.order_files(order_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
