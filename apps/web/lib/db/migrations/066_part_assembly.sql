ALTER TABLE public.production_parts DROP CONSTRAINT IF EXISTS production_parts_state_check;
ALTER TABLE public.production_parts ADD CONSTRAINT production_parts_state_check CHECK(state IN('planned','cut','paint_waiting','paint_sent','paint_returned','assembled','scrapped'));
ALTER TABLE public.production_parts ADD COLUMN IF NOT EXISTS production_run_id uuid REFERENCES public.production_runs(id);
ALTER TABLE public.production_parts ADD COLUMN IF NOT EXISTS weight_per_meter_kg numeric CHECK(weight_per_meter_kg>0);
ALTER TABLE public.cutting_losses ALTER COLUMN weight_kg DROP NOT NULL;
