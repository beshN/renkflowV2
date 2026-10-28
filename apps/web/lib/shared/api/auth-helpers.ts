import { assertCompanyHostTenant } from '@/lib/features/company/host.server';
import 'server-only';

import { accessDecision, hiddenFieldsOf, resolveMemberAccess } from '@/lib/security/member-access.server';
import { bearerToken, verifyBearerToken, type BearerIdentity } from '@/lib/security/bearer-identity';
import { DEFAULT_PRESET, can, type Action, type FieldGroup, type Matrix, type Module } from '@/lib/security/access-matrix';
import { MFA_SETUP_REQUIRED_MESSAGE } from '@/lib/features/auth/mfa-policy';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import jwt from 'jsonwebtoken';
import { sql } from '@/lib/db';
import { isMfaEnabled } from '@/lib/features/auth/mfa.server';
import {
  IS_BUILD_TIME,
  IS_PRODUCTION,
  resolveAuthSecret,
  resolveServerBaseUrl,
} from '@/lib/shared/config/runtime-env';

// JWT Secret with strict production enforcement
const JWT_SECRET = resolveAuthSecret({
  context: 'api.auth-helpers',
  allowMissing: IS_BUILD_TIME,
  allowDevelopmentFallback: !IS_PRODUCTION && !IS_BUILD_TIME,
  developmentFallback: 'development-only-fallback-secret',
});
const IS_PROD = IS_PRODUCTION;
if (!JWT_SECRET && !IS_BUILD_TIME) {
  if (IS_PROD) {
    throw new Error('[SECURITY] Missing JWT secret in production. Set AUTH_SECRET or NEXTAUTH_SECRET.');
  } else {
    console.warn('[SECURITY WARNING] Missing JWT secret. Using development-only fallback.');
  }
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'development-only-fallback-secret';

const CORS_ALLOW_ALL = process.env.API_CORS_ALLOW_ALL === 'true';
const SERVER_BASE_URL = resolveServerBaseUrl({
  context: 'api.auth-helpers',
  allowMissing: true,
  allowLocalhostInProduction: process.env.ALLOW_INSECURE_HTTP === '1' && process.env.ALLOW_LOCAL_DATABASE === '1',
});
const CORS_ALLOWED_ORIGIN =
  process.env.API_CORS_ALLOWED_ORIGIN ||
  SERVER_BASE_URL ||
  (process.env.NODE_ENV !== 'production' ? '*' : '');

export interface APIUser {
  id: string;
  email: string;
  name: string;
  /** The member's current base role in this firm (never the role written into a token). */
  role: string;
  tenantId: string;
  /** Which credential the request carried. */
  via?: 'session' | 'api_token' | 'mobile';
  /** Set when a job preset or custom role narrows the base role: the same matrix the browser session gets. */
  narrowed?: { permissions: Matrix; hidden: FieldGroup[] };
  /** Field groups this person's role hides from responses (empty on the base role's own preset). */
  hidden?: FieldGroup[];
}

/** A signed-in request the shared gate refused (403; code mfa_setup_required for the two-step rule). */
export class APIAccessError extends WorkOrderApiError {
  constructor(message: string, status = 403, code?: string) {
    super(message, status, code);
    this.name = 'APIAccessError';
  }
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * A bearer token stops working when its owner's sign-ins are closed (new password, "sign out
 * everywhere": users.sessions_valid_after) and once the account turns on two-step sign-in, which
 * this password-only token cannot satisfy.
 */
async function apiTokenStillValid(userId: string, issuedAtSeconds: number | undefined): Promise<boolean> {
  if (!issuedAtSeconds) return false;
  const [user] = await sql`SELECT to_jsonb(u) ->> 'sessions_valid_after' AS valid_after FROM users u WHERE id = ${userId}`;
  if (!user) return false;
  if (user.valid_after && issuedAtSeconds * 1000 < new Date(user.valid_after).getTime()) return false;
  return !(await isMfaEnabled(sql, userId));
}

// Standard API response helpers with CORS headers
export function successResponse<T>(data: T, message?: string): NextResponse<APIResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  }, {
    headers: corsHeaders(),
  });
}

export function errorResponse(error: string, status: number = 400, code?: string): NextResponse<APIResponse> {
  return NextResponse.json({
    success: false,
    error,
    ...(code ? { code } : {}),
  }, { 
    status,
    headers: corsHeaders(),
  });
}

