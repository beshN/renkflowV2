import 'server-only';

import { tableExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can, type Action, type Module } from '@/lib/security/access-matrix';

/** The chain screens exist only after migration 045; until then they say so. */
export async function requireChain() {
  if (!(await tableExists('installations'))) throw new WorkOrderApiError('Satış–montaj–servis zinciri için veritabanı güncellemesi (045) bekleniyor', 409);
}

/** The member's own access (role and its matrix, read fresh) must hold this cell. */
export async function requireCap(actor: WorkOrderActor, module: Module, action: Action, what: string) {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated) throw new WorkOrderApiError('Unauthorized', 401);
  if (!can(access, module, action)) throw new WorkOrderApiError(`${what} için yetkiniz yok`, 403);
  return access;
}

export async function hasCap(actor: WorkOrderActor, module: Module, action: Action) {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  return Boolean(access && !access.deactivated && can(access, module, action));
}

/** The next number of a firm's record series (MNT-000001), serialized per firm and series. */
export async function nextNumber(tx: any, tenantId: string, table: 'leads' | 'installations' | 'service_tickets', column: string, prefix: string) {
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ':' + table}, 0))`;
  const [row] = await tx`SELECT count(*)::int AS n FROM ${tx(table)} WHERE tenant_id = ${tenantId}`;
  let n = Number(row?.n ?? 0) + 1;
  // A deleted record leaves a gap; skip numbers already used.
  for (;;) {
    const candidate = `${prefix}-${String(n).padStart(6, '0')}`;
    const [taken] = await tx`SELECT 1 FROM ${tx(table)} WHERE tenant_id = ${tenantId} AND ${tx(column)} = ${candidate}`;
    if (!taken) return candidate;
    n++;
  }
}

export const isoDay = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);
