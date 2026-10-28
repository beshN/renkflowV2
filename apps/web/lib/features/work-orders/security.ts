import 'server-only';
import type { StationCapability } from '@/lib/features/stations/contract';

import { mfaSetupPending, resolveMemberAccess } from '@/lib/security/member-access.server';
import { MFA_SETUP_REQUIRED_CODE, MFA_SETUP_REQUIRED_MESSAGE } from '@/lib/features/auth/mfa-policy';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { UserRole } from '@/lib/features/auth/permissions';
import { can, type Access } from '@/lib/security/access-matrix';

export type WorkOrderPermission =
  | 'view'
  | 'create'
  | 'edit'
  | 'assign'
  | 'transition'
  | 'close'
  | 'comment'
  | 'checklist'
  | 'delete';

export type WorkOrderActor = {
  /** Constructed only from a verified station cookie, never from member API input. */
  station?: StationCapability;
  userId: string;
  tenantId: string;
  role: UserRole;
  access?: Access;
};

const ROLE_PERMISSION_MAP: Record<UserRole, WorkOrderPermission[]> = {
  owner: ['view', 'create', 'edit', 'assign', 'transition', 'close', 'comment', 'checklist', 'delete'],
  admin: ['view', 'create', 'edit', 'assign', 'transition', 'close', 'comment', 'checklist', 'delete'],
  office: ['view', 'create', 'edit', 'assign', 'transition', 'close', 'comment', 'checklist'],
  accountant: ['view', 'create', 'comment', 'checklist'],
  member: ['view', 'comment', 'checklist'],
  worker: ['view', 'transition', 'comment', 'checklist'],
};

export class WorkOrderApiError extends Error {
  status: number;
  /** Machine-readable reason a client acts on (e.g. mfa_setup_required: send the person to set-up). */
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'WorkOrderApiError';
    this.status = status;
    if (code) this.code = code;
  }
}

export function hasWorkOrderPermission(role: UserRole, permission: WorkOrderPermission): boolean {
  return ROLE_PERMISSION_MAP[role]?.includes(permission) || false;
}

export function requireWorkOrderPermission(actor: WorkOrderActor, permission: WorkOrderPermission): void {
  if (!hasWorkOrderPermission(actor.role, permission)) {
    throw new WorkOrderApiError('Bu işlem için yetkiniz yok', 403);
  }
  if (actor.access) {
    const action = permission === 'view' ? 'view' : permission === 'create' ? 'create' : permission === 'delete' ? 'delete' : 'edit';
    const allowed = can(actor.access, 'production', action) || (['view','comment','checklist'].includes(permission) && can(actor.access, 'orders', action));
    if (!allowed) throw new WorkOrderApiError('Bu işlem için yetkiniz yok', 403);
  }
}

/**
 * The signed-in member as they are now (fresh membership, role and narrowing). While the firm
 * requires two-step sign-in of an owner/admin who has not set it up, this refuses with 403
 * mfa_setup_required, except for the few account endpoints that pass allowDuringMfaSetup (the
 * proxy applies the same rule to every path first).
 */
export async function requireWorkOrderActor(options: { allowDuringMfaSetup?: boolean } = {}): Promise<WorkOrderActor> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    throw new WorkOrderApiError('Unauthorized', 401);
  }

  const access = await resolveMemberAccess(session.user.id, session.user.tenantId);
  if (!access || access.deactivated) {
    throw new WorkOrderApiError('Unauthorized', 401);
  }
  if (!options.allowDuringMfaSetup && (await mfaSetupPending(session.user.id, session.user.tenantId, access.base, { cached: true })))
    throw new WorkOrderApiError(MFA_SETUP_REQUIRED_MESSAGE, 403, MFA_SETUP_REQUIRED_CODE);

  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: access.base,
    access,
  };
}
