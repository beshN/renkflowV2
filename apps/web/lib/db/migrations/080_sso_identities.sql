-- SSO accounts are bound to the identity provider's subject, not found by e-mail alone. Additive and idempotent.

-- One row per external account: (provider, subject) belongs to exactly one user, and a user has at
-- most one subject per provider. Written on the first successful SSO login (lib/features/auth/sso.ts).
CREATE TABLE IF NOT EXISTS public.sso_identities (
  provider_id uuid NOT NULL,
  subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT sso_identities_pkey PRIMARY KEY (provider_id, subject),
  CONSTRAINT sso_identities_provider_user UNIQUE (provider_id, user_id)
);
CREATE INDEX IF NOT EXISTS sso_identities_user ON public.sso_identities(user_id);

-- sso_providers comes from 0005_add_integrations.sql (deploy bootstrap); a database without it gets
-- the table above, and the foreign key and the flag below once it is there and this file reruns.
DO $$
BEGIN
  IF to_regclass('public.sso_providers') IS NOT NULL THEN
    -- The IdP verifies every e-mail it sends, so a login without `email_verified` is accepted.
    -- Off by default: such a login then needs an address in the provider's domain_restrictions.
    ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS trust_idp_email boolean NOT NULL DEFAULT false;
    BEGIN
      ALTER TABLE public.sso_identities
        ADD CONSTRAINT sso_identities_provider_fk FOREIGN KEY (provider_id) REFERENCES public.sso_providers(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
