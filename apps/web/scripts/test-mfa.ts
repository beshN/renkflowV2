/** Two-step sign-in on the real sign-in path, on the isolated local test database only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

import mobileSpec from '../../../contracts/mobile/openapi.json';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'mfa-integration-local-only-12345678901234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');

  const { sql } = await import('../lib/db');
  const mfa = await import('../lib/features/auth/mfa.server');
  const { base32Decode, totpAt } = await import('../lib/features/auth/totp');
  const { authConfig } = await import('../lib/core/auth.config');
  const credentials = authConfig.providers.find((p: any) => p.id === 'credentials') as any;
  const authorize = credentials.options.authorize as (c: Record<string, string>, r: Request) => Promise<any>;
  const signIn = (fields: Record<string, string>) =>
    authorize(fields, new Request('https://renkflow.com/api/auth/callback/credentials', { headers: { 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.1` } }));
  async function code(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
      return 'ok';
    } catch (error) {
      return String((error as { code?: string }).code);
    }
  }

  const [tenant] = await db`INSERT INTO tenants(name, slug) VALUES ('MFA integration', ${'mfa-' + randomUUID()}) RETURNING id`;
  const password = 'Local-test-only-Mfa-7351!';
  const [user] = await db`INSERT INTO users(name, email, password, email_verified) VALUES ('MFA owner', ${randomUUID() + '@example.invalid'}, ${await bcrypt.hash(password, 10)}, now()) RETURNING id, email`;
  await db`INSERT INTO tenant_members(tenant_id, user_id, role) VALUES (${tenant.id}, ${user.id}, 'owner')`;
  const ids = { userId: user.id, tenantId: tenant.id };

  // Without two-step sign-in the password alone is enough.
  assert.equal(await code(signIn({ email: user.email, password })), 'ok');

  // Set-up: nothing applies until a code is confirmed.
  const setup = await mfa.startMfaSetup(sql, { userId: user.id, email: user.email });
  assert.match(setup.qrDataUrl, /^data:image\/png;base64,/);
  assert.match(setup.uri, /^otpauth:\/\/totp\/RenkFlow:/);
  assert.equal(await mfa.isMfaEnabled(sql, user.id), false);
  const [stored] = await db`SELECT secret_sealed FROM user_mfa WHERE user_id = ${user.id}`;
  assert.match(stored.secret_sealed, /^sealed:v1:/);
  assert(!stored.secret_sealed.includes(setup.secret), 'the secret is stored sealed');

  const key = base32Decode(setup.secret);
  const step = Math.floor(Date.now() / 1000 / 30);
  await assert.rejects(mfa.confirmMfaSetup(sql, { ...ids, code: '000000' === totpAt(key, step) ? '111111' : '000000' }), /doğrulanamadı/);
  const recovery = await mfa.confirmMfaSetup(sql, { ...ids, code: totpAt(key, step) });
  assert.equal(recovery.length, 10);
  assert.equal(new Set(recovery).size, 10);
  assert.equal(await mfa.isMfaEnabled(sql, user.id), true);

  // Sign-in now asks for the second step.
  assert.equal(await code(signIn({ email: user.email, password })), 'otp_required');
  assert.equal(await code(signIn({ email: user.email, password: 'wrong-password-1', otp: totpAt(key, step + 1) })), 'invalid_credentials', 'the password is still checked first');
  // The code used to confirm the set-up cannot be used again (replay).
  assert.equal(await code(signIn({ email: user.email, password, otp: totpAt(key, step) })), 'otp_invalid');
  assert.equal(await code(signIn({ email: user.email, password, otp: totpAt(key, step + 1) })), 'ok');
  assert.equal(await code(signIn({ email: user.email, password, otp: totpAt(key, step + 1) })), 'otp_invalid', 'a code works once');

  // A recovery code works once and is consumed.
  assert.equal(await code(signIn({ email: user.email, password, otp: recovery[0].toUpperCase() })), 'ok');
  assert.equal(await code(signIn({ email: user.email, password, otp: recovery[0] })), 'otp_invalid');
  assert.equal((await mfa.getMfaState(sql, user.id)).recoveryCodesLeft, 9);

  // The field app cannot ask for the code yet, so it refuses these accounts.
  const { POST } = await import('../app/api/mobile/v1/[...path]/route');
  const { NextRequest } = await import('next/server');
  const mobile = await POST(
    new NextRequest('https://renkflow.com/api/mobile/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-renkflow-app-version': mobileSpec.info.version, 'x-renkflow-platform': 'android', 'x-forwarded-for': '10.8.0.1' },
      body: JSON.stringify({ email: user.email, password }),
    }),
    { params: Promise.resolve({ path: ['auth', 'login'] }) },
  );
  assert.equal(mobile.status, 403);

  // Turning it off needs a valid code.
  await assert.rejects(mfa.disableMfa(sql, { ...ids, code: recovery[0] }), /doğrulanamadı/);
  await mfa.disableMfa(sql, { ...ids, code: recovery[1] });
  assert.equal(await mfa.isMfaEnabled(sql, user.id), false);
  assert.equal(await code(signIn({ email: user.email, password })), 'ok');

  const actions = (await db`SELECT action FROM activity_logs WHERE tenant_id = ${tenant.id} ORDER BY created_at`).map((r) => r.action);
  for (const action of ['mfa_enabled', 'mfa_recovery_code_used', 'mfa_disabled', 'login_succeeded']) assert(actions.includes(action), `audit has ${action}`);

  console.log('PASS · two-step sign-in: sealed secret, inactive until confirmed, otp_required/otp_invalid on the real authorize path, one use per code, recovery codes consumed, mobile refused, disable needs a code, audited');
  await db.end({ timeout: 5 });
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
