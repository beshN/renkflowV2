-- Matches night-2 migration 044; mobile adds no changes to the web auth implementation.
CREATE TABLE IF NOT EXISTS public.user_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE, user_agent text,
 created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz, revoked_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS public.mobile_sessions (
 id uuid PRIMARY KEY REFERENCES user_sessions(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 device_id uuid NOT NULL, platform text NOT NULL CHECK(platform IN('android','ios')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_sessions_owner ON mobile_sessions(tenant_id,user_id,device_id);
CREATE TABLE IF NOT EXISTS public.mobile_refresh_tokens (
 token_hash text PRIMARY KEY, session_id uuid NOT NULL REFERENCES mobile_sessions(id) ON DELETE CASCADE,
 consumed_at timestamptz, request_id uuid, replay_cipher text, replay_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_refresh_session ON mobile_refresh_tokens(session_id);
