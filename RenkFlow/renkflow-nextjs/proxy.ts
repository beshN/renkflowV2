import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';

// ============================================
// Rate Limiting for Auth Routes (In-Memory)
// ============================================
// Note: For production with multiple instances, use Redis.
// This in-memory implementation works for single-instance deployments.

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blocked: boolean;
  blockedUntil: number;
}

const authRateLimits = new Map<string, RateLimitEntry>();

const AUTH_RATE_LIMIT = {
  windowMs: 60 * 1000,      // 1 minute
  maxAttempts: 5,           // 5 attempts per window
  blockDurationMs: 60 * 1000, // 1 minute block
};

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of authRateLimits.entries()) {
      if (now > entry.blockedUntil && now > entry.firstAttempt + 300000) {
        authRateLimits.delete(key);
      }
    }
  }, 300000);
}

function getClientIP(request: NextRequest): string {
  const requestIp = (request as { ip?: string }).ip;
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestIp ||
    'unknown'
  );
}

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');

  if (host) {
    const isLocalHost =
      host.startsWith('localhost') ||
      host.startsWith('127.0.0.1') ||
      host.startsWith('0.0.0.0');
    const proto = isLocalHost ? 'http' : (forwardedProto || 'https');
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}

function toRequestUrl(request: NextRequest, pathname: string): URL {
  return new URL(pathname, getRequestOrigin(request));
}

function checkAuthRateLimit(ip: string): { allowed: boolean; message?: string; retryAfter?: number } {
  const now = Date.now();
  let entry = authRateLimits.get(ip);

  // Check if blocked
  if (entry?.blocked && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      message: `Çok fazla başarısız deneme. ${retryAfter} saniye sonra tekrar deneyin.`,
      retryAfter,
    };
  }

  // Reset if window expired or unblocked
  if (!entry || now - entry.firstAttempt > AUTH_RATE_LIMIT.windowMs || (entry.blocked && entry.blockedUntil <= now)) {
    entry = {
      attempts: 0,
      firstAttempt: now,
      blocked: false,
      blockedUntil: 0,
    };
  }

  entry.attempts++;

  if (entry.attempts > AUTH_RATE_LIMIT.maxAttempts) {
    entry.blocked = true;
    entry.blockedUntil = now + AUTH_RATE_LIMIT.blockDurationMs;
    authRateLimits.set(ip, entry);

    return {
      allowed: false,
      message: `Çok fazla başarısız deneme. ${Math.ceil(AUTH_RATE_LIMIT.blockDurationMs / 1000)} saniye engellendi.`,
      retryAfter: Math.ceil(AUTH_RATE_LIMIT.blockDurationMs / 1000),
    };
  }

  authRateLimits.set(ip, entry);
  return { allowed: true };
}

// ============================================
// Middleware
// ============================================

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host')?.toLowerCase() || '';

  // ============================================
  // Coming Soon Redirect (renkflow.com + subdomains)
  // ============================================
  const isRenkflowHost =
    host === 'renkflow.com' ||
    host === 'www.renkflow.com' ||
    host.endsWith('.renkflow.com');
  const comingSoonBypass =
    pathname === '/coming-soon' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/logo');

  if (isRenkflowHost && !comingSoonBypass) {
    return NextResponse.redirect(toRequestUrl(request, '/coming-soon'));
  }

  // ============================================
  // Rate Limit Auth Routes
  // ============================================
  // Apply rate limiting to NextAuth credential login attempts
  if (
    pathname.startsWith('/api/auth/callback/credentials') ||
    pathname.startsWith('/api/auth/signin')
  ) {
    const ip = getClientIP(request);
    const rateLimitResult = checkAuthRateLimit(ip);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: rateLimitResult.message,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  // ============================================
  // Protected Routes
  // ============================================
  const isAuthPage = pathname.startsWith('/auth/');
  const publicExactPaths = new Set([
    '/',
    '/about',
    '/pricing',
    '/features',
    '/integrations',
    '/faq',
    '/terms',
    '/privacy',
    '/cookies',
    '/coming-soon',
    '/contact',
    '/signup',
    '/roadmap',
    '/changelog',
    '/full-landing',
    '/press',
    '/docs',
    '/security',
    '/status',
    '/sitemap',
  ]);
  const publicPrefixes = ['/public/', '/blog', '/careers', '/docs'];
  const isPublicPage =
    publicExactPaths.has(pathname) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isApiRoute = pathname.startsWith('/api/');
  const isStaticAsset = pathname.startsWith('/_next/') || pathname.includes('.');

  // Allow static assets and public pages
  if (isStaticAsset || isPublicPage) {
    return NextResponse.next();
  }

  // Auth route redirects (single source of truth — not duplicated in next.config.js)
  const authRedirects: Record<string, { destination: string; permanent: boolean }> = {
    '/auth/signup': { destination: '/signup', permanent: true },
    '/auth/verify-email': { destination: '/auth/verify', permanent: false },
  };
  if (authRedirects[pathname]) {
    const { destination, permanent } = authRedirects[pathname];
    return NextResponse.redirect(toRequestUrl(request, destination), permanent ? 308 : 307);
  }

  // Allow auth pages for unauthenticated users
  if (isAuthPage) {
    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (request.auth?.user) {
      return NextResponse.redirect(toRequestUrl(request, '/dashboard'));
    }
    return NextResponse.next();
  }

  // Allow API routes (they handle their own auth)
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Protected pages: redirect to login if not authenticated
  if (!request.auth?.user) {
    const loginUrl = toRequestUrl(request, '/auth/login');
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// ============================================
// Matcher Configuration
// ============================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
