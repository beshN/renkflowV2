import { accessRoleFits, describeAgent, inviteTtlDays, roleNameKey, teamChangeProblem } from '@/lib/security/team-rules';
import { channelStatus, normalizePreferences, PREFERENCE_EVENTS } from '@/lib/notifications/preferences';

const owner = { userId: 'o', role: 'owner' as const };
const admin = { userId: 'a', role: 'admin' as const };

describe('who may change whom on the team', () => {
  it('only owners and admins manage, never themselves', () => {
    expect(teamChangeProblem({ userId: 'x', role: 'office' }, { userId: 'w', role: 'worker', active: true }, { role: 'member' })).toMatch(/yalnız firma sahibi/);
    expect(teamChangeProblem(admin, { userId: 'a', role: 'admin', active: true }, { active: false })).toMatch(/Kendi/);
    expect(teamChangeProblem(owner, { userId: 'w', role: 'worker', active: true }, { role: 'office' })).toBeNull();
  });

  it('the owner is never changed or deactivated here, so a firm keeps its owner', () => {
    expect(teamChangeProblem(owner, { userId: 'o2', role: 'owner', active: true }, { active: false })).toMatch(/sahibinin/);
    expect(teamChangeProblem(owner, { userId: 'w', role: 'worker', active: true }, { role: 'owner' })).toMatch(/verilemez/);
  });

  it('an admin manages the roles below admin; only an owner manages admins', () => {
    expect(teamChangeProblem(admin, { userId: 'a2', role: 'admin', active: true }, { active: false })).toMatch(/Yöneticileri/);
    expect(teamChangeProblem(admin, { userId: 'w', role: 'worker', active: true }, { role: 'admin' })).toMatch(/Yöneticileri/);
    expect(teamChangeProblem(admin, { userId: 'w', role: 'worker', active: true }, { role: 'accountant' })).toBeNull();
    expect(teamChangeProblem(owner, { userId: 'a2', role: 'admin', active: true }, { role: 'office' })).toBeNull();
  });
});

describe('access role on a base role', () => {
  it('a preset fits only its own base; a custom role only the base it was made for', () => {
    expect(accessRoleFits('office', 'sales', [])).toBe(true);
    expect(accessRoleFits('worker', 'sales', [])).toBe(false);
    expect(accessRoleFits('office', 'r1', [{ id: 'r1', base: 'office' }])).toBe(true);
    expect(accessRoleFits('accountant', 'r1', [{ id: 'r1', base: 'office' }])).toBe(false);
    expect(accessRoleFits('member', null, [])).toBe(true);
  });
});

describe('invites and names', () => {
  it('invite lifetime stays between 1 and 30 days, 7 by default', () => {
    expect([inviteTtlDays(undefined), inviteTtlDays(''), inviteTtlDays(0), inviteTtlDays(3), inviteTtlDays(90), inviteTtlDays('abc')]).toEqual([7, 7, 1, 3, 30, 7]);
  });
  it('role names compare without case or extra spaces (Turkish İ/ı)', () => {
    expect(roleNameKey('  Saha   EKİBİ ')).toBe('saha ekibi');
  });
  it('device names come from the user agent', () => {
    expect(describeAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1')).toBe('Safari · iOS');
    expect(describeAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Edge · Windows');
    expect(describeAgent(null)).toBe('Bilinmeyen cihaz');
  });
});

describe('notification preferences', () => {
  it('every known event × channel is filled (on by default); unknown keys are dropped', () => {
    const p = normalizePreferences({ inApp: { mention: false, hack: false } as any, email: 'x' as any });
    expect(Object.keys(p.inApp)).toEqual(PREFERENCE_EVENTS.map((e) => e.type));
    expect(p.inApp.mention).toBe(false);
    expect(p.inApp.reminder).toBe(true);
    expect(p.email.mention).toBe(true);
    expect((p.inApp as any).hack).toBeUndefined();
  });
  it('only the in-app channel is reported as delivering; the others say they are not connected', () => {
    const s = channelStatus({ pushConfigured: false });
    expect([s.inApp.connected, s.email.connected, s.push.connected]).toEqual([true, false, false]);
    expect(s.push.note).toMatch(/yapılandırılmadı/);
  });
});
