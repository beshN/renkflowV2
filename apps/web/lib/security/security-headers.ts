// Security headers set by `proxy.ts` on every response.
//
// CSP: the enforced policy holds only directives that cannot break the app. The full policy runs
// report-only until the violations it reports in the browser console are cleared; then it moves
// to nonce-based enforcement in the proxy. frame-ancestors stays with X-Frame-Options, because
// document previews are framed same-origin (see the SAMEORIGIN override in `proxy.ts`).

export const CONTENT_SECURITY_POLICY = "base-uri 'self'; object-src 'none'";

export const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Content-Security-Policy-Report-Only': CONTENT_SECURITY_POLICY_REPORT_ONLY,
};
