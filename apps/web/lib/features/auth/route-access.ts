import { canAccessRoute, type UserRole } from './permissions';

const ROLES: readonly string[] = ['owner', 'admin', 'accountant', 'office', 'worker', 'member'];

export type RouteAccessAction = { type: 'next' } | { type: 'redirect'; destination: string } | { type: 'forbidden' };

/**
 * Server-side screen boundary for signed-in users (run in proxy.ts before the page or its server actions).
 * Navigation to a screen the role cannot use goes back to the dashboard; any other method (server
 * actions POST to the page URL) is refused with 403, so the action never runs.
 * The role comes from the signed session token; data APIs still re-check the current membership.
 */
export function evaluateRouteAccess(role: unknown, pathname: string, method: string): RouteAccessAction {
  if (typeof role !== 'string' || !ROLES.includes(role)) return { type: 'next' };
  if (canAccessRoute(role as UserRole, pathname)) return { type: 'next' };
  const upper = method.toUpperCase();
  return upper === 'GET' || upper === 'HEAD' ? { type: 'redirect', destination: role==='worker'?'/production/worker':'/dashboard' } : { type: 'forbidden' };
}
