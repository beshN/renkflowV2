import { randomBytes } from 'node:crypto';

/** Use configured origins only; no provider key, DSN path or credentials enter the policy. */
function configuredOrigin(value: string | undefined): string[] {
  try {
    const url = new URL(value || '');
    return ['https:', 'http:', 'wss:', 'ws:'].includes(url.protocol) ? [url.origin] : [];
  } catch {
    return [];
  }
}

export function createCsp(pathname: string) {
  const nonce = randomBytes(32).toString('base64');
  const development = process.env.NODE_ENV === 'development';
  const sockets = [process.env.NEXT_PUBLIC_SOCKET_URL, process.env.NEXT_PUBLIC_WS_URL, process.env.NEXT_PUBLIC_SUPPORT_SOCKET_URL]
    .flatMap(configuredOrigin).flatMap(origin => [origin, origin.replace(/^http/, 'ws')]);
  const connections = [...new Set([
    "'self'",
    'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com',
    ...configuredOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN),
    ...sockets,
  ])];
  // Match the existing SAMEORIGIN preview exceptions in proxy.ts. Download handlers retain
  // their own stricter sandbox CSP; do not replace those response headers in route handlers.
  const preview = pathname === '/api/station/file' || pathname === '/api/storage/content'
    || pathname.startsWith('/api/v1/production/files/')
    || /^\/api\/v1\/knowledge\/[^/]+\/content$/.test(pathname)
    || /^\/api\/orders\/documents\/[^/]+\/content$/.test(pathname);
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com${development ? " 'unsafe-eval'" : ''}`,
    // React style props, motion, charts, Radix and printing use inline styles today.
    "style-src 'self' 'unsafe-inline'",
    // Existing remote logos, uploads and configurable map tiles; preserve current image policy.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connections.join(' ')}`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    `frame-ancestors '${preview ? 'self' : 'none'}'`,
    "base-uri 'self'", "object-src 'none'", "form-action 'self'",
  ].join('; ');
  return {
    nonce,
    policy,
    // Opt in only after authenticated flows have been verified; rollback always wins.
    header: process.env.CSP_ENFORCE === '1' && process.env.CSP_REPORT_ONLY !== '1'
      ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
  };
}
