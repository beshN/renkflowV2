-- Sales-to-service chain (gece 2, Tur 2): leads, site surveys, installations with a customer
-- sign-off link, and service/warranty tickets. Only adds tables, indexes and nullable columns; no
-- data is rewritten. Idempotent: every statement can run again.

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_number text NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  contact_name text NOT NULL CHECK (length(trim(contact_name)) BETWEEN 1 AND 200),
  company_name text,
  phone text,
  email text,
  address text,
  source text NOT NULL DEFAULT 'other' CHECK (source IN ('referral', 'web', 'phone', 'showroom', 'fair', 'social', 'dealer', 'other')),
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'survey', 'quoted', 'negotiation', 'won', 'lost')),
  lost_reason text CHECK (lost_reason IS NULL OR lost_reason IN ('price', 'competitor', 'timing', 'no_answer', 'postponed', 'not_feasible', 'other')),
  lost_note text,
  product_family text,
  estimated_value numeric(14,2) CHECK (estimated_value IS NULL OR estimated_value >= 0),
  owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  next_follow_up date,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  closed_at timestamptz,
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lead_number)
);
CREATE INDEX IF NOT EXISTS leads_tenant_stage_idx ON public.leads (tenant_id, stage, updated_at DESC);

-- A survey (keşif / ölçü) for a lead; the measures are kept as the family's form fields.
CREATE TABLE IF NOT EXISTS public.site_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  address text,
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'cancelled')),
  product_family text,
  measures jsonb NOT NULL DEFAULT '{}',
  -- The measures as they were when the quote was made: a later change is shown as a difference.
  measures_at_quote jsonb,
  quoted_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_surveys_lead_idx ON public.site_surveys (tenant_id, lead_id);
CREATE INDEX IF NOT EXISTS site_surveys_day_idx ON public.site_surveys (tenant_id, scheduled_at);

CREATE TABLE IF NOT EXISTS public.installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  installation_number text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  crew uuid[] NOT NULL DEFAULT '{}',
  crew_name text,
  scheduled_date date,
  start_time text CHECK (start_time IS NULL OR start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_minutes integer NOT NULL DEFAULT 240 CHECK (duration_minutes BETWEEN 15 AND 1440),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done', 'cancelled')),
  address text,
  -- Missing parts and damage noted on site: [{ kind: 'missing'|'damage', text, at, by }]
  issues jsonb NOT NULL DEFAULT '[]',
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  signoff_token_hash text,
  signoff_expires_at timestamptz,
  signed_name text,
  signed_at timestamptz,
  signed_ip text,
  signed_note text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, installation_number)
);
CREATE INDEX IF NOT EXISTS installations_day_idx ON public.installations (tenant_id, scheduled_date);
CREATE INDEX IF NOT EXISTS installations_order_idx ON public.installations (tenant_id, order_id);
CREATE UNIQUE INDEX IF NOT EXISTS installations_signoff_idx ON public.installations (signoff_token_hash) WHERE signoff_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.service_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_number text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  installation_id uuid REFERENCES public.installations(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('leak', 'motor', 'fabric', 'led', 'mechanical', 'paint', 'glass', 'other')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  product_family text,
  -- Warranty as judged when the ticket was opened (the delivery day and the firm's warranty months).
  in_warranty boolean NOT NULL DEFAULT false,
  warranty_ends_on date,
  -- Parts used: [{ name, quantity, itemId? }]
  parts jsonb NOT NULL DEFAULT '[]',
  labor_minutes integer NOT NULL DEFAULT 0 CHECK (labor_minutes >= 0),
  resolution text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ticket_number)
);
CREATE INDEX IF NOT EXISTS service_tickets_status_idx ON public.service_tickets (tenant_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS service_tickets_order_idx ON public.service_tickets (tenant_id, order_id);

-- The firm's warranty length for service tickets (months from the delivery day).
CREATE TABLE IF NOT EXISTS public.service_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  warranty_months integer NOT NULL DEFAULT 24 CHECK (warranty_months BETWEEN 0 AND 240),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
