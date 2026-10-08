-- Stock counts taken from a printed count list (or entered by hand later). A document is imported
-- once; its lines keep what the list said, which item they became and whether stock was written.
CREATE TABLE IF NOT EXISTS public.stock_count_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text,
  count_date date,
  file_name text,
  file_sha256 text NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  suggestion_id uuid REFERENCES public.ai_suggestions(id) ON DELETE SET NULL,
  stock_entry_id uuid REFERENCES public.stock_entries(id),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, file_sha256)
);

CREATE TABLE IF NOT EXISTS public.stock_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.stock_count_documents(id) ON DELETE CASCADE,
  ref text NOT NULL,
  section text,
  code text,
  name text NOT NULL,
  size_label text,
  color text,
  processed_states text[] NOT NULL DEFAULT '{}',
  quantity numeric(18, 6),
  unit text,
  piece_length_mm integer,
  weight_per_meter_kg numeric(18, 6),
  weight_kg numeric(18, 6),
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_id uuid REFERENCES public.inventory_items(id),
  -- applied: stock written · needs_bars: metres listed, bars to be counted · uncertain: not applied,
  -- list was not clear · skipped: not applied for the reason in note · counted: bars entered later.
  status text NOT NULL CHECK (status IN ('applied', 'needs_bars', 'uncertain', 'skipped', 'counted')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, ref)
);
CREATE INDEX IF NOT EXISTS stock_count_lines_open_idx ON public.stock_count_lines (tenant_id, status);
