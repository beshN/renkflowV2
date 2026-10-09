-- Proactive assistant (gece 3): detectors file suggestions with an evidence pack, a priority and a
-- rule; people snooze or reject them with a reason; each firm chooses whether the assistant runs at
-- all, rules only, or with a model, and caps the model spend. Only adds columns and a table; no
-- data is rewritten. Idempotent: every statement can run again.

ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS detector text;
ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS confidence text;
ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS rule text;
ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS reject_reason text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_suggestions_priority_check') THEN
    ALTER TABLE public.ai_suggestions ADD CONSTRAINT ai_suggestions_priority_check CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_suggestions_reject_reason_check') THEN
    ALTER TABLE public.ai_suggestions ADD CONSTRAINT ai_suggestions_reject_reason_check
      CHECK (reject_reason IS NULL OR reject_reason IN ('not_relevant', 'wrong', 'already_done', 'never', 'other'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ai_suggestions_detector_idx ON public.ai_suggestions (tenant_id, kind, status, decided_at DESC);

-- One row per firm. mode: 'off' (no suggestions, no model), 'rules' (detectors only, no model call),
-- 'assist' (detectors + model for wording, commands and extraction). Turning the model on records
-- who confirmed the cross-border transfer (KVKK) and when.
CREATE TABLE IF NOT EXISTS public.ai_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'assist' CHECK (mode IN ('off', 'rules', 'assist')),
  kvkk_ack_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  kvkk_ack_at timestamptz,
  -- Model spend caps: the firm's daily cost (USD, when prices are configured) and calls per person a day.
  daily_budget_usd numeric(10, 2) CHECK (daily_budget_usd IS NULL OR daily_budget_usd >= 0),
  user_daily_calls integer NOT NULL DEFAULT 60 CHECK (user_daily_calls BETWEEN 0 AND 5000),
  -- Per detector: { enabled, quietDays, threshold... } — what "bunu X güne çek" changes.
  detectors jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Per feature on/off (morning summary, price hint, voice, data quality ...).
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- When the detectors last ran for this firm from the scheduled job (they also run when someone opens the queue).
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS detectors_ran_at timestamptz;
