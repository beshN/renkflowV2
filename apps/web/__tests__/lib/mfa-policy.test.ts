/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/schema-guard', () => ({ columnExists: jest.fn(async () => true) }));
jest.mock('@/lib/audit/audit-log', () => ({ recordAudit: jest.fn(async () => undefined) }));
jest.mock('@/lib/features/auth/mfa.server', () => ({
  isMfaEnabled: jest.fn(async () => false),
  getMfaState: jest.fn(async () => ({ available: true, enabled: false, recoveryCodesLeft: 0 })),
}));

import { columnExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { getMfaState, isMfaEnabled } from '@/lib/features/auth/mfa.server';
import {
  MFA_POLICY_ENABLE_NEEDS_OWN_MFA,
  MFA_POLICY_OWNER_ONLY,
  mfaSetupRequired,
  mfaSetupAllowsPath,
  pathAllowedDuringMfaSetup,
  policyChangeProblem,
} from '@/lib/features/auth/mfa-policy';
import { mfaSetupRequiredFor, readMfaPolicy, setMfaPolicy } from '@/lib/features/auth/mfa-policy.server';

/**
 * A tagged-template stand-in that answers the tenant row and records each statement. policyOn null
 * is a firm before migration 078 (the to_jsonb read yields no value); mfaOn whether the member has it.
 */
function fakeDb(policyOn: boolean | null, options: { mfaOn?: boolean; fail?: boolean } = {}) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const db: any = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('$X').replace(/\s+/g, ' ').trim();
    calls.push({ text, values });
    if (options.fail) throw new Error('connection timeout');
    if (/SELECT require_mfa_for_admins FROM tenants/i.test(text)) return [{ require_mfa_for_admins: policyOn }];
    if (/require_mfa_for_admins' AS policy/i.test(text)) return [{ policy: policyOn === null ? null : String(policyOn), mfa_table: true }];
    if (/FROM user_mfa/i.test(text)) return options.mfaOn ? [{ ok: 1 }] : [];
    return [];
  });
  db.begin = (fn: (tx: any) => unknown) => fn(db);
  return { db, calls };
}

beforeEach(() => {
  jest.clearAllMocks();
  (columnExists as jest.Mock).mockResolvedValue(true);
  (isMfaEnabled as jest.Mock).mockResolvedValue(false);
  (getMfaState as jest.Mock).mockResolvedValue({ available: true, enabled: false, recoveryCodesLeft: 0 });
});

describe('who must set up two-step sign-in', () => {
  const base = { policyOn: true, mfaAvailable: true, mfaEnabled: false };
  it('owners and admins without it, while the rule is on', () => {
    expect(mfaSetupRequired({ ...base, role: 'owner' })).toBe(true);
    expect(mfaSetupRequired({ ...base, role: 'admin' })).toBe(true);
  });
  it('nobody else, and nobody once it is set up or the rule is off', () => {
    for (const role of ['accountant', 'office', 'worker', 'member', null]) expect(mfaSetupRequired({ ...base, role })).toBe(false);
    expect(mfaSetupRequired({ ...base, role: 'owner', mfaEnabled: true })).toBe(false);
    expect(mfaSetupRequired({ ...base, role: 'owner', policyOn: false })).toBe(false);
    // Without the user_mfa table there is no way to set it up, so nobody is sent there.
    expect(mfaSetupRequired({ ...base, role: 'owner', mfaAvailable: false })).toBe(false);
  });
  it('keeps the account page open', () => {
    expect(pathAllowedDuringMfaSetup('/account')).toBe(true);
    expect(pathAllowedDuringMfaSetup('/account/x')).toBe(true);
    expect(pathAllowedDuringMfaSetup('/accounting')).toBe(false);
    expect(pathAllowedDuringMfaSetup('/dashboard')).toBe(false);
  });
});

