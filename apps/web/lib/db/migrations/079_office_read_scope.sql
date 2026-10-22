-- Files can contain data from every module the creator could read. Retain that scope so
-- subsequent role narrowing cannot expose older, unredactable outputs.
ALTER TABLE public.office_tasks ADD COLUMN IF NOT EXISTS access_scope jsonb;
