import 'server-only';

import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess, type MemberAccess } from '@/lib/security/member-access.server';
import { can, routeRequirement } from '@/lib/security/access-matrix';
import { canAccessRoute } from '@/lib/features/auth/permissions';

/** Read fresh for every snapshot, tool call and returned action. */
export async function assistantAccess(actor: WorkOrderActor): Promise<MemberAccess> {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated) throw new WorkOrderApiError('Oturumunuz sona erdi.', 401);
  return access;
}

export function assistantRouteAllowed(access: MemberAccess, pathname: string): boolean {
  pathname = pathname.replace(/\/+$/, '') || '/';
  if (!canAccessRoute(access.base, pathname)) return false;
  if (pathname === '/new-order' || pathname === '/work-orders/new')
    return can(access, pathname === '/new-order' ? 'orders' : 'production', 'create');
  if (pathname === '/factory' || pathname.startsWith('/factory/')) return can(access, 'production', 'view');
  const need = routeRequirement(pathname, 'GET');
  return !need || can(access, need.module, need.action);
}