/** The bearer identity of a request after the token checks (closed sign-ins, two-step accounts, company host). */
async function verifiedBearer(request: NextRequest): Promise<BearerIdentity | null> {
  const identity = verifyBearerToken(bearerToken(request.headers));
  if (!identity) return null;
  try {
    if (!(await apiTokenStillValid(identity.userId, identity.iat ?? undefined))) return null;
    await assertCompanyHostTenant(identity.tenantId, (request.headers.get('host') || new URL(request.url).host));
    return identity;
  } catch (error) {
    console.error('JWT verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

// Verify JWT token from Authorization header (API token or phone session token)
export async function verifyAPIToken(request: NextRequest): Promise<APIUser | null> {
  const identity = await verifiedBearer(request);
  if (!identity) return null;
  return { id: identity.userId, email: identity.email || '', name: identity.name || '', role: identity.role || '', tenantId: identity.tenantId, via: identity.via };
}

function requestPath(request: NextRequest) {
  try {
    return request.nextUrl?.pathname ?? new URL(request.url).pathname;
  } catch {
    return '/';
  }
}

/**
 * The person a request acts for, resolved the same way for every credential: fresh membership,
 * job preset or custom role (matrix and hidden fields), closed sign-ins, the worker's scope and the
 * firm's two-step rule, checked against this request's path and method exactly as the proxy checks
 * a browser session. Null when nobody is signed in (or no longer may be: 401); a refusal throws
 * APIAccessError (403).
 */
async function resolveAPIActor(
  request: NextRequest,
  identity: { userId: string; tenantId: string; email: string; name: string; via: NonNullable<APIUser['via']>; sid: string | null; iat: number | null },
): Promise<APIUser | null> {
  const access = await resolveMemberAccess(identity.userId, identity.tenantId);
  if (!access || access.deactivated) return null;
  const decision = await accessDecision(identity.userId, identity.tenantId, requestPath(request), request.method || 'GET', { sid: identity.sid, iat: identity.iat }, { cached: false });
  if (decision?.status === 401) return null;
  if (decision) throw new APIAccessError(decision.code ? MFA_SETUP_REQUIRED_MESSAGE : 'Bu işlem için yetkiniz bulunmuyor', 403, decision.code);
  const narrowed = access.roleKey !== DEFAULT_PRESET[access.base];
  return {
    id: identity.userId,
    email: identity.email,
    name: identity.name,
    role: access.base,
    tenantId: identity.tenantId,
    via: identity.via,
    hidden: hiddenFieldsOf(access),
    ...(narrowed ? { narrowed: { permissions: access.permissions, hidden: access.hidden } } : {}),
  };
}

// Get user from session or JWT token
export async function getAPIUser(request: NextRequest): Promise<APIUser | null> {
  // First the bearer token (API clients, the phone app)
  const bearer = await verifiedBearer(request);
  if (bearer) {
    return resolveAPIActor(request, { userId: bearer.userId, tenantId: bearer.tenantId, email: bearer.email || '', name: bearer.name || '', via: bearer.via, sid: bearer.sid, iat: bearer.iat });
  }

  // Fallback to session (for web app); the session callback already rejected closed sign-ins.
  const session = await auth();
  if (session?.user?.id && session.user.tenantId) {
    return resolveAPIActor(request, { userId: session.user.id, tenantId: session.user.tenantId, email: session.user.email || '', name: session.user.name || '', via: 'session', sid: null, iat: null });
  }

  return null;
}

/** Whether the person's role allows this module action (a narrowing role must hold the matrix cell). */
export function apiAllows(user: APIUser, module: Module, action: Action): boolean {
  if (!user.narrowed) return true;
  return can(user.narrowed, module, action);
}

// Role-based access control
export function hasRole(user: APIUser, allowedRoles: string[]): boolean {
  return allowedRoles.includes(user.role);
}

// Generate JWT token for mobile login
export function generateAPIToken(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}): { accessToken: string; expiresIn: number } {
  const expiresIn = 7 * 24 * 60 * 60; // 7 days
  
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    },
    EFFECTIVE_JWT_SECRET,
    { expiresIn }
  );
  
  return { accessToken, expiresIn };
}

// CORS headers for mobile apps
export function corsHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (CORS_ALLOW_ALL) {
    headers['Access-Control-Allow-Origin'] = '*';
    return headers;
  }

  if (CORS_ALLOWED_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = CORS_ALLOWED_ORIGIN;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

// Handle OPTIONS request for CORS preflight
export function handleCORS(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}