describe('changing the rule', () => {
  it('only the owner, and turning it on needs their own two-step sign-in', () => {
    expect(policyChangeProblem({ available: true, actorRole: 'admin', enabling: true, actorMfaEnabled: true })).toBe(MFA_POLICY_OWNER_ONLY);
    expect(policyChangeProblem({ available: true, actorRole: 'owner', enabling: true, actorMfaEnabled: false })).toBe(MFA_POLICY_ENABLE_NEEDS_OWN_MFA);
    expect(policyChangeProblem({ available: true, actorRole: 'owner', enabling: true, actorMfaEnabled: true })).toBeNull();
    expect(policyChangeProblem({ available: true, actorRole: 'owner', enabling: false, actorMfaEnabled: false })).toBeNull();
    expect(policyChangeProblem({ available: false, actorRole: 'owner', enabling: true, actorMfaEnabled: true })).not.toBeNull();
  });

  it('refuses an owner without two-step sign-in and writes nothing', async () => {
    const { db, calls } = fakeDb(false);
    await expect(setMfaPolicy(db, { tenantId: 't1', actorId: 'u1', actorRole: 'owner', enabled: true })).rejects.toThrow(MFA_POLICY_ENABLE_NEEDS_OWN_MFA);
    expect(calls).toEqual([]);
  });

  it('refuses an admin with 403', async () => {
    const { db } = fakeDb(false);
    await expect(setMfaPolicy(db, { tenantId: 't1', actorId: 'u1', actorRole: 'admin', enabled: false })).rejects.toMatchObject({ status: 403 });
  });

  it('turns it on for the owner\'s own firm and records it', async () => {
    (isMfaEnabled as jest.Mock).mockResolvedValue(true);
    const { db, calls } = fakeDb(false);
    expect(await setMfaPolicy(db, { tenantId: 't1', actorId: 'u1', actorRole: 'owner', enabled: true })).toEqual({ available: true, requireForAdmins: true });
    const update = calls.find((c) => /^UPDATE tenants/i.test(c.text));
    expect(update?.values).toEqual([true, 't1']);
    expect(recordAudit).toHaveBeenCalledWith(db, expect.objectContaining({ tenantId: 't1', changes: { require_mfa_for_admins: { from: false, to: true } } }));
  });

  it('cannot be changed before migration 078', async () => {
    (columnExists as jest.Mock).mockResolvedValue(false);
    const { db, calls } = fakeDb(false);
    await expect(setMfaPolicy(db, { tenantId: 't1', actorId: 'u1', actorRole: 'owner', enabled: false })).rejects.toThrow(/henüz etkin değil/);
    expect(calls).toEqual([]);
  });
});

describe('reading the rule', () => {
  it('is off and sends nobody anywhere before migration 078', async () => {
    (columnExists as jest.Mock).mockResolvedValue(false);
    const { db } = fakeDb(null);
    expect(await readMfaPolicy(db, 't1')).toEqual({ available: false, requireForAdmins: false });
    expect(await mfaSetupRequiredFor(db, { userId: 'u1', tenantId: 't1', role: 'owner' })).toBe(false);
  });

  it('sends an owner without two-step sign-in to set-up when the rule is on', async () => {
    const { db } = fakeDb(true);
    expect(await mfaSetupRequiredFor(db, { userId: 'u1', tenantId: 't1', role: 'owner' })).toBe(true);
    expect(await mfaSetupRequiredFor(db, { userId: 'u1', tenantId: 't1', role: 'admin' })).toBe(true);
    expect(await mfaSetupRequiredFor(db, { userId: 'u1', tenantId: 't1', role: 'office' })).toBe(false);
  });

  it('lets an owner who has set it up through, and nobody is sent while the rule is off', async () => {
    expect(await mfaSetupRequiredFor(fakeDb(true, { mfaOn: true }).db, { userId: 'u2', tenantId: 't1', role: 'owner' })).toBe(false);
    expect(await mfaSetupRequiredFor(fakeDb(false).db, { userId: 'u3', tenantId: 't1', role: 'owner' })).toBe(false);
  });

  it('fails closed for owners and admins only when the rule cannot be read', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { db, calls } = fakeDb(true, { fail: true });
      expect(await mfaSetupRequiredFor(db, { userId: 'u4', tenantId: 't1', role: 'owner' })).toBe(true);
      expect(await mfaSetupRequiredFor(db, { userId: 'u4', tenantId: 't1', role: 'admin' })).toBe(true);
      const before = calls.length;
      expect(await mfaSetupRequiredFor(db, { userId: 'u5', tenantId: 't1', role: 'office' })).toBe(false);
      expect(await mfaSetupRequiredFor(db, { userId: 'u5', tenantId: 't1', role: 'worker' })).toBe(false);
      expect(calls.length).toBe(before); // other roles never even ask
    } finally {
      error.mockRestore();
    }
  });
});

describe('what stays open while set-up is outstanding', () => {
  it('only the account page, its own APIs, who-am-I, consent and signing out', () => {
    for (const path of ['/account', '/account/security', '/api/auth/signout', '/api/auth/session', '/api/v1/me/gate', '/api/v1/me/mfa', '/api/v1/me/consent', '/api/v1/me/sessions/abc', '/api/v1/auth/me', '/api/mobile/v1/auth/me', '/api/mobile/v1/auth/logout'])
      expect([path, mfaSetupAllowsPath(path)]).toEqual([path, true]);
    for (const path of ['/dashboard', '/orders', '/api/v1/orders', '/api/v1/finance/summary', '/api/tenant/mfa-policy', '/api/storage/content', '/api/v1/office', '/api/mobile/v1/snapshot', '/api/v1/field/snapshot', '/api/v1/meeting'])
      expect([path, mfaSetupAllowsPath(path)]).toEqual([path, false]);
  });
});
