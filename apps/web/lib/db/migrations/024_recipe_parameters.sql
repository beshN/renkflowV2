ALTER TABLE public.production_recipes
 ADD COLUMN IF NOT EXISTS parameter_definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS edit_revision integer NOT NULL DEFAULT 1 CHECK(edit_revision>0);
ALTER TABLE public.production_operations ADD COLUMN IF NOT EXISTS setup_minutes numeric NOT NULL DEFAULT 0 CHECK(setup_minutes>=0);
CREATE OR REPLACE FUNCTION public.protect_published_recipe() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('published','archived') AND
   ROW(NEW.code,NEW.name,NEW.version,NEW.finished_item_id,NEW.rules,NEW.operations,NEW.limits,NEW.examples,NEW.parameter_definitions,NEW.constraints)
   IS DISTINCT FROM ROW(OLD.code,OLD.name,OLD.version,OLD.finished_item_id,OLD.rules,OLD.operations,OLD.limits,OLD.examples,OLD.parameter_definitions,OLD.constraints)
 THEN RAISE EXCEPTION 'Published recipe definitions are immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_published_recipe ON public.production_recipes;
CREATE TRIGGER protect_published_recipe BEFORE UPDATE ON public.production_recipes FOR EACH ROW EXECUTE FUNCTION public.protect_published_recipe();
