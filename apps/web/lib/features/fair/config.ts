/**
 * Fair configurator settings. Also loaded by the Next.js proxy, so no database or server-only imports.
 *
 * FAIR_TENANT_ID   the firm whose leads the fair requests become; unset = the module is off (404).
 * FAIR_HOSTS       comma-separated domains that serve only the fair site (e.g. fuar.renkaluminyum.com).
 * FAIR_EVENT_NAME  optional label kept on every request (e.g. "Yapı Fuarı 2026").
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fairTenantId(): string | null {
  const id = process.env.FAIR_TENANT_ID?.trim() || '';
  return UUID.test(id) ? id.toLowerCase() : null;
}

export function fairEventName(): string | null {
  return process.env.FAIR_EVENT_NAME?.trim().slice(0, 120) || null;
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

export const FAIR_PAGE = '/fuar';
export const FAIR_API = '/api/v1/public/fair';

/** On a fair domain only the fair page, its API and static files are served. */
export function isFairPath(pathname: string): boolean {
  return pathname === FAIR_PAGE || pathname.startsWith(FAIR_PAGE + '/') || pathname === FAIR_API || pathname.startsWith(FAIR_API + '/');
}
