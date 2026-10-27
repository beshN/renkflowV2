import { companyForHost, CompanyHostError } from '@/lib/features/company/host.server';
import { isPrivateAccessAllowed, privateAccessEmail } from '@/lib/features/auth/private-access';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { evaluateComingSoonRequest, isComingSoonMode, normalizePublicSiteMode } from '@/lib/launch/comingSoonGate';
import { resolveAuthSecret } from '@/lib/shared/config/runtime-env';
import { evaluateRouteAccess } from '@/lib/features/auth/route-access';
import { accessDecision, logAccessDenied, narrowedHiddenFields } from '@/lib/security/member-access.server';
import { HIDDEN_FIELDS_HEADER } from '@/lib/security/field-header';
import { SECURITY_HEADERS } from '@/lib/security/security-headers';
import { configuratorRewrite, fairTenantId, isFairHost, isFairPath } from '@/lib/features/fair/config';

const AUTH_SECRET =
  resolveAuthSecret({
    context: 'proxy',
    allowMissing: process.env.NODE_ENV !== 'production',
    allowDevelopmentFallback: process.env.NODE_ENV !== 'production',
    developmentFallback: 'development-only-fallback-secret',
  }) || undefined;

/**
 * Token links that work for anyone, signed in to another firm or not (joining a firm by invite):
 * the member gate of the current firm does not apply.
 */
const GATE_EXEMPT_API = new Set(['/api/tenant/invite/validate', '/api/tenant/invite/accept']);
const GATE_EXEMPT_API_PREFIXES = ['/api/v1/public/', '/api/v1/tracking/', '/api/telemetry/'];
const gateExempt = (pathname: string) => GATE_EXEMPT_API.has(pathname) || GATE_EXEMPT_API_PREFIXES.some((p) => pathname.startsWith(p));

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
  '/station',
  // Social share cards must be fetchable by link-preview crawlers.
  '/opengraph-image',
  '/twitter-image',
]);

const PUBLIC_PREFIXES = ['/blog/', '/docs/', '/public/', '/track/', '/teklif/', '/teslim/'];
const AUTH_ENTRY_PAGES = new Set(['/auth/login', '/auth/forgot-password', '/auth/update-password', '/signup']);

function isPublicPage(pathname: string): boolean {
  if (process.env.NODE_ENV === "development" && pathname === "/product-3d-lab") return true;
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith('/_next/') || /\.[a-zA-Z0-9]+$/.test(pathname);
}

/**
 * The single access gate for signed-in requests: the member's role (preset or custom, read from the
 * database) against the module and action the path needs; a deactivated member or a revoked session
 * is turned away. Refusals are written to the audit trail. Null = carry on.
 */
async function accessGate(request: NextRequest, token: Awaited<ReturnType<typeof sessionToken>>, pathname: string, method: string, isSecureRequest: boolean) {
  if (!token?.tenantId || !(token.id || token.sub)) return null;
  const userId = String(token.id || token.sub);
  const tenantId = String(token.tenantId);
  let decision;
  try {
    decision = await accessDecision(userId, tenantId, pathname, method, { sid: typeof token.sid === 'string' ? token.sid : null, iat: typeof token.iat === 'number' ? token.iat : null });
  } catch (e) {
    // The database being unreachable must not open a door: API calls fail closed, pages show their own error.
    console.error('[proxy] access check failed', e instanceof Error ? e.message : e);
    return pathname.startsWith('/api/') ? withProxySecurityHeaders(NextResponse.json({ error: 'Yetki doğrulanamadı; tekrar deneyin.' }, { status: 503 }), { isSecureRequest }) : null;
  }
  if (!decision) return null;
  const api = pathname.startsWith('/api/');
  if (decision.status === 401) {
    return api
      ? withProxySecurityHeaders(NextResponse.json({ error: 'Oturumunuz kapatıldı ya da hesabınız pasif. Yeniden giriş yapın.' }, { status: 401 }), { isSecureRequest })
      : withProxySecurityHeaders(buildLoginRedirect(request), { isSecureRequest });
  }
  await logAccessDenied({ tenantId, userId, path: pathname, method, module: decision.need?.module ?? null, action: decision.need?.action ?? null, reason: decision.reason });
  if (api || method !== 'GET') return withProxySecurityHeaders(NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 }), { isSecureRequest });
  const dashboardUrl = request.nextUrl.clone();
  dashboardUrl.pathname = decision.reason==='worker_scope'?'/production/worker':'/dashboard';
  dashboardUrl.search = '';
  return withProxySecurityHeaders(NextResponse.redirect(dashboardUrl, 302), { isSecureRequest });
}

