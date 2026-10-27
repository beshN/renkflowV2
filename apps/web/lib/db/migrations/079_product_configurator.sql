-- Product configurator for fairs and the web (kiosk → QR → phone → quote request). Additive and idempotent.

-- Fairs are data, not code: /fair/<code> attributes designs and quote requests to one of these.
CREATE TABLE IF NOT EXISTS public.fairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  starts_on date,
  ends_on date,
  default_locale text NOT NULL DEFAULT 'en' CHECK (default_locale IN ('tr', 'en', 'de')),
  active boolean NOT NULL DEFAULT true,
  campaign text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS fairs_tenant_code_idx ON public.fairs (tenant_id, code);

-- A visitor's design behind a permanent, unguessable link (/c/<token>). No personal data here.
CREATE TABLE IF NOT EXISTS public.fair_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token text NOT NULL CHECK (token ~ '^[A-Za-z0-9_-]{22}$'),
  fair_id uuid REFERENCES public.fairs(id) ON DELETE SET NULL,
  origin text NOT NULL CHECK (origin IN ('kiosk', 'mobile', 'web')),
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('tr', 'en', 'de')),
  -- [{ id, kind, quantity, configuration | awning, options, note?, image? }]: lib/features/fair/design.ts
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fair_designs_token_idx ON public.fair_designs (token);
CREATE INDEX IF NOT EXISTS fair_designs_tenant_fair_idx ON public.fair_designs (tenant_id, fair_id, created_at DESC);

-- A quote request: the contact, the design as it was sent, and the sales status.
CREATE TABLE IF NOT EXISTS public.fair_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  number text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'quoted', 'sent', 'accepted', 'rejected')),
  design_id uuid REFERENCES public.fair_designs(id) ON DELETE SET NULL,
  fair_id uuid REFERENCES public.fairs(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  contact_name text NOT NULL CHECK (length(trim(contact_name)) BETWEEN 1 AND 200),
  email text NOT NULL,
  phone text,
  company_name text,
  location text,
  note text,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('tr', 'en', 'de')),
  privacy_notice_version text NOT NULL,
  privacy_notice_ack_at timestamptz NOT NULL,
  marketing_consent boolean NOT NULL DEFAULT false,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed', 'not_configured')),
  email_error text,
  ip_hash text,
  user_agent text,
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fair_quotes_number_idx ON public.fair_quotes (tenant_id, number);
CREATE INDEX IF NOT EXISTS fair_quotes_tenant_created_idx ON public.fair_quotes (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fair_quotes_tenant_fair_idx ON public.fair_quotes (tenant_id, fair_id);
