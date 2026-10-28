// Server code shared by proxy.ts, the API helpers and response redaction (no 'server-only': the proxy loads it).
import jwt from 'jsonwebtoken';
import { resolveAuthSecret } from '@/lib/shared/config/runtime-env';

/**
 * Who a bearer credential speaks for, read only from its signature: the password API token
 * (/api/v1/auth/login, 7 days) or a phone session's short access token (/api/mobile/v1, with its
 * session id). Whether the person is still a member, the session still open and what their role
 * allows is decided afterwards by the same checks a browser session goes through
 * (member-access.server.ts), so every kind of sign-in resolves to the same actor.
 */
export type BearerIdentity = {
  via: 'api_token' | 'mobile';
  userId: string;
  tenantId: string;
  email: string | null;
  name: string | null;
  /** The role written into the token at sign-in; the current membership decides. */
  role: string | null;
  sid: string | null;
  iat: number | null;
};

function secret() {
  return resolveAuthSecret({
    context: 'bearer-identity',
    allowMissing: true,
    allowDevelopmentFallback: process.env.NODE_ENV !== 'production',
    developmentFallback: 'development-only-fallback-secret',
  });
}

/** The bearer token of a request (Authorization: Bearer …), or null. */
export function bearerToken(headers: { get(name: string): string | null }): string | null {
  const value = headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7).trim() || null : null;
}

/** The identity a bearer token carries, or null when it is not one of ours (other secrets, cron keys, expired). */
export function verifyBearerToken(token: string | null | undefined): BearerIdentity | null {
  const key = secret();
  if (!token || !key) return null;
  let p: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, key, { algorithms: ['HS256'] });
    if (!decoded || typeof decoded !== 'object') return null;
    p = decoded as jwt.JwtPayload;
  } catch {
    return null;
  }
  const userId = String(p.sub || p.id || '');
  const tenantId = typeof p.tenantId === 'string' ? p.tenantId : '';
  if (!userId || !tenantId || typeof p.iat !== 'number') return null;
  const email = typeof p.email === 'string' ? p.email : null;
  const name = typeof p.name === 'string' ? p.name : null;
  const role = typeof p.role === 'string' ? p.role : null;
  if (p.type === 'mobile') {
    if (p.aud !== 'renkflow-mobile' || typeof p.sid !== 'string') return null;
    return { via: 'mobile', userId, tenantId, email, name, role, sid: p.sid, iat: p.iat };
  }
  return { via: 'api_token', userId, tenantId, email, name, role, sid: null, iat: p.iat };
}
