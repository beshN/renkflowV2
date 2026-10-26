import 'server-only';

import { recordAudit } from '@/lib/audit/audit-log';
import { columnExists } from '@/lib/db/schema-guard';
import { getMfaState, isMfaEnabled } from './mfa.server';
import { mfaSetupRequired, policyChangeProblem } from './mfa-policy';

type Db = any;

export class MfaPolicyError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Until migration 078 is applied the policy is off and cannot be changed; nobody is sent anywhere. */
async function policyColumnReady(): Promise<boolean> {
  try {
    return await columnExists('tenants', 'require_mfa_for_admins');
  } catch {
    return false;
  }
}

export async function readMfaPolicy(db: Db, tenantId: string): Promise<{ available: boolean; requireForAdmins: boolean }> {
  if (!(await policyColumnReady())) return { available: false, requireForAdmins: false };
  const [row] = await db`SELECT require_mfa_for_admins FROM tenants WHERE id = ${tenantId}`;
  return { available: true, requireForAdmins: Boolean(row?.require_mfa_for_admins) };
}

/** Whether this member must set up two-step sign-in first. False whenever it cannot be told. */
export async function mfaSetupRequiredFor(db: Db, input: { userId: string; tenantId: string; role: string | null | undefined }): Promise<boolean> {
  try {
    const policy = await readMfaPolicy(db, input.tenantId);
    if (!policy.requireForAdmins) return false;
    const state = await getMfaState(db, input.userId);
    return mfaSetupRequired({ policyOn: true, role: input.role, mfaAvailable: state.available, mfaEnabled: state.enabled });
  } catch {
    return false;
  }
}

/** Owner only; turning it on needs the owner's own two-step sign-in, so the firm cannot be locked out. */
export async function setMfaPolicy(db: Db, input: { tenantId: string; actorId: string; actorRole: string | null | undefined; enabled: boolean }) {
  const available = await policyColumnReady();
  const problem = policyChangeProblem({
    available,
    actorRole: input.actorRole,
    enabling: input.enabled,
    actorMfaEnabled: input.enabled && available ? await isMfaEnabled(db, input.actorId) : false,
  });
  if (problem) throw new MfaPolicyError(problem, input.actorRole !== 'owner' && available ? 403 : 400);
  return db.begin(async (tx: Db) => {
    const [before] = await tx`SELECT require_mfa_for_admins FROM tenants WHERE id = ${input.tenantId} FOR UPDATE`;
    if (!before) throw new MfaPolicyError('Firma bulunamadı.', 404);
    if (Boolean(before.require_mfa_for_admins) !== input.enabled) {
      await tx`UPDATE tenants SET require_mfa_for_admins = ${input.enabled}, updated_at = now() WHERE id = ${input.tenantId}`;
      await recordAudit(tx, {
        tenantId: input.tenantId,
        actorId: input.actorId,
        entityType: 'tenant',
        entityId: input.tenantId,
        action: 'settings_updated',
        changes: { require_mfa_for_admins: { from: Boolean(before.require_mfa_for_admins), to: input.enabled } },
      });
    }
    return { available: true, requireForAdmins: input.enabled };
  });
}
