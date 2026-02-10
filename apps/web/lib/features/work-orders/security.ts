import 'server-only';

import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { UserRole } from '@/lib/features/auth/permissions';

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
  userId: string;
  tenantId: string;
  role: UserRole;
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

  constructor(message: string, status: number) {
    super(message);
    this.name = 'WorkOrderApiError';
    this.status = status;
  }
}

export function hasWorkOrderPermission(role: UserRole, permission: WorkOrderPermission): boolean {
  return ROLE_PERMISSION_MAP[role]?.includes(permission) || false;
}

export function requireWorkOrderPermission(actor: WorkOrderActor, permission: WorkOrderPermission): void {
  if (!hasWorkOrderPermission(actor.role, permission)) {
    throw new WorkOrderApiError('Bu işlem için yetkiniz yok', 403);
  }
}

export async function requireWorkOrderActor(): Promise<WorkOrderActor> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    throw new WorkOrderApiError('Unauthorized', 401);
  }

  const membershipResult = await sql`
    SELECT role
    FROM tenant_members
    WHERE tenant_id = ${session.user.tenantId}
      AND user_id = ${session.user.id}
    LIMIT 1
  `;
  const membershipRows = membershipResult as Array<{ role: UserRole }>;
  const membership = membershipRows[0];
  if (!membership) {
    throw new WorkOrderApiError('Unauthorized', 401);
  }

  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: membership.role,
  };
}
