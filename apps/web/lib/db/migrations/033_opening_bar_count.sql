-- Bar-by-bar opening count of a count-list profile line: what was entered, by whom and when, and the
-- stock entry it wrote, to compare with the metres the list printed. (A profile counted without a
-- list line is recorded only by its stock entry: source opening count, who, when.)
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS counted_meters numeric(18, 6);
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS counted_bars integer;
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS counted_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS counted_at timestamptz;
ALTER TABLE public.stock_count_lines ADD COLUMN IF NOT EXISTS stock_entry_id uuid REFERENCES public.stock_entries(id);
