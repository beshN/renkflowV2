ALTER TABLE public.quality_inspections ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.production_rework
 ADD COLUMN IF NOT EXISTS inspection_id uuid REFERENCES public.quality_inspections(id),
 ADD COLUMN IF NOT EXISTS root_cause text,
 ADD COLUMN IF NOT EXISTS root_cause_status text NOT NULL DEFAULT 'unconfirmed' CHECK(root_cause_status IN('confirmed','unconfirmed','unknown')),
 ADD COLUMN IF NOT EXISTS resolution text,
 ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open' CHECK(status IN('open','resolved')),
 ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS cost_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS extra_labor_seconds numeric NOT NULL DEFAULT 0 CHECK(extra_labor_seconds>=0),
 ADD COLUMN IF NOT EXISTS labor_method text,
 ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.users(id),
 ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.manufacturing_preferences
 ADD COLUMN IF NOT EXISTS quality_revision integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS labor_cost_per_hour numeric CHECK(labor_cost_per_hour>=0),
 ADD COLUMN IF NOT EXISTS labor_currency text CHECK(labor_currency IN('TRY','EUR','USD','GBP'));
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS currency text CHECK(currency IN('TRY','EUR','USD','GBP'));
CREATE TABLE IF NOT EXISTS public.work_order_material_lots (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 work_order_id uuid NOT NULL REFERENCES public.work_orders(id),rework_id uuid REFERENCES public.production_rework(id),
 item_id uuid NOT NULL REFERENCES public.inventory_items(id),lot_id uuid REFERENCES public.stock_lots(id),
 quantity numeric NOT NULL CHECK(quantity>0),uom text NOT NULL,unit_cost numeric,currency text,
 method text NOT NULL CHECK(method IN('physical_lot','legacy_untracked')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS material_lots_trace ON public.work_order_material_lots(tenant_id,work_order_id);
CREATE INDEX IF NOT EXISTS rework_quality_history ON public.production_rework(tenant_id,created_at,work_order_id);
CREATE OR REPLACE FUNCTION public.protect_quality_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Quality evidence is immutable; record another inspection'; END $$;
DROP TRIGGER IF EXISTS protect_quality_evidence ON public.quality_inspections;
CREATE TRIGGER protect_quality_evidence BEFORE UPDATE OR DELETE ON public.quality_inspections FOR EACH ROW EXECUTE FUNCTION public.protect_quality_evidence();
