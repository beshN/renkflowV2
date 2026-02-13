import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { evaluateComingSoonRequest, isComingSoonMode, normalizePublicSiteMode } from '@/lib/launch/comingSoonGate';
import { resolveAuthSecret } from '@/lib/shared/config/runtime-env';

type AuthRateLimitEntry = {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil: number;
};

const AUTH_SECRET =
  resolveAuthSecret({
    context: 'proxy',
    allowMissing: process.env.NODE_ENV !== 'production',
    allowDevelopmentFallback: process.env.NODE_ENV !== 'production',
    developmentFallback: 'development-only-fallback-secret',
  }) || undefined;

const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
const AUTH_RATE_LIMIT_BLOCK_MS = 60_000;
const authRateLimits = new Map<string, AuthRateLimitEntry>();
const CLOUD_RUN_CANONICAL_ORIGIN = 'https://renkflow-web-r7mdgubfjq-ey.a.run.app';

const AUTH_REDIRECTS: Record<string, { destination: string; permanent: boolean }> = {
  '/auth/signup': { destination: '/signup', permanent: true },
  '/auth/verify-email': { destination: '/auth/verify', permanent: false },
};

const PUBLIC_EXACT_PATHS = new Set([
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
  '/roadmap',
  '/changelog',
  '/full-landing',
  '/press',
  '/docs',
  '/blog',
  '/careers',
  '/security',
  '/status',
]);

const PUBLIC_PREFIXES = ['/blog/', '/careers/', '/docs/', '/public/'];
const AUTH_ENTRY_PAGES = new Set(['/auth/login', '/auth/forgot-password', '/auth/update-password', '/signup']);

function getClientIp(request: NextRequest): string {
  const requestIp = (request as { ip?: string }).ip;
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    requestIp ||
    'unknown'
  );
}

function isRateLimitedAuthEndpoint(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth/callback/credentials') ||
    pathname.startsWith('/api/auth/signin')
  );
}

function checkAuthRateLimit(ip: string): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const existing = authRateLimits.get(ip);

  if (existing) {
    if (existing.blockedUntil > now) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((existing.blockedUntil - now) / 1000)),
      };
    }
    if (now - existing.firstAttemptAt > AUTH_RATE_LIMIT_WINDOW_MS) {
      authRateLimits.delete(ip);
    }
  }

  const current = authRateLimits.get(ip) || {
    attempts: 0,
    firstAttemptAt: now,
    blockedUntil: 0,
  };

  current.attempts += 1;

  if (current.attempts > AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    current.blockedUntil = now + AUTH_RATE_LIMIT_BLOCK_MS;
    authRateLimits.set(ip, current);
    return {
      allowed: false,
      retryAfter: Math.ceil(AUTH_RATE_LIMIT_BLOCK_MS / 1000),
    };
  }

  authRateLimits.set(ip, current);
  return { allowed: true };
}

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith('/_next/') || /\.[a-zA-Z0-9]+$/.test(pathname);
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({
      req: request,
      secret: AUTH_SECRET,
      secureCookie: request.nextUrl.protocol === 'https:',
    });
    return Boolean(token?.sub || token?.id);
  } catch {
    return false;
  }
}

function buildLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = '';
  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('callbackUrl', callbackUrl);
  return NextResponse.redirect(loginUrl, 302);
}

function shouldProxyToCloudRun(request: NextRequest): boolean {
  const isVercelRuntime = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
  if (!isVercelRuntime) {
    return false;
  }

  try {
    const targetHost = new URL(CLOUD_RUN_CANONICAL_ORIGIN).host.toLowerCase();
    const currentHost = request.nextUrl.host.toLowerCase();
    return currentHost !== targetHost;
  } catch {
    return false;
  }
}

function buildCloudRunRewrite(request: NextRequest): NextResponse {
  const destination = new URL(CLOUD_RUN_CANONICAL_ORIGIN);
  destination.pathname = request.nextUrl.pathname;
  destination.search = request.nextUrl.search;
  return NextResponse.rewrite(destination);
}

export async function proxy(request: NextRequest) {
  if (shouldProxyToCloudRun(request)) {
    // Keep renkflow.com in browser while serving everything from Cloud Run.
    return buildCloudRunRewrite(request);
  }

  const publicSiteMode = normalizePublicSiteMode(process.env.PUBLIC_SITE_MODE || 'off');
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  if (isComingSoonMode(publicSiteMode)) {
    const action = evaluateComingSoonRequest(pathname, method, publicSiteMode);

    if (action.type === 'subscribeOptions') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (action.type === 'api404') {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    if (action.type === 'rewrite') {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = action.destination;
      return NextResponse.rewrite(rewriteUrl);
    }

    if (action.type === 'redirect') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = action.destination;
      redirectUrl.search = '';
      return NextResponse.redirect(redirectUrl, 302);
    }
  }

  if (isRateLimitedAuthEndpoint(pathname)) {
    const ip = getClientIp(request);
    const limit = checkAuthRateLimit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Çok fazla başarısız deneme. ${limit.retryAfter} saniye sonra tekrar deneyin.`,
          retryAfter: limit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(limit.retryAfter),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  const authRedirect = AUTH_REDIRECTS[pathname];
  if (authRedirect) {
    const destinationUrl = request.nextUrl.clone();
    destinationUrl.pathname = authRedirect.destination;
    destinationUrl.search = '';
    return NextResponse.redirect(destinationUrl, authRedirect.permanent ? 308 : 307);
  }

  const authRoute = pathname.startsWith('/auth/') || pathname === '/signup';
  if (authRoute) {
    if (AUTH_ENTRY_PAGES.has(pathname) && (await isAuthenticated(request))) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      dashboardUrl.search = '';
      return NextResponse.redirect(dashboardUrl, 302);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (isStaticAsset(pathname) || isPublicPage(pathname)) {
    return NextResponse.next();
  }

  if (!(await isAuthenticated(request))) {
    return buildLoginRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
