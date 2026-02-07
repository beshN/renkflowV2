-- Order QR Actions tokens
CREATE TABLE IF NOT EXISTS public.order_qr_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  label text,
  allowed_actions jsonb NOT NULL,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_qr_tokens_token_length_check CHECK (char_length(token) >= 32),
  CONSTRAINT order_qr_tokens_allowed_actions_array_check CHECK (jsonb_typeof(allowed_actions) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_order_qr_tokens_tenant_id ON public.order_qr_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_qr_tokens_order_id ON public.order_qr_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_order_qr_tokens_token ON public.order_qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_order_qr_tokens_active ON public.order_qr_tokens(active);

CREATE INDEX IF NOT EXISTS idx_order_qr_tokens_tenant_order_active
  ON public.order_qr_tokens(tenant_id, order_id, active);
