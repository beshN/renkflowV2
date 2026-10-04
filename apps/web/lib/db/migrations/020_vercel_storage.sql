-- Preserve existing SQL-backed files while new files use private Vercel Blob.
ALTER TABLE public.production_files ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.production_files ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE public.production_files ALTER COLUMN body DROP NOT NULL;
UPDATE public.production_files SET size_bytes=octet_length(body) WHERE size_bytes IS NULL AND body IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS production_files_storage_path_unique ON public.production_files(file_path) WHERE file_path IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='production_files_has_content') THEN
  ALTER TABLE public.production_files ADD CONSTRAINT production_files_has_content CHECK(body IS NOT NULL OR file_path IS NOT NULL);
 END IF;
END $$;

-- Durable sweep cursor prevents abandoned direct uploads from accumulating indefinitely.
CREATE TABLE IF NOT EXISTS public.storage_sweep_state (
 id integer PRIMARY KEY CHECK(id=1), cursor text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.storage_sweep_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
