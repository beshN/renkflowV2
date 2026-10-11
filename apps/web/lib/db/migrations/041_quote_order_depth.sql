-- Quote → order depth (Tur B): quote revisions, templates, firm quote settings, customer price
-- rules, customer approval links; on orders the promised date, partial deliveries, change requests
-- and payment plans. Only adds tables and nullable/defaulted columns; no data is rewritten.
-- Idempotent: every statement can run again.

-- Quotes ------------------------------------------------------------------------------------------
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS vat_percent numeric(5,2) NOT NULL DEFAULT 20;
-- One unit of the quote currency in TRY, typed by the seller (no bank feed is connected).
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS fx_rate numeric(14,6);
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS discount_approved_percent numeric(6,2);
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS discount_approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS discount_approved_at timestamptz;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS customer_decided_at timestamptz;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS customer_decision_name text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS customer_decision_ip text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS customer_decision_agent text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS customer_decision_note text;

CREATE TABLE IF NOT EXISTS public.quotation_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  status text NOT NULL,
  snapshot jsonb NOT NULL,
  reason text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quotation_id, revision)
);
CREATE INDEX IF NOT EXISTS quotation_revisions_tenant_idx ON public.quotation_revisions (tenant_id, quotation_id);

CREATE TABLE IF NOT EXISTS public.quote_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  discount_approval_percent numeric(5,2) NOT NULL DEFAULT 10 CHECK (discount_approval_percent BETWEEN 0 AND 100),
  default_valid_days integer NOT NULL DEFAULT 15 CHECK (default_valid_days BETWEEN 1 AND 365),
  default_vat_percent numeric(5,2) NOT NULL DEFAULT 20 CHECK (default_vat_percent BETWEEN 0 AND 100),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  name_key text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  notes text,
  terms text,
  vat_percent numeric(5,2),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name_key)
);

-- A customer's standing discount, for one product family or (family NULL) for everything.
CREATE TABLE IF NOT EXISTS public.customer_price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  family text,
  discount_percent numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_price_rules_unique ON public.customer_price_rules (tenant_id, customer_id, coalesce(family, ''));

CREATE TABLE IF NOT EXISTS public.quotation_approval_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  used_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotation_approval_links_quote_idx ON public.quotation_approval_links (tenant_id, quotation_id);

-- Orders ------------------------------------------------------------------------------------------
-- The date promised to the customer (frozen at approval) and the day it was actually delivered.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promised_date date;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_on date;

CREATE TABLE IF NOT EXISTS public.order_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  delivered_on date NOT NULL,
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_deliveries_order_idx ON public.order_deliveries (tenant_id, order_id);

CREATE TABLE IF NOT EXISTS public.order_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  changes jsonb NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  impact jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text
);
CREATE INDEX IF NOT EXISTS order_change_requests_order_idx ON public.order_change_requests (tenant_id, order_id, created_at);

CREATE TABLE IF NOT EXISTS public.order_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seq integer NOT NULL CHECK (seq > 0),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  due_on date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, seq)
);
CREATE INDEX IF NOT EXISTS order_payment_plans_tenant_idx ON public.order_payment_plans (tenant_id, order_id);
