-- The firm's default production lead: work orders opened automatically when a quote becomes an
-- order are assigned to this person (when not set, to the person converting).
ALTER TABLE public.manufacturing_preferences ADD COLUMN IF NOT EXISTS production_lead_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
