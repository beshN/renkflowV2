-- A firm's price matrix per product family, imported from its own CSV. One active matrix per family;
-- an import archives the previous one, which is kept so a quote can show which prices it used.
CREATE TABLE IF NOT EXISTS public.price_matrices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  family text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('TRY', 'EUR', 'USD', 'GBP')),
  status text NOT NULL CHECK (status IN ('active', 'archived')),
  file_name text,
  file_sha256 text NOT NULL,
  base_rows jsonb NOT NULL,
  option_rows jsonb NOT NULL,
  imported_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS price_matrices_active_idx ON public.price_matrices (tenant_id, family) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS price_matrices_tenant_idx ON public.price_matrices (tenant_id, family, created_at DESC);
