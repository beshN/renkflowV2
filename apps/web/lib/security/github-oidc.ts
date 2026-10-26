import 'server-only';
import { createPublicKey, verify, type KeyObject } from 'node:crypto';

/**
 * Verifies GitHub Actions OIDC tokens sent by `.github/workflows/cron.yml`, so the background-queue
 * workflow can call the cron routes without any repository secret. A token is accepted only when it
 * is an RS256 JWT signed by a key from GitHub's JWKS and every claim below matches exactly: issuer,
 * audience, lifetime, repository, branch, workflow file and trigger event. Anything else is rejected.
 */

export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const GITHUB_OIDC_JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
export const CRON_OIDC_AUDIENCE = 'renkflow-cron';
const DEFAULT_REPOSITORY = 'beshN/renkflowV2';
const WORKFLOW_PATH = '.github/workflows/cron.yml';
const ALLOWED_REF = 'refs/heads/main';
const ALLOWED_EVENTS = new Set(['schedule', 'workflow_dispatch']);

const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LENGTH = 8192;
const JWKS_TTL_MS = 60 * 60_000;
/** An unknown `kid` refetches the JWKS at most this often, so forged kids cannot hammer GitHub. */
const JWKS_REFETCH_COOLDOWN_MS = 60_000;
const JWKS_FETCH_TIMEOUT_MS = 5_000;

type JwksCache = { keys: Map<string, KeyObject>; fetchedAt: number };
let cache: JwksCache | null = null;
let inflight: Promise<JwksCache> | null = null;

/** Test hook: forget cached keys. */
export function resetGitHubJwksCache() {
  cache = null;
  inflight = null;
}

function expectedRepository() {
  return process.env.CRON_OIDC_REPOSITORY?.trim() || DEFAULT_REPOSITORY;
}

async function fetchJwks(): Promise<JwksCache> {
  const response = await fetch(GITHUB_OIDC_JWKS_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`JWKS HTTP ${response.status}`);
  const body = (await response.json()) as { keys?: unknown };
  const keys = new Map<string, KeyObject>();
  for (const jwk of Array.isArray(body.keys) ? body.keys : []) {
    if (!jwk || typeof jwk !== 'object') continue;
    const k = jwk as Record<string, unknown>;
    if (k.kty !== 'RSA' || typeof k.kid !== 'string' || typeof k.n !== 'string' || typeof k.e !== 'string') continue;
    if (k.use !== undefined && k.use !== 'sig') continue;
    if (k.alg !== undefined && k.alg !== 'RS256') continue;
    try {
      keys.set(k.kid, createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' }));
    } catch {
      // Skip malformed keys; the remaining ones are still usable.
    }
  }
  return { keys, fetchedAt: Date.now() };
}

async function loadJwks(): Promise<JwksCache> {
  if (!inflight) {
    inflight = fetchJwks()
      .then((fresh) => (cache = fresh))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function signingKey(kid: string): Promise<KeyObject | null> {
  const now = Date.now();
  if (!cache || now - cache.fetchedAt > JWKS_TTL_MS) await loadJwks();
  const known = cache?.keys.get(kid);
  if (known) return known;
  // Unknown kid: GitHub may have rotated its keys. Refetch once, rate-limited.
  if (cache && now - cache.fetchedAt < JWKS_REFETCH_COOLDOWN_MS) return null;
  await loadJwks();
  return cache?.keys.get(kid) ?? null;
}

function decodeSegment(segment: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function claimsAllowed(claims: Record<string, unknown>, nowSeconds: number) {
  const repository = expectedRepository();
  const workflowRef = `${repository}/${WORKFLOW_PATH}@${ALLOWED_REF}`;
  const { iss, aud, exp, nbf, iat } = claims;
  if (iss !== GITHUB_OIDC_ISSUER) return false;
  if (Array.isArray(aud) ? !aud.includes(CRON_OIDC_AUDIENCE) : aud !== CRON_OIDC_AUDIENCE) return false;
  if (typeof exp !== 'number' || exp + CLOCK_SKEW_SECONDS <= nowSeconds) return false;
  if (typeof iat !== 'number' || iat - CLOCK_SKEW_SECONDS > nowSeconds) return false;
  if (nbf !== undefined && (typeof nbf !== 'number' || nbf - CLOCK_SKEW_SECONDS > nowSeconds)) return false;
  // GitHub owner/repo names are case-insensitive; git refs are not.
  const sameRepo = (value: unknown) => typeof value === 'string' && value.toLowerCase() === repository.toLowerCase();
  const sameWorkflow = (value: unknown) => {
    if (typeof value !== 'string') return false;
    const at = value.lastIndexOf('@');
    return at > 0 && value.slice(0, at).toLowerCase() === workflowRef.slice(0, workflowRef.lastIndexOf('@')).toLowerCase() && value.slice(at + 1) === ALLOWED_REF;
  };
  if (!sameRepo(claims.repository)) return false;
  if (claims.ref !== ALLOWED_REF) return false;
  // The run's own workflow must be cron.yml on main; a reusable-workflow job must be it too.
  if (!sameWorkflow(claims.workflow_ref)) return false;
  if (claims.job_workflow_ref !== undefined && !sameWorkflow(claims.job_workflow_ref)) return false;
  if (typeof claims.event_name !== 'string' || !ALLOWED_EVENTS.has(claims.event_name)) return false;
  return true;
}

/** True only for a valid GitHub OIDC token minted for cron.yml on main of the expected repository. */
export async function verifyGitHubCronToken(token: string): Promise<boolean> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return false;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeSegment(encodedHeader);
  const claims = decodeSegment(encodedPayload);
  if (!header || !claims) return false;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) return false;
  if (header.crit !== undefined) return false;
  // Cheap claim checks first: a foreign token never triggers a JWKS fetch.
  if (!claimsAllowed(claims, Math.floor(Date.now() / 1000))) return false;
  let key: KeyObject | null;
  try {
    key = await signingKey(header.kid);
  } catch {
    console.warn('[cron] GitHub OIDC key set unavailable');
    return false;
  }
  if (!key) return false;
  try {
    return verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), key, Buffer.from(encodedSignature, 'base64url'));
  } catch {
    return false;
  }
}
