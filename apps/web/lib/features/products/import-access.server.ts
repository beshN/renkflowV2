import 'server-only';
import type { ServerUserContext } from '@/lib/features/auth/serverAuth';
import { can } from '@/lib/security/access-matrix';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
export const canImportProductCards = (ctx: ServerUserContext) => ['owner','admin'].includes(ctx.role) && (!ctx.narrowed || can(ctx.narrowed,'inventory','create'));
export const canImportProductRecipes = (ctx: ServerUserContext) => ['owner','admin'].includes(ctx.role) && (!ctx.narrowed || (can(ctx.narrowed,'production','create') && can(ctx.narrowed,'production','edit')));
export function assertProductImportAccess(ctx: ServerUserContext, kind: 'cards' | 'recipes') {
  if (!(kind === 'cards' ? canImportProductCards(ctx) : canImportProductRecipes(ctx))) throw new WorkOrderApiError('Bu aktarım için yetkiniz yok',403);
}
