import { isPrivateAccessAllowed, privateAccessEmail } from '@/lib/features/auth/private-access';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { evaluateComingSoonRequest, isComingSoonMode, normalizePublicSiteMode } from '@/lib/launch/comingSoonGate';
import { resolveAuthSecret } from '@/lib/shared/config/runtime-env';

const AUTH_SECRET =
  resolveAuthSecret({
    context: 'proxy',
    allowMissing: process.env.NODE_ENV !== 'production',
    allowDevelopmentFallback: process.env.NODE_ENV !== 'production',
    developmentFallback: 'development-only-fallback-secret',
  }) || undefined;

const ACME_CHALLENGE_PREFIX = '/.well-known/acme-challenge/';

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

const PUBLIC_PREFIXES = ['/blog/', '/careers/', '/docs/', '/public/', '/track/'];
const AUTH_ENTRY_PAGES = new Set(['/auth/login', '/auth/forgot-password', '/auth/update-password', '/signup']);

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
    return Boolean(token?.sub || token?.id) && isPrivateAccessAllowed(token?.email);
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

const PROXY_SECURITY_HEADERS: Record<string, string> = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
};

function withProxySecurityHeaders(
  response: NextResponse,
  options: { isSecureRequest: boolean },
): NextResponse {
  Object.entries(PROXY_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  if (options.isSecureRequest) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isSecureRequest = forwardedProto === 'https' || request.nextUrl.protocol === 'https:';
  const allowInsecureHttp =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_INSECURE_HTTP === '1';

  // Healthcheck endpoints must bypass all auth/redirect logic
  if (pathname === '/api/ready' || pathname === '/api/health') {
    return withProxySecurityHeaders(NextResponse.next(), { isSecureRequest });
  }

  // Keep ACME challenge path on plain HTTP for certificate issuance/renewal.
  if (!allowInsecureHttp && forwardedProto === 'http' && !pathname.startsWith(ACME_CHALLENGE_PREFIX)) {
    const httpsUrl = request.nextUrl.clone();
    const hostHeader = request.headers.get('host');
    httpsUrl.protocol = 'https:';
    if (hostHeader) {
      httpsUrl.host = hostHeader.split(':')[0];
    }
    httpsUrl.port = '';
    return withProxySecurityHeaders(NextResponse.redirect(httpsUrl, 301), { isSecureRequest: false });
  }

  const publicSiteMode = normalizePublicSiteMode(process.env.PUBLIC_SITE_MODE || 'off');
  if (isComingSoonMode(publicSiteMode)) {
    const action = evaluateComingSoonRequest(pathname, method, publicSiteMode);

    if (action.type === 'subscribeOptions') {
      return withProxySecurityHeaders(new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }), { isSecureRequest });
    }

    if (action.type === 'api404') {
      return withProxySecurityHeaders(NextResponse.json({ error: 'Not Found' }, { status: 404 }), { isSecureRequest });
    }

    if (action.type === 'rewrite') {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = action.destination;
      return withProxySecurityHeaders(NextResponse.rewrite(rewriteUrl), { isSecureRequest });
    }

    if (action.type === 'redirect') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = action.destination;
      redirectUrl.search = '';
      return withProxySecurityHeaders(NextResponse.redirect(redirectUrl, 302), { isSecureRequest });
    }
  }

  // Login throttling lives in the credentials authorize() step, backed by the shared
  // database limiter; an in-memory counter here would reset per serverless instance.

  const authRedirect = AUTH_REDIRECTS[pathname];
  if (authRedirect) {
    const destinationUrl = request.nextUrl.clone();
    destinationUrl.pathname = authRedirect.destination;
    destinationUrl.search = '';
    return withProxySecurityHeaders(
      NextResponse.redirect(destinationUrl, authRedirect.permanent ? 308 : 307),
      { isSecureRequest },
    );
  }

  const authRoute = pathname.startsWith('/auth/') || pathname === '/signup';
  if (authRoute) {
    if (AUTH_ENTRY_PAGES.has(pathname) && (await isAuthenticated(request))) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      dashboardUrl.search = '';
      return withProxySecurityHeaders(NextResponse.redirect(dashboardUrl, 302), { isSecureRequest });
    }
    return withProxySecurityHeaders(NextResponse.next(), { isSecureRequest });
  }

  if(privateAccessEmail() && (pathname.startsWith('/track/') || pathname.startsWith('/q/'))) {
    if(!(await isAuthenticated(request))) return withProxySecurityHeaders(buildLoginRedirect(request), {isSecureRequest});
  }

  if (pathname.startsWith('/api/')) {
    if(privateAccessEmail() && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/health') && !pathname.startsWith('/api/cron/') && !(await isAuthenticated(request))) return withProxySecurityHeaders(NextResponse.json({error:'Oturum açmanız gerekiyor.'},{status:401}),{isSecureRequest});
    const response = withProxySecurityHeaders(NextResponse.next(), { isSecureRequest });
    if (pathname.startsWith('/api/v1/production/files/') || pathname === '/api/storage/content' || /^\/api\/orders\/documents\/[^/]+\/content$/.test(pathname)) response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    return response;
  }

  if (isStaticAsset(pathname) || isPublicPage(pathname)) {
    return withProxySecurityHeaders(NextResponse.next(), { isSecureRequest });
  }

  if (!(await isAuthenticated(request))) {
    return withProxySecurityHeaders(buildLoginRedirect(request), { isSecureRequest });
  }

  return withProxySecurityHeaders(NextResponse.next(), { isSecureRequest });
}

export const config = {
  matcher: '/:path*',
};
