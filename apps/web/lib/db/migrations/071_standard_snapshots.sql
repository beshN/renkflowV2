ALTER TABLE public.order_technical_revisions ADD COLUMN IF NOT EXISTS standard_configurations jsonb NOT NULL DEFAULT '[]';
