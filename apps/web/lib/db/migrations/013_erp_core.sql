-- ============================================
-- RenkFlow ERP Core — Faz 1
-- Aktivite Geçmişi, Genişletilmiş Sipariş Durumları,
-- Müşteri Genişletme, Teklif ve Sevkiyat Tabloları
-- ============================================

-- 1. Activity Logs (Chatter / Audit Trail)
-- Her kayıtta (sipariş, müşteri, üretim emri) ortak aktivite akışı

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,  -- 'order' | 'customer' | 'work_order' | 'quotation' | 'shipment' | 'purchase_order'
  entity_id uuid NOT NULL,
  action text NOT NULL,       -- 'created' | 'status_changed' | 'note_added' | 'file_uploaded' | 'field_updated' | 'assigned'
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name text,            -- Snapshot - user silinse bile isim kalır
  changes jsonb DEFAULT '{}'::jsonb,  -- { field: { from, to } }
  note text,                  -- Manuel not içeriği
  metadata jsonb DEFAULT '{}'::jsonb, -- Ek bağlam (eski durum, yeni durum vb.)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON public.activity_logs(tenant_id, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor
  ON public.activity_logs(tenant_id, actor_id, created_at DESC);

-- 2. Genişletilmiş Sipariş Durumu
-- Mevcut enum: pending | in_production | delivered
-- Yeni 11 aşamalı akış (eski değerler eşleniyor)

DO $$ BEGIN
  -- Eski constraint'i kaldır
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
  -- Yeni constraint ekle (eski değerleri de içeriyor — backward compat)
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      -- Eski değerler (geriye dönük uyumluluk)
      'pending',
      'in_production',
      'delivered',
      -- Yeni genişletilmiş değerler
      'new',
      'pending_approval',
      'approved',
      'preparing_materials',
      'ready_for_production',
      'quality_check',
      'ready_for_shipment',
      'shipped',
      'completed',
      'cancelled',
      'on_hold'
    ));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Sipariş tablosuna ek alanlar
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS color text,                    -- Ürün rengi
  ADD COLUMN IF NOT EXISTS width_mm numeric(10,2),        -- Genişlik (mm)
  ADD COLUMN IF NOT EXISTS height_mm numeric(10,2),       -- Yükseklik (mm)
  ADD COLUMN IF NOT EXISTS motor_type text,               -- Motor tipi
  ADD COLUMN IF NOT EXISTS led_type text,                 -- LED tipi
  ADD COLUMN IF NOT EXISTS fabric_type text,              -- Kumaş tipi
  ADD COLUMN IF NOT EXISTS special_notes text,            -- Teknik özel notlar
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  ADD COLUMN IF NOT EXISTS shipment_status text DEFAULT 'not_shipped' CHECK (shipment_status IN ('not_shipped', 'ready', 'shipped', 'delivered'));

-- 3. Order Items Genişletme
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS width_mm numeric(10,2),
  ADD COLUMN IF NOT EXISTS height_mm numeric(10,2),
  ADD COLUMN IF NOT EXISTS motor_type text,
  ADD COLUMN IF NOT EXISTS led_type text,
  ADD COLUMN IF NOT EXISTS fabric_type text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS bom_id uuid REFERENCES public.boms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_status text DEFAULT 'not_started'
    CHECK (production_status IN ('not_started', 'in_progress', 'completed', 'on_hold'));

-- 4. Customers Tablosu Genişletme
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS tax_office text,
  ADD COLUMN IF NOT EXISTS contacts jsonb DEFAULT '[]'::jsonb,  -- [{name, phone, email, title}]
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_terms integer DEFAULT 30,  -- Gün olarak ödeme vadesi
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 5. Quotations (Teklifler)
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quotation_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  valid_until date,
  currency text DEFAULT 'TRY',
  discount_percent numeric(5,2) DEFAULT 0,
  subtotal numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) DEFAULT 0,
  notes text,
  internal_notes text,
  terms_and_conditions text,
  converted_to_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, quotation_number)
);

CREATE INDEX IF NOT EXISTS idx_quotations_tenant_status
  ON public.quotations(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_customer
  ON public.quotations(tenant_id, customer_id);

-- 6. Quotation Items (Teklif Kalemleri)
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  description text,
  color text,
  width_mm numeric(10,2),
  height_mm numeric(10,2),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  position integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation
  ON public.quotation_items(quotation_id);

-- 7. Shipments (Sevkiyat)
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shipment_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned')),
  carrier text,               -- Kargo firması / Araç plakası
  tracking_number text,
  scheduled_date date,
  actual_date date,
  delivery_address text,
  notes text,
  waybill_number text,        -- İrsaliye no
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, shipment_number)
);

CREATE INDEX IF NOT EXISTS idx_shipments_tenant_status
  ON public.shipments(tenant_id, status, scheduled_date);

-- 8. Shipment Items (Sevkiyat Kalemleri)
CREATE TABLE IF NOT EXISTS public.shipment_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment
  ON public.shipment_items(shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_items_order
  ON public.shipment_items(tenant_id, order_id);

-- 9. Suppliers (Tedarikçiler) — Genişletme
-- purchase_orders tablosunda supplier_id var ama supplier tablosu yoktu
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  contact_name text,
  phone text,
  email text,
  address text,
  tax_number text,
  tax_office text,
  payment_terms integer DEFAULT 30,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- purchase_orders tablosuna supplier foreign key ekle
DO $$ BEGIN
  ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_fk
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant
  ON public.suppliers(tenant_id, is_active);

-- 10. Documents tablosu genişletme (entity_type bazlı polimorfik ilişki)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'order'
    CHECK (entity_type IN ('order', 'customer', 'work_order', 'quotation', 'shipment', 'purchase_order', 'goods_receipt')),
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS description text;

-- 11. Eğer work_order_events tablosu varsa blocked_reason_category ekle
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS blocked_reason_category text,
  ADD COLUMN IF NOT EXISTS blocked_reason_detail text;
