ALTER TABLE public.production_shipments ADD COLUMN IF NOT EXISTS technical_revision_id uuid REFERENCES public.order_technical_revisions(id);
ALTER TABLE public.production_shipments ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.production_shipments ADD COLUMN IF NOT EXISTS loading_checklist jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.production_shipments ADD COLUMN IF NOT EXISTS vehicle_plate text;
ALTER TABLE public.production_shipments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS generated_from_revision_id uuid REFERENCES public.order_technical_revisions(id);
CREATE UNIQUE INDEX IF NOT EXISTS installations_generated_order ON public.installations(tenant_id,order_id) WHERE generated_from_revision_id IS NOT NULL AND status<>'cancelled';
