import 'server-only';
import { resolveMemberAccess } from './member-access.server';
import { can, type Action, type Module } from './access-matrix';
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from '@/lib/features/work-orders/security';
/** New workspaces use fresh membership and narrowing rules even when invoked outside the proxy. */
export async function requireModuleAccess(
  actor: WorkOrderActor,
  module: Module,
  action: Action = 'view',
) {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (
    !access ||
    access.deactivated ||
    access.base !== actor.role ||
    !can(access, module, action)
  )
    throw new WorkOrderApiError('Bu işlem için yetkiniz yok.', 403);
  return access;
}
