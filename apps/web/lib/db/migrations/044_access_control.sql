-- Access control (gece 2, Tur 1): custom roles on top of the six base roles, member deactivation,
-- session tracking and revocation, the access role carried by invitations. Only adds tables and
-- nullable/defaulted columns; no data is rewritten. Idempotent: every statement can run again.

-- A firm's own role: a base role (the hard floor every existing check keeps using) narrowed by a
-- module × action matrix and hidden fields. A custom role can never grant more than its base role.
CREATE TABLE IF NOT EXISTS public.access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  name_key text NOT NULL,
  base_role text NOT NULL CHECK (base_role IN ('admin', 'accountant', 'office', 'worker', 'member')),
  permissions jsonb NOT NULL DEFAULT '{}',
  hidden_fields text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name_key)
);

-- The member's access role: a preset key (e.g. 'sales') or a custom role id; NULL = the preset of the base role.
ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS access_role text;
-- A deactivated member keeps every record they made but can no longer sign in to the firm.
ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Tokens issued before this moment are no longer accepted ("sign out everywhere", password reset).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sessions_valid_after timestamptz;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON public.user_sessions (user_id, revoked_at, last_seen_at);

ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS access_role text;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
