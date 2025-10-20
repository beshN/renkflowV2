-- ============================================
-- RENKFLOW - COMPLETE DATABASE SETUP
-- Bu script tüm tabloları sıfırdan oluşturur
-- Supabase SQL Editor'de çalıştırın
-- ============================================

-- Önce mevcut tabloları sil (varsa)
DROP TABLE IF EXISTS public.order_files CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;

-- ============================================
-- ORDERS TABLE (Siparişler)
-- ============================================
CREATE TABLE public.orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  product_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  department TEXT NOT NULL CHECK (department IN ('cam', 'demir', 'tente', 'kumas')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 
    'pending', 
    'in-progress', 
    'completed', 
    'delivered', 
    'to-paint', 
    'waiting-material', 
    'production-issue', 
    'ready'
  )),
  notes TEXT,
  order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivery_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Orders tablosu için index'ler
CREATE INDEX idx_orders_order_id ON public.orders(order_id);
CREATE INDEX idx_orders_customer_name ON public.orders(customer_name);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_department ON public.orders(department);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- ============================================
-- ORDER_FILES TABLE (Sipariş Dosyaları)
-- ============================================
CREATE TABLE public.order_files (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'excel', 'image', 'other')),
  url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Order files tablosu için index
CREATE INDEX idx_order_files_order_id ON public.order_files(order_id);

-- ============================================
-- MATERIALS TABLE (Malzemeler)
-- ============================================
CREATE TABLE public.materials (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  material_type TEXT,
  width NUMERIC,
  height NUMERIC,
  depth NUMERIC,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Materials tablosu için index
CREATE INDEX idx_materials_order_id ON public.materials(order_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Güvenlik
-- ============================================

-- RLS'i aktif et
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Herkese okuma izni ver (authenticated users)
CREATE POLICY "Enable read access for all users" ON public.orders
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.order_files
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.materials
  FOR SELECT USING (true);

-- Herkese yazma izni ver (authenticated users)
CREATE POLICY "Enable insert for all users" ON public.orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.orders
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public.orders
  FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON public.order_files
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.order_files
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public.order_files
  FOR DELETE USING (true);

CREATE POLICY "Enable insert for all users" ON public.materials
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.materials
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public.materials
  FOR DELETE USING (true);

-- ============================================
-- TRIGGERS - Otomatik updated_at güncelleme
-- ============================================

-- updated_at otomatik güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Orders tablosu için trigger
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Materials tablosu için trigger
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BAŞARILI!
-- Tüm tablolar oluşturuldu ve yapılandırıldı
-- ============================================
