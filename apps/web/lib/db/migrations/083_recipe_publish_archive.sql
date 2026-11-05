-- Additive only: report legacy conflicts; never repair or archive existing data.
DO $$
DECLARE
  conflict record;
  conflicts integer := 0;
BEGIN
  -- Keep the preflight and index creation consistent with concurrent writers.
  LOCK TABLE public.production_recipes IN SHARE MODE;
  FOR conflict IN
    SELECT tenant_id, code, count(*) AS published_count
    FROM public.production_recipes WHERE status = 'published'
    GROUP BY tenant_id, code HAVING count(*) > 1
  LOOP
    conflicts := conflicts + 1;
    RAISE WARNING 'Published recipe conflict: tenant_id=%, code=%, count=%',
      conflict.tenant_id, conflict.code, conflict.published_count;
  END LOOP;
  IF conflicts > 0 THEN
    RAISE WARNING 'Skipping production_recipes_one_published_per_code: % conflicting tenant/code groups; data unchanged', conflicts;
  ELSE
    RAISE NOTICE 'No published recipe conflicts; ensuring partial unique index';
    CREATE UNIQUE INDEX IF NOT EXISTS production_recipes_one_published_per_code
      ON public.production_recipes (tenant_id, code) WHERE status = 'published';
  END IF;
END $$;
