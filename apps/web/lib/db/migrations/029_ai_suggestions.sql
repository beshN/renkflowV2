-- Approval-gated assistant suggestions, correction examples and model usage (cost) records.
-- The assistant never writes, deletes or sends anything itself: it files a suggestion here and a
-- person approves, rejects or edits it. Approval runs the suggestion kind's own domain command.
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'failed', 'expired')),
  title text NOT NULL,
  rationale text NOT NULL,
  payload jsonb NOT NULL,
  affected jsonb NOT NULL DEFAULT '[]'::jsonb,
  uncertain boolean NOT NULL DEFAULT false,
  uncertainty_note text,
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'model')),
  model text,
  dedupe_key text,
  edited boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  result jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text
);
CREATE INDEX IF NOT EXISTS ai_suggestions_tenant_status_idx ON public.ai_suggestions (tenant_id, status, created_at DESC);
-- The same underlying situation yields one open suggestion, not one per run.
CREATE UNIQUE INDEX IF NOT EXISTS ai_suggestions_open_dedupe_idx ON public.ai_suggestions (tenant_id, kind, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status = 'pending';

-- A person's correction of a suggestion, kept as a labelled example for evals/.
CREATE TABLE IF NOT EXISTS public.ai_feedback_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  suggestion_id uuid NOT NULL REFERENCES public.ai_suggestions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  original_payload jsonb NOT NULL,
  corrected_payload jsonb NOT NULL,
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_feedback_examples_kind_idx ON public.ai_feedback_examples (kind, created_at DESC);

-- One row per model request: tokens, latency, cost (when a price is configured) and outcome.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(12, 6),
  latency_ms integer NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'error')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_tenant_created_idx ON public.ai_usage (tenant_id, created_at DESC);
