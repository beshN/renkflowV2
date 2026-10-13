-- Two-step sign-in (TOTP). One row per user; the secret is sealed by lib/security/secret-box.ts.
-- enabled_at stays NULL until the first code is confirmed, so an abandoned set-up never applies.
CREATE TABLE IF NOT EXISTS public.user_mfa (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  secret_sealed text NOT NULL,
  enabled_at timestamptz,
  -- Highest TOTP step accepted so far: a code is valid once.
  last_used_step bigint,
  -- SHA-256 of each unused recovery code; a used code is removed.
  recovery_code_hashes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
