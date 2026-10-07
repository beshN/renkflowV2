-- The firm's standard bar length, used to size purchases when stock cannot cover a cutting plan.
-- 6000 mm is the engine's existing default; each profile's own standard length (inventory_items)
-- takes precedence when it is set.
ALTER TABLE public.manufacturing_preferences
  ADD COLUMN IF NOT EXISTS standard_length_mm numeric NOT NULL DEFAULT 6000 CHECK (standard_length_mm > 0);
