ALTER TABLE public.order_technical_revisions ADD COLUMN IF NOT EXISTS source_file_id uuid REFERENCES public.production_files(id);
ALTER TABLE public.order_technical_revisions ADD COLUMN IF NOT EXISTS replaces_id uuid REFERENCES public.order_technical_revisions(id);
ALTER TABLE public.order_technical_revisions ADD COLUMN IF NOT EXISTS revision_reason text;
ALTER TABLE public.order_technical_revisions ADD COLUMN IF NOT EXISTS impact jsonb;
