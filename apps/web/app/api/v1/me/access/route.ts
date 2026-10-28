import { NextResponse } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { DEFAULT_PRESET } from '@/lib/security/access-matrix';

export const dynamic = 'force-dynamic';

/** Your effective access: role, module × action matrix and hidden fields (drives the menu). */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor({ allowDuringMfaSetup: true });
    const access = await resolveMemberAccess(actor.userId, actor.tenantId);
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    return NextResponse.json({
      roleKey: access.roleKey, roleName: access.roleName, base: access.base, permissions: access.permissions, hidden: access.hidden,
      // On the base role's own preset the matrix does not narrow (the existing role checks decide).
      narrowed: access.roleKey !== DEFAULT_PRESET[access.base],
    }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'me-access');
  }
}
