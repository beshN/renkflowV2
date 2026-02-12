const COMING_SOON_MODE = 'coming-soon';

const PUBLIC_PATHS = new Set([
  '/coming-soon',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
]);

const PUBLIC_ASSET_REGEX = /\.(?:avif|gif|ico|jpg|jpeg|json|mp4|png|svg|txt|webm|webmanifest|webp|woff|woff2)$/i;

function isNextInternalPath(pathname: string): boolean {
  return pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image');
}

function isPublicFile(pathname: string): boolean {
  return PUBLIC_ASSET_REGEX.test(pathname);
}

function isComingSoonPath(pathname: string): boolean {
  return pathname === '/coming-soon' || pathname.startsWith('/coming-soon/');
}

function isLoginPath(pathname: string): boolean {
  return pathname === '/auth/login' || pathname.startsWith('/auth/login/');
}

function isDashboardPath(pathname: string): boolean {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function isRootPath(pathname: string): boolean {
  return pathname === '/';
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isSubscribeApiPath(pathname: string): boolean {
  return pathname === '/api/subscribe';
}

export type MiddlewareAction =
  | { type: 'next' }
  | { type: 'subscribeOptions' }
  | { type: 'rewrite'; destination: '/coming-soon' | '/auth/login' | '/dashboard' }
  | { type: 'redirect'; destination: '/coming-soon' | '/auth/login' | '/dashboard' }
  | { type: 'api404' };

export function normalizePublicSiteMode(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

export function isComingSoonMode(value: string | null | undefined): boolean {
  return normalizePublicSiteMode(value) === COMING_SOON_MODE;
}

export function evaluateComingSoonRequest(pathname: string, method: string, publicSiteMode: string): MiddlewareAction {
  if (!isComingSoonMode(publicSiteMode)) {
    return { type: 'next' };
  }

  if (isApiPath(pathname)) {
    if (isSubscribeApiPath(pathname)) {
      if (method === 'POST') {
        return { type: 'next' };
      }
      if (method === 'OPTIONS') {
        return { type: 'subscribeOptions' };
      }
    }

    return { type: 'api404' };
  }

  if (
    isNextInternalPath(pathname) ||
    PUBLIC_PATHS.has(pathname) ||
    isPublicFile(pathname) ||
    isComingSoonPath(pathname)
  ) {
    return { type: 'next' };
  }

  if ((method === 'GET' || method === 'HEAD') && isRootPath(pathname)) {
    return { type: 'rewrite', destination: '/coming-soon' };
  }

  if (isLoginPath(pathname) || isDashboardPath(pathname) || method === 'GET' || method === 'HEAD') {
    return { type: 'redirect', destination: '/coming-soon' };
  }

  return { type: 'redirect', destination: '/coming-soon' };
}
