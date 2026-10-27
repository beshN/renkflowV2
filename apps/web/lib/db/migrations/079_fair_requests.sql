-- Fair configurator (QR → 3D product → contact → price): each visitor submission opens a lead with
-- source 'fair' and keeps the configured products beside it. Additive and idempotent.
CREATE TABLE IF NOT EXISTS public.fair_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  event text,
  -- [{ configuration, image?, quantity, note? }]: the visualization schema of product-3d/catalog.ts.
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  contact_name text NOT NULL CHECK (length(trim(contact_name)) BETWEEN 1 AND 200),
  company_name text,
  phone text NOT NULL,
  email text,
  city text,
  note text,
  privacy_notice_version text NOT NULL,
  privacy_notice_ack_at timestamptz NOT NULL,
  marketing_consent boolean NOT NULL DEFAULT false,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fair_requests_tenant_created_idx ON public.fair_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fair_requests_lead_idx ON public.fair_requests (tenant_id, lead_id);
