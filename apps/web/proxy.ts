import { NextRequest, NextResponse } from 'next/server';
import { evaluateComingSoonRequest, normalizePublicSiteMode } from '@/lib/launch/comingSoonGate';

export function proxy(request: NextRequest) {
  const publicSiteMode = normalizePublicSiteMode(process.env.PUBLIC_SITE_MODE || 'off');
  const branchName =
    process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || process.env.BRANCH_NAME || '';
  const hostName = request.headers.get('host');
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const action = evaluateComingSoonRequest(pathname, method, publicSiteMode, branchName, hostName);

  if (action.type === 'next') {
    return NextResponse.next();
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
