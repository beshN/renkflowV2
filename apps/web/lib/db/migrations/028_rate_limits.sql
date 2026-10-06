-- Shared fixed-window rate limit counters. Serverless instances do not share memory,
-- so abuse limits must live in the database. Keys are SHA-256 hashes, never raw IPs or emails.
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
 bucket_key text PRIMARY KEY,
 window_start timestamptz NOT NULL,
 hits integer NOT NULL DEFAULT 1 CHECK(hits >= 0),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_idx ON public.rate_limit_buckets(expires_at);
