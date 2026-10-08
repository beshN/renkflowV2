-- Bar-by-bar opening count of profile stock: what was entered for a count-list line (or for an item
-- with no line), compared with the metres the list printed.
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS counted_meters numeric(18, 6);
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS counted_bars integer;
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS counted_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS counted_at timestamptz;
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS stock_entry_id uuid REFERENCES public.stock_entries(id);
