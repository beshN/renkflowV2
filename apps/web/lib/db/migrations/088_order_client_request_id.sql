-- Additive: legacy orders and callers without a request key remain valid.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_request_id uuid,
  ADD COLUMN IF NOT EXISTS client_request_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_client_request_id_unique
  ON public.orders (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
