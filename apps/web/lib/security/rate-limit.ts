import 'server-only';
import { createHash } from 'node:crypto';
import { getSql } from '@/lib/db';

/**
 * Shared fixed-window rate limiter.
 *
 * Counters live in PostgreSQL (`rate_limit_buckets`, migration 028) so every
 * serverless instance sees the same totals. If the database is unreachable or the
 * migration has not run yet, the limiter degrades to a per-instance memory window
 * instead of failing the request.
 */

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export const RATE_LIMIT_POLICIES = {
  loginIp: { limit: 30, windowMs: 10 * 60_000 },
  loginAccount: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 15 * 60_000 },
  verificationEmail: { limit: 5, windowMs: 15 * 60_000 },
  contact: { limit: 10, windowMs: 15 * 60_000 },
  subscribe: { limit: 5, windowMs: 60 * 60_000 },
  exportCreate: { limit: 20, windowMs: 60 * 60_000 },
  exportRead: { limit: 600, windowMs: 60 * 60_000 },
  assistant: { limit: 20, windowMs: 60_000 },
} satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const MEMORY_MAX_KEYS = 5_000;
const memoryWindows = new Map<string, { windowStart: number; hits: number }>();
let warnedFallback = false;

function bucketKey(policy: RateLimitPolicyName, subject: string) {
  const digest = createHash('sha256').update(subject.trim().toLowerCase()).digest('hex');
  return `${policy}:${digest}`;
}

function evaluate(policy: RateLimitPolicy, hits: number, windowStart: number, now: number): RateLimitResult {
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + policy.windowMs - now) / 1000));
  return {
    allowed: hits <= policy.limit,
    remaining: Math.max(0, policy.limit - hits),
    retryAfterSeconds,
  };
}

function consumeMemory(key: string, windowStart: number) {
  const current = memoryWindows.get(key);
  if (current && current.windowStart === windowStart) {
    current.hits += 1;
    return current.hits;
  }
  if (memoryWindows.size >= MEMORY_MAX_KEYS) {
    for (const [candidate, value] of memoryWindows) {
      if (value.windowStart < windowStart) memoryWindows.delete(candidate);
    }
    if (memoryWindows.size >= MEMORY_MAX_KEYS) memoryWindows.clear();
  }
  memoryWindows.set(key, { windowStart, hits: 1 });
  return 1;
}

function warnFallback(error: unknown) {
  if (warnedFallback) return;
  warnedFallback = true;
  console.warn(
    '[rate-limit] Shared store unavailable; using per-instance memory windows.',
    error instanceof Error ? error.message : 'unknown error',
  );
}

/** Counts one attempt for `subject` under `policyName` and reports whether it is allowed. */
export async function consumeRateLimit(policyName: RateLimitPolicyName, subject: string): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const key = bucketKey(policyName, subject || 'unknown');
  const now = Date.now();
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;

  try {
    const sql = getSql();
    const rows = await sql`
      INSERT INTO rate_limit_buckets (bucket_key, window_start, hits, expires_at)
      VALUES (${key}, ${new Date(windowStart)}, 1, ${new Date(windowStart + policy.windowMs)})
      ON CONFLICT (bucket_key) DO UPDATE SET
        hits = CASE WHEN rate_limit_buckets.window_start = EXCLUDED.window_start
          THEN rate_limit_buckets.hits + 1 ELSE 1 END,
        window_start = EXCLUDED.window_start,
        expires_at = EXCLUDED.expires_at
      RETURNING hits
    `;
    const hits = Number((rows as Array<{ hits: number }>)[0]?.hits ?? 1);
    return evaluate(policy, hits, windowStart, now);
  } catch (error) {
    warnFallback(error);
    return evaluate(policy, consumeMemory(key, windowStart), windowStart, now);
  }
}

/** Clears the counter for `subject`, e.g. after a successful login. */
export async function resetRateLimit(policyName: RateLimitPolicyName, subject: string): Promise<void> {
  const key = bucketKey(policyName, subject || 'unknown');
  memoryWindows.delete(key);
  try {
    const sql = getSql();
    await sql`DELETE FROM rate_limit_buckets WHERE bucket_key = ${key}`;
  } catch (error) {
    warnFallback(error);
  }
}

/** Removes expired counters; called from the storage-cleanup cron. */
export async function pruneRateLimitBuckets(): Promise<number> {
  try {
    const sql = getSql();
    const rows = await sql`DELETE FROM rate_limit_buckets WHERE expires_at < now() RETURNING 1`;
    return (rows as unknown[]).length;
  } catch (error) {
    warnFallback(error);
    return 0;
  }
}

type HeaderSource = Headers | { get(name: string): string | null };

/**
 * Client IP as reported by the Vercel edge. Vercel overwrites `x-real-ip` and
 * `x-forwarded-for`, so client-supplied values cannot spoof the limiter there.
 */
export function getClientIp(headers: HeaderSource): string {
  const first = (value: string | null) => value?.split(',')[0]?.trim() || '';
  return (
    first(headers.get('x-real-ip')) ||
    first(headers.get('x-vercel-forwarded-for')) ||
    first(headers.get('x-forwarded-for')) ||
    'unknown'
  );
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'Retry-After': String(result.retryAfterSeconds),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.retryAfterSeconds),
  };
}

export function rateLimitResponse(
  result: RateLimitResult,
  message = 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyip tekrar deneyin.',
): Response {
  return Response.json(
    { success: false, error: message, retryAfter: result.retryAfterSeconds },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}
