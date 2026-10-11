/** Integration test for roles, field hiding, deactivation and sessions (gece 2, Tur 1), on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  // The migration runs twice: it must be idempotent.
  for (const file of ['038_notification_json.sql', '044_access_control.sql', '044_access_control.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const access = await import('../lib/security/member-access.server');
  const team = await import('../lib/security/team.server');
  const identity = await import('../lib/features/auth/session-identity');
  const notifications = await import('../lib/notifications/service');
  const { requirePermission } = await import('../lib/features/auth/serverAuth');

  const tenantId = randomUUID();
  const ids: Record<string, string> = {};
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Yetki Test', ${'access-' + tenantId.slice(0, 8)})`;
  for (const role of ['owner', 'admin', 'admin2', 'office', 'worker', 'accountant']) {
    ids[role] = randomUUID();
    await db`INSERT INTO users (id, email, name) VALUES (${ids[role]}, ${`${role}-${ids[role]}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ids[role]}, ${role === 'admin2' ? 'admin' : role})`;
  }
  const owner = { tenantId, userId: ids.owner, role: 'owner' as const };
  const admin = { tenantId, userId: ids.admin, role: 'admin' as const };
  const office = { tenantId, userId: ids.office, role: 'office' as const };

  // Without a chosen role a member keeps today's behaviour: the base role's preset, nothing narrowed.
  let a = await access.resolveMemberAccess(ids.office, tenantId);
  assert.equal(a?.roleKey, 'office');
  assert.deepEqual(await access.narrowedHiddenFields(ids.office, tenantId), []);
  assert.equal(await access.accessDecision(ids.office, tenantId, '/api/v1/purchases', 'GET'), null);
  assert.deepEqual(await access.narrowedHiddenFields(ids.worker, tenantId), [], 'the worker keeps its own technical DTOs');

  // Planning preset: narrowed matrix and hidden prices; refused attempts are written to the trail.
  await team.updateMember(owner, ids.office, { accessRole: 'planning' });
  access.forgetMemberAccess(ids.office, tenantId);
  a = await access.resolveMemberAccess(ids.office, tenantId);
  assert.equal(a?.roleKey, 'planning');
  assert.ok((await access.narrowedHiddenFields(ids.office, tenantId)).includes('price'));
  assert.equal(await access.accessDecision(ids.office, tenantId, '/api/v1/orders', 'GET'), null);
  const denied = await access.accessDecision(ids.office, tenantId, '/api/v1/quotations', 'GET');
  assert.equal(denied?.status, 403);
  await access.logAccessDenied({ tenantId, userId: ids.office, path: '/api/v1/quotations', method: 'GET', module: 'quotations', action: 'view', reason: 'role' });
  const [log] = await db`SELECT action, metadata FROM activity_logs WHERE tenant_id = ${tenantId} AND action = 'access_denied'`;
  assert.equal(log.metadata.path, '/api/v1/quotations');
  // Server actions and API helpers that check a permission honour the matrix too.
  const narrowedCtx = { userId: ids.office, tenantId, role: 'office' as const, email: '', name: '', narrowed: { permissions: a!.permissions, hidden: a!.hidden } };
  assert.throws(() => requirePermission(narrowedCtx, 'customers.create'), /yetkiniz/);
  assert.doesNotThrow(() => requirePermission(narrowedCtx, 'orders.view'));

  // Who may change whom.
  await assert.rejects(team.updateMember(admin, ids.admin2, { role: 'office' }), /Yöneticileri yalnız firma sahibi/);
  await assert.rejects(team.updateMember(admin, ids.owner, { role: 'office' }), /sahibinin/);
  await assert.rejects(team.setMemberActive(admin, ids.admin, false), /Kendi/);
  await assert.rejects(team.updateMember(admin, ids.worker, { accessRole: 'sales' }), /uymuyor/);
  await assert.rejects(team.updateMember(office, ids.worker, { role: 'member' }), /yalnız firma sahibi/);
  // A role change drops an access role that no longer fits.
  await team.updateMember(owner, ids.office, { role: 'accountant' });
  assert.equal((await db`SELECT access_role FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${ids.office}`)[0].access_role, null);
  await team.updateMember(owner, ids.office, { role: 'office' });

  // A role-only change keeps an access role that still fits.
  await team.updateMember(owner, ids.office, { accessRole: 'sales' });
  await team.updateMember(owner, ids.office, { role: 'office' });
  assert.equal((await db`SELECT access_role FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${ids.office}`)[0].access_role, 'sales');
  await team.updateMember(owner, ids.office, { accessRole: null });
  // Roles on the admin base are the owner's to manage, like admins themselves.
  await assert.rejects(team.saveRole(admin, null, { name: 'Alt yönetici', base: 'admin', permissions: {}, hidden: [] }), /yalnız firma sahibi/);

  // Custom role: only narrows its base; deleting it sends members back to the default.
  const roleId = await team.saveRole(admin, null, { name: 'Saha satış', base: 'office', permissions: { crm: ['create'], finance: ['view'], orders: ['view'] }, hidden: ['cost', 'nonsense'] });
  const [stored] = await db`SELECT permissions, hidden_fields FROM access_roles WHERE id = ${roleId}`;
  assert.deepEqual(stored.permissions, { crm: ['view', 'create'], orders: ['view'] }, 'finance is outside office and is dropped; create implies view');
  assert.deepEqual(stored.hidden_fields, ['cost']);
  await assert.rejects(team.saveRole(admin, null, { name: 'saha  SATIŞ', base: 'office', permissions: {}, hidden: [] }), /zaten/);
  await team.updateMember(admin, ids.office, { accessRole: roleId });
  access.forgetMemberAccess(ids.office, tenantId);
  a = await access.resolveMemberAccess(ids.office, tenantId);
  assert.equal(a?.roleName, 'Saha satış');
  assert.equal((await access.accessDecision(ids.office, tenantId, '/api/v1/inventory', 'GET'))?.status, 403);
  const roles = await team.listRoles(admin);
  assert.equal(roles.custom.find((r) => r.id === roleId)?.members, 1);
  await team.deleteRole(admin, roleId);
  access.forgetMemberAccess(ids.office, tenantId);
  assert.equal((await access.resolveMemberAccess(ids.office, tenantId))?.roleKey, 'office');

  // Sessions: one closed, or all of a person's.
  const sid = await identity.openSession(ids.worker, tenantId);
  assert.ok(sid);
  const iat = Math.floor(Date.now() / 1000) - 5;
  assert.equal(await access.sessionRevoked(ids.worker, sid, iat), false);
  const listed = await team.listSessions(tenantId, ids.worker, sid);
  assert.equal(listed.find((s) => s.id === sid)?.current, true);
  await assert.rejects(team.revokeSession({ tenantId, userId: ids.accountant, role: 'accountant' }, sid!), /yalnız firma sahibi/);
  await team.revokeSession(admin, sid!);
  assert.equal(await access.sessionRevoked(ids.worker, sid, iat), true);
  const sid2 = await identity.openSession(ids.accountant, tenantId);
  await team.revokeAllSessions({ tenantId, userId: ids.accountant, role: 'accountant' }, ids.accountant);
  access.forgetSessions(ids.accountant);
  assert.equal(await access.sessionRevoked(ids.accountant, null, iat), true, 'tokens issued before "close all" no longer count');
  assert.equal(await access.sessionRevoked(ids.accountant, sid2, Math.floor(Date.now() / 1000) + 2), true);

  // A manager closes a member's sessions in this firm only (the person may belong to other firms).
  const otherTenant = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${otherTenant}, 'Başka Firma', ${'other-' + otherTenant.slice(0, 8)})`;
  const here = await identity.openSession(ids.worker, tenantId);
  const there = await identity.openSession(ids.worker, otherTenant);
  await team.revokeAllSessions(admin, ids.worker, 'admin');
  const rows = await db`SELECT id, revoked_at FROM user_sessions WHERE id IN (${here}, ${there})`;
  assert.ok(rows.find((r) => r.id === here)?.revoked_at);
  assert.equal(rows.find((r) => r.id === there)?.revoked_at, null);
  assert.equal((await db`SELECT sessions_valid_after FROM users WHERE id = ${ids.worker}`)[0].sessions_valid_after, null);
  await assert.rejects(team.revokeSession(admin, there!), /bulunamadı/);
  await db`DELETE FROM tenants WHERE id = ${otherTenant}`;

  // Deactivation: records stay, sign-in ends, then it can be undone.
  const sid3 = await identity.openSession(ids.worker, tenantId);
  await team.setMemberActive(owner, ids.worker, false);
  assert.equal((await access.resolveMemberAccess(ids.worker, tenantId))?.deactivated, true);
  assert.equal(await identity.refreshSessionIdentity({ id: ids.worker, tenantId } as any), null);
  assert.equal((await access.accessDecision(ids.worker, tenantId, '/api/v1/orders', 'GET'))?.status, 401);
  assert.ok((await db`SELECT revoked_at FROM user_sessions WHERE id = ${sid3}`)[0].revoked_at);
  assert.equal((await db`SELECT count(*)::int AS n FROM users WHERE id = ${ids.worker}`)[0].n, 1, 'the person and their records stay');
  await team.setMemberActive(owner, ids.worker, true);
  access.forgetMemberAccess(ids.worker, tenantId);
  assert.equal((await access.resolveMemberAccess(ids.worker, tenantId))?.deactivated, false);
  assert.ok(await identity.refreshSessionIdentity({ id: ids.worker, tenantId } as any));

  // Invites list never carries the token.
  await db`INSERT INTO invitations (tenant_id, email, token, role, access_role, invited_by, expires_at) VALUES (${tenantId}, 'yeni@test.local', ${'tok-' + randomUUID()}, 'office', 'sales', ${ids.owner}, now() + interval '3 days')`;
  const invites = await team.listInvites(owner);
  assert.equal(invites[0].accessRoleName, 'Satış');
  assert.ok(!JSON.stringify(invites).includes('tok-'));

  // Team listing: status, access role and hidden fields per member.
  const members = await team.listTeam(owner);
  assert.equal(members.find((m) => m.userId === ids.worker)?.hidden.length, 4);

  // Notification preference: an in-app kind turned off creates nothing; others still arrive.
  await notifications.updateNotificationPreferences(ids.admin, { inApp: { mention: false } as any });
  assert.equal(await notifications.createNotification(ids.admin, tenantId, 'mention', 'x', 'y'), null);
  assert.ok(await notifications.createNotification(ids.admin, tenantId, 'reminder', 'x', 'y'));

  // Every change above is in the single audit trail.
  const actions = (await db`SELECT DISTINCT action FROM activity_logs WHERE tenant_id = ${tenantId}`).map((r) => r.action);
  for (const want of ['member_role_changed', 'role_created', 'role_deleted', 'session_revoked', 'sessions_revoked_all', 'member_deactivated', 'member_reactivated', 'access_denied'])
    assert.ok(actions.includes(want), `audit has ${want}`);

  await db`DELETE FROM tenants WHERE id = ${tenantId}`;
  await db`DELETE FROM users WHERE id = ANY(${Object.values(ids)}::uuid[])`;
  await db.end();
  const { sql } = await import('../lib/db');
  await (sql as any).end?.();
  console.log('test:access OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
