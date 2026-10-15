-- Existing jobs stay under their existing workflow; only new quote files require technical release.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS technical_file_required boolean NOT NULL DEFAULT false;
