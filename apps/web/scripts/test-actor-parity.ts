/**
 * One actor for every kind of sign-in, on the isolated local test database only: a narrowed member
 * gets the same module decisions and hidden fields through an API token and a phone session as a
 * browser session gets in the proxy; the firm's two-step rule for owners/admins holds for API and
 * phone tokens (issuing, refreshing, using) and is off before its column exists; AI office tasks
 * marked as finance stay with their giver and cleared members.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

import mobileSpec from '../../../contracts/mobile/openapi.json';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'actor-parity-integration-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.ALLOW_LOCAL_DATABASE = '1';
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  const cleanup: Array<() => Promise<unknown>> = [];
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { NextRequest } = await import('next/server');
    const { proxy } = await import('../proxy');
    const { getAPIUser } = await import('../lib/shared/api/auth-helpers');
    const login = (await import('../app/api/v1/auth/login/route')).POST;
    const listOrders = (await import('../app/api/v1/orders/route')).GET;
    const listQuotations = (await import('../app/api/v1/quotations/route')).GET;
    const me = (await import('../app/api/v1/auth/me/route')).GET;
    const mobile = (await import('../app/api/mobile/v1/[...path]/route'));
    const policy = await import('../lib/features/auth/mfa-policy.server');
    const access = await import('../lib/security/member-access.server');
    const office = await import('../lib/features/office/service.server');
    const { markTaskSensitivity } = await import('../lib/features/office/data.server');

    const [tenant] = await db`INSERT INTO tenants (name, slug) VALUES ('Aktör eşliği', ${'actor-' + randomUUID()}) RETURNING id`;
    cleanup.push(() => db`DELETE FROM tenants WHERE id = ${tenant.id}`);
    const password = 'Local-test-only-Actor-4821!';
    const hash = await bcrypt.hash(password, 10);
    const people: Record<string, { id: string; email: string }> = {};
    for (const [key, role, accessRole] of [['owner', 'owner', null], ['admin', 'admin', null], ['planner', 'office', 'planning'], ['sales', 'office', 'sales'], ['office', 'office', null]] as const) {
      const email = `${key}-${randomUUID()}@example.invalid`;
      const [u] = await db`INSERT INTO users (name, email, password, email_verified) VALUES (${key}, ${email}, ${hash}, now()) RETURNING id`;
      cleanup.push(() => db`DELETE FROM users WHERE id = ${u.id}`);
      await db`INSERT INTO tenant_members (tenant_id, user_id, role, access_role) VALUES (${tenant.id}, ${u.id}, ${role}, ${accessRole})`;
      people[key] = { id: u.id, email };
    }

    let ip = 1;
    const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.66.0.${ip++}` }, body: JSON.stringify(body) });
    const apiLogin = async (who: string) => {
      const res = await login(new NextRequest('https://renkflow.com/api/v1/auth/login', json({ email: people[who].email, password })));
      const body = await res.json();
      return { status: res.status, code: body.code as string | undefined, token: body.data?.accessToken as string | undefined };
    };
    const mobileHeaders = (token?: string) => ({ 'content-type': 'application/json', 'x-renkflow-app-version': mobileSpec.info.version, 'x-renkflow-platform': 'android', 'x-forwarded-for': `10.66.1.${ip++}`, ...(token ? { authorization: `Bearer ${token}` } : {}) });
    const mobileCall = async (path: string, token?: string, body?: unknown) => {
      const init = body === undefined ? { method: 'GET', headers: mobileHeaders(token) } : { method: 'POST', headers: mobileHeaders(token), body: JSON.stringify(body) };
      const res = await (body === undefined ? mobile.GET : mobile.POST)(new NextRequest('https://renkflow.com/api/mobile/v1/' + path, init), { params: Promise.resolve({ path: path.split('/') }) });
      const value = await res.json();
      return { status: res.status, code: value.code as string | undefined, data: value.data };
    };
    const bearer = (path: string, token: string) => new NextRequest('https://renkflow.com' + path, { headers: { authorization: `Bearer ${token}` } });
    const throughProxy = async (path: string, token: string) => {
      const res = await proxy(bearer(path, token));
      return res.headers.get('x-middleware-next') === '1'
        ? { status: 200, hidden: res.headers.get('x-middleware-request-x-rf-hidden-fields') ?? '' }
        : { status: res.status, hidden: null, body: await res.json() };
    };

    // --- S-01: the narrowed planner, through an API token and a phone session ---------------------------------
    const planner = await apiLogin('planner');
    assert.equal(planner.status, 200);
    const plannerUser = await getAPIUser(bearer('/api/v1/orders', planner.token!));
    assert.equal(plannerUser?.via, 'api_token');
    assert.ok(plannerUser?.narrowed, 'the planning preset narrows the office role');
    assert.ok(plannerUser?.hidden?.includes('price'));
    assert.equal((await listOrders(bearer('/api/v1/orders', planner.token!))).status, 200, 'orders are in the planning matrix');
    const refused = await listQuotations(bearer('/api/v1/quotations', planner.token!));
    assert.equal(refused.status, 403, 'quotations are not in the planning matrix, even with the office base role');
    // The proxy gates the bearer request and forwards the same hidden fields a browser session gets.
    const gated = await throughProxy('/api/v1/quotations', planner.token!);
    assert.equal(gated.status, 403);
    const forwarded = await throughProxy('/api/v1/orders', planner.token!);
    assert.equal(forwarded.status, 200);
    assert.deepEqual(forwarded.hidden!.split(',').sort(), [...(await access.narrowedHiddenFields(people.planner.id, tenant.id, { cached: false }))].sort());
    const plannerPhone = await mobileCall('auth/login', undefined, { email: people.planner.email, password, deviceId: randomUUID() });
    assert.equal(plannerPhone.status, 200, 'the planner still uses the field app');
    const phoneUser = await getAPIUser(bearer('/api/v1/orders', plannerPhone.data.accessToken));
    assert.equal(phoneUser?.via, 'mobile');
    assert.deepEqual(phoneUser?.narrowed, plannerUser?.narrowed);
    assert.equal((await throughProxy('/api/v1/quotations', plannerPhone.data.accessToken)).status, 403);
    assert.equal((await mobileCall('snapshot', plannerPhone.data.accessToken)).status, 200);
    // A default office member keeps today's access.
    const officeToken = (await apiLogin('office')).token!;
    assert.equal((await listQuotations(bearer('/api/v1/quotations', officeToken))).status, 200);
    assert.equal((await throughProxy('/api/v1/quotations', officeToken)).hidden, '');
    console.log('PASS · S-01: API token and phone session get the narrowed matrix and hidden fields of the browser session, in the proxy and the route helpers');

    // --- S-04: the two-step rule for owners and admins --------------------------------------------------------
    const adminBefore = await apiLogin('admin');
    assert.equal(adminBefore.status, 200);
    const adminPhone = await mobileCall('auth/login', undefined, { email: people.admin.email, password, deviceId: randomUUID() });
    assert.equal(adminPhone.status, 200);
    // The owner turns the rule on (needs their own two-step sign-in, so the firm is not locked out).
    await assert.rejects(policy.setMfaPolicy(db, { tenantId: tenant.id, actorId: people.owner.id, actorRole: 'owner', enabled: true }), /kendi hesabınızda/);
    await db`INSERT INTO user_mfa (user_id, secret_sealed, enabled_at) VALUES (${people.owner.id}, 'sealed:v1:test-only', now())`;
    await policy.setMfaPolicy(db, { tenantId: tenant.id, actorId: people.owner.id, actorRole: 'owner', enabled: true });
    access.forgetMfaGate();
    assert.equal(await policy.mfaSetupRequiredFor(db, { userId: people.owner.id, tenantId: tenant.id, role: 'owner' }), false, 'the owner who turned it on is not locked out');
    assert.equal(await policy.mfaSetupRequiredFor(db, { userId: people.admin.id, tenantId: tenant.id, role: 'admin' }), true);
    // No new tokens for the admin without it.
    const adminAfter = await apiLogin('admin');
    assert.deepEqual([adminAfter.status, adminAfter.code], [403, 'mfa_setup_required']);
    const phoneAfter = await mobileCall('auth/login', undefined, { email: people.admin.email, password, deviceId: randomUUID() });
    assert.deepEqual([phoneAfter.status, phoneAfter.code], [403, 'mfa_setup_required']);
    const refresh = await mobileCall('auth/refresh', undefined, { refreshToken: adminPhone.data.refreshToken, deviceId: adminPhone.data.deviceId, requestId: randomUUID() });
    assert.deepEqual([refresh.status, refresh.code], [403, 'mfa_setup_required']);
    // Tokens issued before the rule stop working except for who-am-I and signing out.
    const blocked = await listOrders(bearer('/api/v1/orders', adminBefore.token!));
    assert.deepEqual([blocked.status, (await blocked.json()).code], [403, 'mfa_setup_required']);
    const proxied = await throughProxy('/api/v1/orders', adminBefore.token!);
    assert.deepEqual([proxied.status, proxied.body?.code], [403, 'mfa_setup_required']);
    assert.equal((await throughProxy('/api/v1/me/gate', adminBefore.token!)).status, 200, 'the gate stays reachable');
    assert.equal((await me(bearer('/api/v1/auth/me', adminBefore.token!))).status, 200);
    assert.deepEqual([(await mobileCall('snapshot', adminPhone.data.accessToken)).code], ['mfa_setup_required']);
    assert.equal((await mobileCall('auth/me', adminPhone.data.accessToken)).status, 200);
    // Others are not affected: the planner and the office member keep working, on the web API and the phone.
    assert.equal((await listOrders(bearer('/api/v1/orders', officeToken))).status, 200);
    assert.equal((await apiLogin('planner')).status, 200);
    assert.equal((await mobileCall('snapshot', plannerPhone.data.accessToken)).status, 200);
    // Once the admin has set it up, the rule no longer applies (two-step accounts use the web).
    await db`INSERT INTO user_mfa (user_id, secret_sealed, enabled_at) VALUES (${people.admin.id}, 'sealed:v1:test-only', now())`;
    assert.equal(await policy.mfaSetupRequiredFor(db, { userId: people.admin.id, tenantId: tenant.id, role: 'admin' }), false);
    await db`DELETE FROM user_mfa WHERE user_id = ${people.admin.id}`;
    // Before migration 078 (no column) the rule is off.
    await db`ALTER TABLE tenants RENAME COLUMN require_mfa_for_admins TO require_mfa_for_admins_parked`;
    try {
      access.forgetMfaGate();
      assert.equal(await policy.mfaSetupRequiredFor(db, { userId: people.admin.id, tenantId: tenant.id, role: 'admin' }), false);
      assert.equal((await apiLogin('admin')).status, 200);
    } finally {
      await db`ALTER TABLE tenants RENAME COLUMN require_mfa_for_admins_parked TO require_mfa_for_admins`;
      access.forgetMfaGate();
    }
    console.log('PASS · S-04: the two-step rule refuses API/phone tokens and their use to owners/admins without it, keeps gate/me/sign-out open, spares others, is off without its column');

    // --- S-10: AI office deliveries marked finance ------------------------------------------------------------
    const decision = { difficulty: 'easy', score: 0, reasons: [], model: { id: 'x', label: 'x', capabilities: [] }, missing: [] };
    const [finTask] = await db`INSERT INTO office_tasks (tenant_id, number, category, title, brief, agent_id, decision, created_by, sensitivity, status)
      VALUES (${tenant.id}, 1, 'document', 'Kâr analizi', 'Bu yılın kârı', 'murat', ${db.json(decision)}, ${people.owner.id}, ${['finance', 'profit']}::text[], 'review') RETURNING id`;
    const [plainTask] = await db`INSERT INTO office_tasks (tenant_id, number, category, title, brief, agent_id, decision, created_by, sensitivity, status)
      VALUES (${tenant.id}, 2, 'correspondence', 'Teşekkür', 'Teşekkür mektubu', 'murat', ${db.json(decision)}, ${people.owner.id}, ${[]}::text[], 'review') RETURNING id`;
    const [legacyTask] = await db`INSERT INTO office_tasks (tenant_id, number, category, title, brief, agent_id, decision, created_by, status)
      VALUES (${tenant.id}, 3, 'document', 'Eski', 'Eski görev', 'murat', ${db.json(decision)}, ${people.owner.id}, 'review') RETURNING id`;
    const [finFile] = await db`INSERT INTO office_files (tenant_id, task_id, file_name, content_type, size_bytes, storage_key) VALUES (${tenant.id}, ${finTask.id}, 'kar.txt', 'text/plain', 1, ${'office/' + tenant.id + '/' + randomUUID()}) RETURNING id`;
    const actorOf = async (who: string) => ({ tenantId: tenant.id, userId: people[who].id, role: (await access.resolveMemberAccess(people[who].id, tenant.id))!.base, access: (await access.resolveMemberAccess(people[who].id, tenant.id))! });
    const sales = await actorOf('sales');
    const listed = (await office.listOfficeTasks(sales)).tasks.map((t) => t.id);
    assert.ok(listed.includes(plainTask.id));
    assert.ok(!listed.includes(finTask.id) && !listed.includes(legacyTask.id), 'finance and unknown tasks stay hidden from the sales preset');
    await assert.rejects(office.readOfficeFile(sales, finFile.id), /bulunamadı/);
    const officeMember = await actorOf('office');
    assert.equal((await office.listOfficeTasks(officeMember)).tasks.length, 3, 'a member whose role hides nothing sees every task');
    // Markers only grow, and an unknown task stays unknown.
    await markTaskSensitivity(tenant.id, plainTask.id, ['customer_contact']);
    await markTaskSensitivity(tenant.id, legacyTask.id, ['price']);
    const marks = await db`SELECT id, sensitivity FROM office_tasks WHERE tenant_id = ${tenant.id} AND id IN (${plainTask.id}, ${legacyTask.id})`;
    assert.deepEqual(marks.find((r) => r.id === plainTask.id)?.sensitivity, ['customer_contact']);
    assert.equal(marks.find((r) => r.id === legacyTask.id)?.sensitivity, null);
    console.log('PASS · S-10: office tasks marked finance or unknown are hidden (list and file) from narrowed members; markers only grow');
  } finally {
    for (const step of cleanup) await step().catch(() => undefined);
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
