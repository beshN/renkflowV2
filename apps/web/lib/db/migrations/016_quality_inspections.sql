ALTER TABLE public.production_operations ADD COLUMN IF NOT EXISTS quality_checks jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.production_operations ADD COLUMN IF NOT EXISTS planning_baseline_seconds numeric NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.quality_inspections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE RESTRICT,
  operation_id uuid NOT NULL REFERENCES public.production_operations(id) ON DELETE RESTRICT,
  attempt integer NOT NULL,
  quantity numeric(18,6) NOT NULL CHECK(quantity>0),
  passed boolean NOT NULL,
  results jsonb NOT NULL,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  inspector_id uuid REFERENCES public.users(id),
  command_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,command_id)
);
CREATE INDEX IF NOT EXISTS idx_quality_job ON public.quality_inspections(tenant_id,work_order_id,created_at DESC);
