// ============================================
// AUTH MIDDLEWARE
// Next.js Middleware Integration
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, verifyRefreshToken, generateTokenPair, cookieConfig, hashToken, tokenRotationService } from './jwt';

// ============================================
// ROUTE PROTECTION CONFIG
// ============================================

interface RouteConfig {
  matcher: RegExp;
  roles?: ('admin' | 'user' | 'guest')[];
  requireAuth: boolean;
}

const protectedRoutes: RouteConfig[] = [
  { matcher: /^\/dashboard/, requireAuth: true },
  { matcher: /^\/admin/, requireAuth: true, roles: ['admin'] },
  { matcher: /^\/profile/, requireAuth: true, roles: ['admin', 'user'] },
  { matcher: /^\/api\/users/, requireAuth: true },
  { matcher: /^\/api\/admin/, requireAuth: true, roles: ['admin'] },
];

const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
];

// ============================================
// MIDDLEWARE HANDLER
// ============================================

export async function authMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  
  // Skip public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check if route requires protection
  const routeConfig = protectedRoutes.find(config => config.matcher.test(pathname));
  if (!routeConfig?.requireAuth) {
    return NextResponse.next();
  }
  
  // Get tokens from cookies
  const accessToken = request.cookies.get(cookieConfig.accessToken.name)?.value;
  const refreshToken = request.cookies.get(cookieConfig.refreshToken.name)?.value;
  
  // Try to verify access token
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    
    if (payload) {
      // Check role authorization
      if (routeConfig.roles && !routeConfig.roles.includes(payload.role)) {
        return createForbiddenResponse(request);
      }
      
      // Add user info to headers for downstream use
      const response = NextResponse.next();
      response.headers.set('x-user-id', payload.userId);
      response.headers.set('x-user-role', payload.role);
      response.headers.set('x-session-id', payload.sessionId);
      return response;
    }
  }
  
  // Access token invalid/expired, try refresh
  if (refreshToken) {
    const refreshPayload = await verifyRefreshToken(refreshToken);
    
    if (refreshPayload?.jti) {
      // Validate refresh token in store
      const storedToken = await tokenRotationService.getRefreshToken(refreshPayload.jti);
      const tokenHash = await hashToken(refreshToken);
      
      if (storedToken && !storedToken.isRevoked && storedToken.tokenHash === tokenHash) {
        // Get user from database (mock)
        const user = await mockGetUser(refreshPayload.userId);
        
        if (user) {
          // Generate new token pair
          const newTokens = await generateTokenPair(user);
          const newRefreshPayload = await verifyRefreshToken(newTokens.refreshToken);
          
          if (newRefreshPayload?.jti) {
            // Rotate refresh token
            const newTokenHash = await hashToken(newTokens.refreshToken);
            await tokenRotationService.rotateRefreshToken(
              refreshPayload.jti,
              newRefreshPayload.jti,
              newTokenHash
            );
            
            // Set new cookies
            const response = NextResponse.next();
            
            response.cookies.set(
              cookieConfig.accessToken.name,
              newTokens.accessToken,
              cookieConfig.accessToken.options
            );
            
            response.cookies.set(
              cookieConfig.refreshToken.name,
              newTokens.refreshToken,
              cookieConfig.refreshToken.options
            );
            
            // Add user info to headers
            response.headers.set('x-user-id', user.id);
            response.headers.set('x-user-role', user.role);
            
            return response;
          }
        }
      }
    }
  }
  
  // No valid tokens, redirect to login
  return createUnauthorizedResponse(request);
}

// ============================================
// RESPONSE HELPERS
// ============================================

function createUnauthorizedResponse(request: NextRequest): NextResponse {
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  
  if (isApiRoute) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function createForbiddenResponse(request: NextRequest): NextResponse {
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  
  if (isApiRoute) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }
  
  return NextResponse.redirect(new URL('/403', request.url));
}

// ============================================
// MOCK USER LOOKUP
// ============================================

async function mockGetUser(userId: string) {
  // In production, this would be a database lookup
  const users: Record<string, { id: string; email: string; role: 'admin' | 'user' | 'guest' }> = {
    'user-1': { id: 'user-1', email: 'admin@example.com', role: 'admin' },
    'user-2': { id: 'user-2', email: 'user@example.com', role: 'user' },
  };
  
  return users[userId] ?? null;
}

// ============================================
// CSRF PROTECTION
// ============================================

export function validateCsrfToken(request: NextRequest): boolean {
  const csrfCookie = request.cookies.get('csrf_token')?.value;
  const csrfHeader = request.headers.get('x-csrf-token');
  
  if (!csrfCookie || !csrfHeader) {
    return false;
  }
  
  return csrfCookie === csrfHeader;
}

export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

// ============================================
// RATE LIMITING (Simple In-Memory)
// ============================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || record.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}
