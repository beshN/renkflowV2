import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/features',
    '/pricing',
    '/integrations',
    '/contact',
    '/faq',
    '/blog',
    '/about',
    '/careers',
    '/privacy',
    '/terms',
    '/cookies',
    '/roadmap',
    '/changelog',
    '/full-landing',
  ];

  // Auth routes
  const authRoutes = [
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/update-password',
    '/auth/verify-email',
    '/auth/accept-invite',
  ];

  // API routes that should be public
  const publicApiRoutes = [
    '/api/auth',
    '/api/subscribe',
    '/api/signup',
    '/api/verify-email',
    '/api/forgot-password',
    '/api/reset-password',
  ];

  // Check if current path is public
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
  const isPublicApiRoute = publicApiRoutes.some(route => pathname.startsWith(route));
  const isApiRoute = pathname.startsWith('/api/');

  let response: NextResponse;

  // 1. Handle redirection and routing logic
  if (isPublicRoute || isPublicApiRoute) {
    response = NextResponse.next();
  } else if (isLoggedIn && isAuthRoute) {
    response = NextResponse.redirect(new URL('/dashboard', req.url));
  } else if (!isLoggedIn && !isAuthRoute && !isApiRoute) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    response = NextResponse.redirect(loginUrl);
  } else {
    response = NextResponse.next();
  }

  // 2. Add Security Headers (from former proxy.ts)
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // 3. Content Security Policy
  if (process.env.NODE_ENV === 'production') {
    const csp = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: blob: https:;
      connect-src 'self' https://*.supabase.co https://*.neon.tech wss://*.supabase.co https://*.r2.cloudflarestorage.com;
      frame-src 'self' blob: https:;
      frame-ancestors 'self';
      form-action 'self';
      base-uri 'self';
    `.replace(/\s{2,}/g, ' ').trim();
    response.headers.set('Content-Security-Policy', csp);
  }

  return response;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
