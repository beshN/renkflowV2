ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS template_key text DEFAULT 'mobilya';
