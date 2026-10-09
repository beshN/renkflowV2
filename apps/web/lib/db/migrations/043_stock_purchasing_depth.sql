-- Stock and purchasing depth (Tur D): reorder policy per item (maximum, lead time, order multiple)
-- and requests for quotation to suppliers with their answers. Only adds defaulted/nullable columns and
-- tables. Idempotent: every statement can run again.

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS max_stock numeric(14,3) CHECK (max_stock IS NULL OR max_stock >= 0);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days BETWEEN 0 AND 365);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS order_multiple numeric(14,3) CHECK (order_multiple IS NULL OR order_multiple > 0);

CREATE TABLE IF NOT EXISTS public.purchase_rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_number text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'awarded', 'cancelled')),
  due_on date,
  currency text NOT NULL DEFAULT 'TRY' CHECK (currency IN ('TRY', 'EUR', 'USD', 'GBP')),
  notes text,
  supplier_ids uuid[] NOT NULL DEFAULT '{}',
  awarded_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, rfq_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_rfq_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES public.purchase_rfqs(id) ON DELETE CASCADE,
  position integer NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  length_mm integer CHECK (length_mm IS NULL OR length_mm BETWEEN 100 AND 30000),
  color text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS purchase_rfq_lines_rfq_idx ON public.purchase_rfq_lines (tenant_id, rfq_id);

CREATE TABLE IF NOT EXISTS public.purchase_rfq_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES public.purchase_rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days BETWEEN 0 AND 365),
  valid_until date,
  -- [{ lineId, unitPrice }] in the request's currency; a line left out is not offered.
  prices jsonb NOT NULL DEFAULT '[]',
  note text,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, supplier_id)
);
