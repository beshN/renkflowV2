ALTER TABLE public.production_recipes ADD COLUMN IF NOT EXISTS geometry text NOT NULL DEFAULT 'roof' CHECK(geometry IN('roof','vertical'));
ALTER TABLE public.production_recipes ADD COLUMN IF NOT EXISTS verification_source text;
CREATE OR REPLACE FUNCTION public.protect_published_recipe() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('published','archived') AND
   ROW(NEW.code,NEW.name,NEW.version,NEW.finished_item_id,NEW.rules,NEW.operations,NEW.limits,NEW.examples,NEW.parameter_definitions,NEW.constraints,NEW.geometry,NEW.verification_source)
   IS DISTINCT FROM ROW(OLD.code,OLD.name,OLD.version,OLD.finished_item_id,OLD.rules,OLD.operations,OLD.limits,OLD.examples,OLD.parameter_definitions,OLD.constraints,OLD.geometry,OLD.verification_source)
 THEN RAISE EXCEPTION 'Published recipe definitions are immutable'; END IF;
 RETURN NEW;
END $$;
