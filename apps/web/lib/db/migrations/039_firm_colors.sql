-- The firm's colour catalogue: the colours it quotes in, in its own order. Stock only says whether
-- a colour is on the shelf; it does not limit what can be quoted.
CREATE TABLE IF NOT EXISTS public.firm_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS firm_colors_name_idx ON public.firm_colors (tenant_id, lower(trim(name)));
CREATE INDEX IF NOT EXISTS firm_colors_order_idx ON public.firm_colors (tenant_id, position);
