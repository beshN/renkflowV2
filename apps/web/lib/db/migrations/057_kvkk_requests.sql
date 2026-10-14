-- KVKK m.11/m.13: requests from data subjects (the firm's customers and leads) and their 30-day
-- answer deadline. The register itself is the evidence that each request was answered in time.
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('access', 'rectification', 'erasure', 'objection', 'other')),
  subject_name text NOT NULL CHECK (length(trim(subject_name)) BETWEEN 1 AND 200),
  subject_contact text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  details text,
  received_on date NOT NULL,
  -- KVKK m.13/2: answered within 30 days at the latest.
  due_on date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'rejected')),
  resolution text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_on >= received_on),
  CHECK (status = 'open' OR (closed_at IS NOT NULL AND resolution IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS data_subject_requests_open_idx ON public.data_subject_requests (tenant_id, status, due_on);

-- When a customer's personal data was erased (anonymised), so it is not filled in again by mistake.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
