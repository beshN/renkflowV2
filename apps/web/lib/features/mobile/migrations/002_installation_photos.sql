-- Optional installation photo target; main can install this before the night-2 installation tables.
ALTER TABLE public.mobile_uploads ALTER COLUMN work_order_id DROP NOT NULL;
ALTER TABLE public.mobile_uploads ADD COLUMN IF NOT EXISTS installation_id uuid;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='mobile_upload_entity_one') THEN
    ALTER TABLE public.mobile_uploads ADD CONSTRAINT mobile_upload_entity_one CHECK ((work_order_id IS NOT NULL)::int + (installation_id IS NOT NULL)::int=1);
  END IF;
  IF to_regclass('public.installations') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='mobile_upload_installation_fk') THEN
    ALTER TABLE public.mobile_uploads ADD CONSTRAINT mobile_upload_installation_fk FOREIGN KEY(installation_id) REFERENCES public.installations(id) ON DELETE CASCADE;
  END IF;
END $$;
