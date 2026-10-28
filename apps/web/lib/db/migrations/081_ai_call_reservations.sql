-- Atomic AI budget / daily call limits (audit S-06). Additive and idempotent.
--
-- Before a model call the gate takes a per-firm advisory lock, re-checks the firm's daily budget
-- and the person's daily calls (finished ai_usage rows + live reservations) and inserts one row
-- here with the call's maximum estimated cost. When the call ends its real usage is written to
-- ai_usage and the reservation is deleted. A reservation whose process died stops counting at
-- expires_at (a few minutes) and is cleaned up by later reservations of the same firm.
CREATE TABLE IF NOT EXISTS public.ai_call_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  feature text,
  model text,
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_call_reservations_tenant_expires_idx ON public.ai_call_reservations (tenant_id, expires_at);
