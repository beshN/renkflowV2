-- Production depth (Tur C): the firm's own reason codes for scrap, rework and delay; scrap and delay
-- records on work orders; the bar lengths the firm can buy. Only adds tables and defaulted columns.
-- Idempotent: every statement can run again.

CREATE TABLE IF NOT EXISTS public.production_reason_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('scrap', 'rework', 'delay')),
  code text NOT NULL CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, code)
);

CREATE TABLE IF NOT EXISTS public.production_scrap_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  operation_id uuid REFERENCES public.production_operations(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  length_mm numeric(10,1) CHECK (length_mm IS NULL OR length_mm > 0),
  reason_code text NOT NULL,
  note text,
  photos jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS production_scrap_events_tenant_idx ON public.production_scrap_events (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS production_scrap_events_job_idx ON public.production_scrap_events (tenant_id, work_order_id);

CREATE TABLE IF NOT EXISTS public.production_delays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  reason_code text NOT NULL,
  note text,
  expected_until date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS production_delays_tenant_idx ON public.production_delays (tenant_id, created_at);
-- At most one open delay per work order.
CREATE UNIQUE INDEX IF NOT EXISTS production_delays_open_unique ON public.production_delays (tenant_id, work_order_id) WHERE resolved_at IS NULL;

-- Bar lengths the firm can buy, for purchase sizing (the standard length stays the default).
ALTER TABLE public.manufacturing_preferences ADD COLUMN IF NOT EXISTS bar_length_options_mm integer[] NOT NULL DEFAULT '{}';