/**
 * Passes the field groups a narrowed role may not see to the route as a request header. Any value
 * the client sent is dropped first, so the header can only ever come from here.
 */
async function forwardHiddenFields(request: NextRequest, token: Awaited<ReturnType<typeof sessionToken>>) {
  const forwarded = new Headers(request.headers);
  forwarded.delete(HIDDEN_FIELDS_HEADER);
  if (token?.tenantId && (token.id || token.sub)) {
    const hidden = await narrowedHiddenFields(String(token.id || token.sub), String(token.tenantId));
    if (hidden.length) forwarded.set(HIDDEN_FIELDS_HEADER, hidden.join(','));
  }
  return NextResponse.next({ request: { headers: forwarded } });
}

async function sessionToken(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: AUTH_SECRET,
      secureCookie: request.nextUrl.protocol === 'https:',
    });
    return token && Boolean(token.sub || token.id) && isPrivateAccessAllowed(token.email) ? token : null;
  } catch {
    return null;
  }
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  return Boolean(await sessionToken(request));
}

function buildLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = '';
  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('callbackUrl', callbackUrl);
  return NextResponse.redirect(loginUrl, 302);
}

function withProxySecurityHeaders(
  response: NextResponse,
  options: { isSecureRequest: boolean },
): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  if (options.isSecureRequest) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

/** Only kiosk pages can be embedded by the simulator on the same origin. */
function withConfiguratorSecurityHeaders(response: NextResponse, pathname: string, isSecureRequest: boolean) {
  const secured = withProxySecurityHeaders(response, { isSecureRequest });
  if (/^(?:\/configurator)?\/fair\/[^/]+\/?$/.test(pathname)) secured.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return secured;
}

