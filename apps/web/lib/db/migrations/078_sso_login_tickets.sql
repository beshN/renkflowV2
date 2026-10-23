-- Login tickets are not e-mail-verification tokens. Keep only hashes, expire quickly and bind
-- each ticket to the authenticating browser, exact host and the SSO provider's company.
CREATE TABLE IF NOT EXISTS public.auth_login_tickets (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  browser_hash text NOT NULL CHECK (browser_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  host text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS auth_login_tickets_expiry_idx ON public.auth_login_tickets(expires_at);
