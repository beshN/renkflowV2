import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import jwt from 'jsonwebtoken';
import { sql } from '@/lib/db';
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
});
const CORS_ALLOWED_ORIGIN =
  process.env.API_CORS_ALLOWED_ORIGIN ||
  SERVER_BASE_URL ||
  (process.env.NODE_ENV !== 'production' ? '*' : '');

export interface APIUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function resolveTenantMembership(userId: string, tenantId: string): Promise<{ role: string } | null> {
  if (!userId || !tenantId) return null;
  const memberships = await sql`
    SELECT role
    FROM tenant_members
    WHERE user_id = ${userId}
      AND tenant_id = ${tenantId}
    LIMIT 1
  `;
  const membershipRows = memberships as Array<{ role: string }>;
  return membershipRows[0] ?? null;
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

export function errorResponse(error: string, status: number = 400): NextResponse<APIResponse> {
  return NextResponse.json({
    success: false,
    error,
  }, { 
    status,
    headers: corsHeaders(),
  });
}

// Verify JWT token from Authorization header
export async function verifyAPIToken(request: NextRequest): Promise<APIUser | null> {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as unknown as {
        id?: string;
        sub: string;
        email: string;
        name: string;
        role: string;
        tenantId: string;
      };

      const userId = decoded.sub || decoded.id || '';
      if (!userId || !decoded.tenantId) {
        return null;
      }

      return {
        id: userId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        tenantId: decoded.tenantId,
      };
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }
  
  return null;
}

// Get user from session or JWT token
export async function getAPIUser(request: NextRequest): Promise<APIUser | null> {
  // First try JWT from header (for mobile apps)
  const jwtUser = await verifyAPIToken(request);
  if (jwtUser) {
    const membership = await resolveTenantMembership(jwtUser.id, jwtUser.tenantId);
    if (!membership) {
      return null;
    }
    return {
      ...jwtUser,
      role: membership.role || jwtUser.role,
    };
  }
  
  // Fallback to session (for web app)
  const session = await auth();
  if (session?.user?.id && session.user.tenantId) {
    const membership = await resolveTenantMembership(session.user.id, session.user.tenantId);
    if (!membership) {
      return null;
    }
    return {
      id: session.user.id,
      email: session.user.email || '',
      name: session.user.name || '',
      role: membership.role || session.user.role || 'member',
      tenantId: session.user.tenantId,
    };
  }
  
  return null;
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
