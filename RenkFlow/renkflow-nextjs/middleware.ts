import { NextRequest, NextResponse } from 'next/server';

const COMING_SOON_PATH = '/coming-soon';

const passthroughPrefixes = [
  '/api',
  '/_next',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/logo',
];

function isRenkflowHost(host: string | null) {
  if (!host) return false;
  return host === 'renkflow.com' || host.endsWith('.renkflow.com');
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const { pathname } = request.nextUrl;

  if (!isRenkflowHost(host)) {
    return NextResponse.next();
  }

  if (pathname === COMING_SOON_PATH || pathname.startsWith(`${COMING_SOON_PATH}/`)) {
    return NextResponse.next();
  }

  if (passthroughPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = COMING_SOON_PATH;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: '/:path*',
};
