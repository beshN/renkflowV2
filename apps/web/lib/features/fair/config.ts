/**
 * Product configurator settings. Also loaded by the Next.js proxy, so no database or server-only imports.
 *
 * FAIR_TENANT_ID   the firm whose designs and quote requests these are; unset = the module is off (404).
 * FAIR_HOSTS       comma-separated domains that serve only the configurator (configurator.renkaluminyum.com).
 * FAIR_PUBLIC_URL  the configurator's public address, used in e-mailed design links
 *                  (https://configurator.renkaluminyum.com); unset = NEXT_PUBLIC_APP_URL + /configurator.
 * FAIR_EMAIL_FROM  sender of the customer confirmation (a domain verified in Resend).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fairTenantId(): string | null {
  const id = process.env.FAIR_TENANT_ID?.trim() || '';
  return UUID.test(id) ? id.toLowerCase() : null;
}

export function fairHosts(): Set<string> {
  return new Set(
    (process.env.FAIR_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/:443$/, ''))
      .filter(Boolean),
  );
}

export function isFairHost(host: string | null): boolean {
  if (!host) return false;
  return fairHosts().has(host.toLowerCase().replace(/:443$/, ''));
}

/** App path of the configurator; on a configurator domain it is served from the root. */
export const CONFIGURATOR_PATH = '/configurator';
export const FAIR_API = '/api/v1/public/fair';
const LEGACY_PAGE = '/fuar';

/** Paths that belong to the configurator (pages and its public API). */
export function isFairPath(pathname: string): boolean {
  return [CONFIGURATOR_PATH, FAIR_API, LEGACY_PAGE].some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Public routes of a configurator domain → app paths: / , /fair/<code>, /c/<token>. */
export function configuratorRewrite(pathname: string): string | null {
  if (pathname === '/') return CONFIGURATOR_PATH;
  if (pathname === '/simulator' || pathname === '/simulator/') return CONFIGURATOR_PATH + '/simulator';
  if (/^\/(fair|c)\/[^/]+\/?$/.test(pathname)) return CONFIGURATOR_PATH + pathname.replace(/\/$/, '');
  return null;
}

/** Base of public design links (no trailing slash): https://configurator.renkaluminyum.com or …/configurator. */
export function configuratorBaseUrl(): string {
  const configured = process.env.FAIR_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  return `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}${CONFIGURATOR_PATH}`;
}
