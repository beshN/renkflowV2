const COMING_SOON_MODE = 'coming-soon';

const PUBLIC_PATHS = new Set([
  '/coming-soon',
  '/auth/login',
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

function isAuthLoginPath(pathname: string): boolean {
  return pathname === '/auth/login' || pathname.startsWith('/auth/login/');
}

function isRootPath(pathname: string): boolean {
  return pathname === '/';
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isAuthApiPath(pathname: string): boolean {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

export type MiddlewareAction =
  | { type: 'next' }
  | { type: 'subscribeOptions' }
  | { type: 'rewrite'; destination: '/coming-soon' }
  | { type: 'redirect'; destination: '/coming-soon' }
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

  const normalizedMethod = method.toUpperCase();

  if (isApiPath(pathname)) {
    if (pathname === '/api/subscribe') {
      if (normalizedMethod === 'POST') {
        return { type: 'next' };
      }
      if (normalizedMethod === 'OPTIONS') {
        return { type: 'subscribeOptions' };
      }
    }

    if (isAuthApiPath(pathname)) {
      return { type: 'next' };
    }

    return { type: 'api404' };
  }

  if (
    isNextInternalPath(pathname) ||
    PUBLIC_PATHS.has(pathname) ||
    isPublicFile(pathname) ||
    isComingSoonPath(pathname) ||
    isAuthLoginPath(pathname)
  ) {
    return { type: 'next' };
  }

  if ((normalizedMethod === 'GET' || normalizedMethod === 'HEAD') && isRootPath(pathname)) {
    return { type: 'rewrite', destination: '/coming-soon' };
  }

  return { type: 'redirect', destination: '/coming-soon' };
}
