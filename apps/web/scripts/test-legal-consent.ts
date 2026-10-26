/** Legal consent on sign-up and invite acceptance, and the owner/admin two-step sign-in rule, on the isolated local test database only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'consent-integration-local-only-1234567890123456';
  process.env.DATABASE_URL = localTestDatabaseURL();
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');

  const { NextRequest } = await import('next/server');
  const { sql } = await import('../lib/db');
  const { TERMS_VERSION, PRIVACY_NOTICE_VERSION } = await import('../lib/features/auth/legal-consent');
  const { legalConsentRequired, recordLegalConsent } = await import('../lib/features/auth/legal-consent.server');
  const policy = await import('../lib/features/auth/mfa-policy.server');
  const mfa = await import('../lib/features/auth/mfa.server');
  const { base32Decode, totpAt } = await import('../lib/features/auth/totp');
  const register = (await import('../app/api/auth/register/route')).POST;
  const acceptInvite = (await import('../app/api/tenant/invite/accept/route')).POST;
  const post = (url: string, body: unknown) =>
    new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 250)}.9` }, body: JSON.stringify(body) });

  // Sign-up: refused without the box, recorded with it.
  const email = `${randomUUID()}@example.invalid`;
  const signup = { name: 'Onay Testi', email, password: 'Local-test-only-Consent-7351!', companyName: 'Onay Firma' };
  const refused = await register(post('https://renkflow.com/api/auth/register', signup));
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).code, 'consent_required');
  assert.equal((await db`SELECT 1 FROM users WHERE email = ${email}`).length, 0, 'nothing is created without consent');

  const created = await register(post('https://renkflow.com/api/auth/register', { ...signup, acceptLegal: true }));
  assert.equal(created.status, 201);
  const [user] = await db`SELECT id, terms_accepted_at, terms_version, privacy_notice_ack_at, privacy_notice_version, terms_accepted_ip FROM users WHERE email = ${email}`;
  assert(user.terms_accepted_at instanceof Date && user.privacy_notice_ack_at instanceof Date);
  assert.equal(user.terms_version, TERMS_VERSION);
  assert.equal(user.privacy_notice_version, PRIVACY_NOTICE_VERSION);
  assert.match(user.terms_accepted_ip, /^10\.7\./);
  assert.equal(await legalConsentRequired(sql, user.id), false);
  const [{ tenant_id: tenantId }] = await db`SELECT tenant_id FROM tenant_members WHERE user_id = ${user.id} AND role = 'owner'`;

  // Invite: same rule for the invited user.
  const invited = `${randomUUID()}@example.invalid`;
  const token = randomUUID();
  await db`INSERT INTO invitations (tenant_id, email, role, token, expires_at) VALUES (${tenantId}, ${invited}, 'admin', ${token}, now() + interval '1 day')`;
  const invite = { token, name: 'Davetli Yönetici', password: 'Local-test-only-Invite-7351!' };
  assert.equal((await acceptInvite(post('https://renkflow.com/api/tenant/invite/accept', invite))).status, 400);
  assert.equal((await db`SELECT 1 FROM invitations WHERE tenant_id = ${tenantId} AND token = ${token}`).length, 1, 'the invitation stays open');
  assert.equal((await acceptInvite(post('https://renkflow.com/api/tenant/invite/accept', { ...invite, acceptLegal: true }))).status, 200);
  const [admin] = await db`SELECT id, terms_version, privacy_notice_ack_at FROM users WHERE email = ${invited}`;
  assert.equal(admin.terms_version, TERMS_VERSION);
  assert(admin.privacy_notice_ack_at instanceof Date);

  // An account made without the box (SSO) is asked once, until it records consent.
  const [sso] = await db`INSERT INTO users (name, email, email_verified) VALUES ('SSO', ${randomUUID() + '@example.invalid'}, now()) RETURNING id`;
  assert.equal(await legalConsentRequired(sql, sso.id), true);
  await recordLegalConsent(sql, { userId: sso.id, ip: null });
  assert.equal(await legalConsentRequired(sql, sso.id), false);

  // Two-step rule: off by default; the owner cannot turn it on without their own two-step sign-in.
  assert.deepEqual(await policy.readMfaPolicy(sql, tenantId), { available: true, requireForAdmins: false });
  await assert.rejects(policy.setMfaPolicy(sql, { tenantId, actorId: user.id, actorRole: 'owner', enabled: true }), /kendi hesabınızda/);
  await assert.rejects(policy.setMfaPolicy(sql, { tenantId, actorId: admin.id, actorRole: 'admin', enabled: false }), /yalnız firma sahibi/);
  const setup = await mfa.startMfaSetup(sql, { userId: user.id, email });
  await mfa.confirmMfaSetup(sql, { userId: user.id, tenantId, code: totpAt(base32Decode(setup.secret), Math.floor(Date.now() / 1000 / 30)) });
  assert.deepEqual(await policy.setMfaPolicy(sql, { tenantId, actorId: user.id, actorRole: 'owner', enabled: true }), { available: true, requireForAdmins: true });

  // The owner (set up) goes through; the admin without it is sent to set-up; other roles are untouched.
  assert.equal(await policy.mfaSetupRequiredFor(sql, { userId: user.id, tenantId, role: 'owner' }), false);
  assert.equal(await policy.mfaSetupRequiredFor(sql, { userId: admin.id, tenantId, role: 'admin' }), true);
  assert.equal(await policy.mfaSetupRequiredFor(sql, { userId: admin.id, tenantId, role: 'office' }), false);
  const [audit] = await db`SELECT changes FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_type = 'tenant' AND action = 'settings_updated' ORDER BY created_at DESC LIMIT 1`;
  assert.deepEqual(audit.changes, { require_mfa_for_admins: { from: false, to: true } });

  // Another firm is not affected.
  const [other] = await db`INSERT INTO tenants (name, slug) VALUES ('Diğer', ${'other-' + randomUUID()}) RETURNING id`;
  assert.equal((await policy.readMfaPolicy(sql, other.id)).requireForAdmins, false);

  console.log('PASS · legal consent: sign-up and invite refused without it and recorded with versions/time/IP, SSO accounts asked once; two-step rule owner-only, needs own MFA, sends admins without it to set-up, audited, per firm');
  await db.end({ timeout: 5 });
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