/** A configurator domain serves the public configurator and its kiosk simulator. */
function fairSite(request: NextRequest, pathname: string, isSecureRequest: boolean) {
  const target = configuratorRewrite(pathname);
  const url = request.nextUrl.clone();
  if (target) {
    url.pathname = target;
    return withConfiguratorSecurityHeaders(NextResponse.rewrite(url), pathname, isSecureRequest);
  }
  if (isFairPath(pathname)) return withConfiguratorSecurityHeaders(NextResponse.next(), pathname, isSecureRequest);
  if (pathname.startsWith('/api/')) return withProxySecurityHeaders(NextResponse.json({ error: 'Not Found' }, { status: 404 }), { isSecureRequest });
  if (isStaticAsset(pathname)) return withProxySecurityHeaders(NextResponse.next(), { isSecureRequest });
  url.pathname = '/';
  url.search = '';
  return withProxySecurityHeaders(NextResponse.redirect(url, 302), { isSecureRequest });
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

  // The product configurator (kiosk, phone, web) is public and needs no session. A configurator
  // domain serves nothing else: no sign-in, no workspace, no other API.
  const requestHost = request.headers.get('host') || request.nextUrl.host;
  if (isFairHost(requestHost)) return fairSite(request, pathname, isSecureRequest);
  if (fairTenantId() && isFairPath(pathname)) return withConfiguratorSecurityHeaders(NextResponse.next(), pathname, isSecureRequest);

  // Reject unknown company hosts before routes, authentication and server actions execute.
  // Host-only Auth.js cookies remain independent for every company address.
  let companyScoped = false;
  if (!isStaticAsset(pathname)) {
    try {
      const company = await companyForHost(request.headers.get('host') || request.nextUrl.host);
      if (company) {
        companyScoped = true;
        const token = await sessionToken(request);
        if (token?.tenantId && token.tenantId !== company.id && pathname !== '/api/auth/signout')
          return withProxySecurityHeaders(NextResponse.json({ error: 'Bu şirket için oturum açın.' }, { status: 403 }), { isSecureRequest });
        if (pathname === '/') {
          const destination = request.nextUrl.clone(); destination.pathname = token ? '/dashboard' : '/auth/login';
          return withProxySecurityHeaders(NextResponse.redirect(destination, 302), { isSecureRequest });
        }
      }
    } catch (e) {
      return withProxySecurityHeaders(NextResponse.json({ error: e instanceof CompanyHostError ? e.message : 'Şirket adresi doğrulanamadı.' }, { status: e instanceof CompanyHostError ? e.status : 503 }), { isSecureRequest });
    }
  }

  const publicSiteMode = normalizePublicSiteMode(process.env.PUBLIC_SITE_MODE || 'off');
  if (isComingSoonMode(publicSiteMode) && !companyScoped) {
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

  if(privateAccessEmail() && (pathname.startsWith('/track/') || pathname.startsWith('/q/') || pathname.startsWith('/teklif/') || pathname.startsWith('/teslim/'))) {
    if(!(await isAuthenticated(request))) return withProxySecurityHeaders(buildLoginRedirect(request), {isSecureRequest});
  }

  if (pathname.startsWith('/api/')) {
    // Device APIs authenticate their host-only station cookie (pairing uses a one-time code).
    // A member cookie cannot authorize them and they never fall back to a member role.
    if (pathname === '/api/station' || pathname.startsWith('/api/station/')) {
      const next=await forwardHiddenFields(request,null);
      const response=withProxySecurityHeaders(next,{isSecureRequest});
      if(pathname==='/api/station/file') response.headers.set('X-Frame-Options','SAMEORIGIN');
      return response;
    }
    // These handlers perform their own credential and private-pilot checks.
    const mobileBearerRoute = pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/me' || pathname.startsWith('/api/v1/field/') || pathname.startsWith('/api/mobile/v1/');
    if(privateAccessEmail() && !mobileBearerRoute && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/health') && !pathname.startsWith('/api/cron/') && !pathname.startsWith('/api/telemetry/') && !(await isAuthenticated(request))) return withProxySecurityHeaders(NextResponse.json({error:'Oturum açmanız gerekiyor.'},{status:401}),{isSecureRequest});
    // Exempt and auth paths still lose any hidden-field header a client sent.
    let next = await forwardHiddenFields(request, null);
    if (!pathname.startsWith('/api/auth/') && !gateExempt(pathname)) {
      const token = await sessionToken(request);
      const refused = await accessGate(request, token, pathname, method, isSecureRequest);
      if (refused) return refused;
      try {
        next = await forwardHiddenFields(request, token);
      } catch (e) {
        // Without knowing which fields to hide, nothing is served.
        console.error('[proxy] field access failed', e instanceof Error ? e.message : e);
        return withProxySecurityHeaders(NextResponse.json({ error: 'Yetki doğrulanamadı; tekrar deneyin.' }, { status: 503 }), { isSecureRequest });
      }
    }
    const response = withProxySecurityHeaders(next, { isSecureRequest });
    if (pathname.startsWith('/api/v1/production/files/') || pathname === '/api/storage/content' || /^\/api\/v1\/knowledge\/[^/]+\/content$/.test(pathname) || /^\/api\/orders\/documents\/[^/]+\/content$/.test(pathname)) response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    return response;
  }

  if (isStaticAsset(pathname) || isPublicPage(pathname)) {
    return withProxySecurityHeaders(NextResponse.next(), { isSecureRequest });
  }

  const token = await sessionToken(request);
  if (!token) {
    return withProxySecurityHeaders(buildLoginRedirect(request), { isSecureRequest });
  }

  const access = evaluateRouteAccess(token.role, pathname, method);
  if (access.type === 'forbidden') {
    return withProxySecurityHeaders(NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 }), { isSecureRequest });
  }
  if (access.type === 'redirect') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = access.destination;
    dashboardUrl.search = '';
    return withProxySecurityHeaders(NextResponse.redirect(dashboardUrl, 302), { isSecureRequest });
  }
  const refused = await accessGate(request, token, pathname, method, isSecureRequest);
  if (refused) return refused;

  // Server-rendered pages read the same hidden-field header as the API routes.
  let next: NextResponse;
  try {
    next = await forwardHiddenFields(request, token);
  } catch (e) {
    console.error('[proxy] field access failed', e instanceof Error ? e.message : e);
    return withProxySecurityHeaders(buildLoginRedirect(request), { isSecureRequest });
  }
  return withProxySecurityHeaders(next, { isSecureRequest });
}

export const config = {
  matcher: '/:path*',
};
