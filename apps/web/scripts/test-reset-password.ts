/**
 * Password reset on the real route, on the isolated local test database only: two requests racing
 * with the same link (exactly one succeeds), every web and phone sign-in closed in the same
 * transaction, and a failure while closing them rolls the new password back.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'reset-integration-local-only-12345678901234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');

  const { POST } = await import('../app/api/auth/reset-password/route');
  const { generateResetToken, hashResetToken } = await import('../lib/features/auth/reset-token');
  let ip = 0;
  const reset = (token: string, password: string) =>
    POST(new Request('https://renkflow.com/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.6.${Math.floor(++ip / 250)}.${ip % 250}` },
      body: JSON.stringify({ token, password }),
    }));

  const [tenant] = await db`INSERT INTO tenants(name, slug) VALUES ('Reset integration', ${'reset-' + randomUUID()}) RETURNING id`;
  async function account() {
    const token = generateResetToken();
    const [user] = await db`
      INSERT INTO users(name, email, password, email_verified, password_reset_token, password_reset_expires)
      VALUES ('Reset', ${randomUUID() + '@example.invalid'}, ${await bcrypt.hash('Eski-sifre-2026x', 4)}, now(), ${await hashResetToken(token)}, now() + interval '1 hour')
      RETURNING id`;
    await db`INSERT INTO tenant_members(tenant_id, user_id, role) VALUES (${tenant.id}, ${user.id}, 'owner')`;
    const web = randomUUID();
    const phone = randomUUID();
    await db`INSERT INTO user_sessions(id, user_id, tenant_id) VALUES (${web}, ${user.id}, ${tenant.id}), (${phone}, ${user.id}, ${tenant.id})`;
    await db`INSERT INTO mobile_sessions(id, tenant_id, user_id, device_id, platform, expires_at) VALUES (${phone}, ${tenant.id}, ${user.id}, ${randomUUID()}, 'android', now() + interval '30 days')`;
    await db`INSERT INTO mobile_refresh_tokens(token_hash, session_id) VALUES (${randomUUID()}, ${phone})`;
    return { id: user.id as string, token };
  }
  const state = async (id: string) => {
    const [u] = await db`SELECT password, password_reset_token, sessions_valid_after FROM users WHERE id = ${id}`;
    const [s] = await db`SELECT count(*) FILTER (WHERE revoked_at IS NULL)::int AS open FROM user_sessions WHERE user_id = ${id}`;
    const [r] = await db`SELECT count(*)::int AS n FROM mobile_refresh_tokens t JOIN mobile_sessions m ON m.id = t.session_id WHERE m.user_id = ${id}`;
    return { ...u, openSessions: s.open, refreshTokens: r.n };
  };

  // Two requests with the same link at once: exactly one wins; the other gets the invalid-link answer.
  const racer = await account();
  const passwords = ['Yeni-sifre-A-2026x', 'Yeni-sifre-B-2026x'];
  const responses = await Promise.all(passwords.map((p) => reset(racer.token, p)));
  const statuses = responses.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 400]);
  const loser = responses.find((r) => r.status === 400)!;
  assert.deepEqual(await loser.json(), { error: 'token_expired' });
  const winner = passwords[responses.findIndex((r) => r.status === 200)];
  const after = await state(racer.id);
  assert.equal(await bcrypt.compare(winner, after.password), true, 'the password is the winning request\'s');
  assert.equal(after.password_reset_token, null);
  assert.notEqual(after.sessions_valid_after, null);
  assert.equal(after.openSessions, 0, 'web and phone sessions closed');
  assert.equal(after.refreshTokens, 0, 'phone refresh tokens gone');
  assert.equal((await reset(racer.token, 'Yeni-sifre-C-2026x')).status, 400, 'the link is spent');

  // A failure while closing sessions rolls everything back and is reported; the link still works.
  const failing = await account();
  await db.unsafe(`
    CREATE OR REPLACE FUNCTION pg_temp_reset_fail() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected session failure'; END $$;
  `);
  await db.unsafe(`CREATE TRIGGER reset_fail BEFORE UPDATE ON user_sessions FOR EACH ROW WHEN (NEW.user_id = '${failing.id}') EXECUTE FUNCTION pg_temp_reset_fail()`);
  try {
    const before = await state(failing.id);
    const failed = await reset(failing.token, 'Yeni-sifre-D-2026x');
    assert.equal(failed.status, 500);
    const unchanged = await state(failing.id);
    assert.equal(unchanged.password, before.password, 'password rolled back');
    assert.equal(unchanged.password_reset_token, before.password_reset_token, 'token not spent');
    assert.equal(unchanged.sessions_valid_after, null);
    assert.equal(unchanged.openSessions, 2);
    assert.equal(unchanged.refreshTokens, 1);
  } finally {
    await db.unsafe('DROP TRIGGER IF EXISTS reset_fail ON user_sessions');
    await db.unsafe('DROP FUNCTION IF EXISTS pg_temp_reset_fail()');
  }
  assert.equal((await reset(failing.token, 'Yeni-sifre-D-2026x')).status, 200);
  assert.equal((await state(failing.id)).openSessions, 0);

  // An expired link is refused.
  const expired = await account();
  await db`UPDATE users SET password_reset_expires = now() - interval '1 minute' WHERE id = ${expired.id}`;
  assert.equal((await reset(expired.token, 'Yeni-sifre-E-2026x')).status, 400);
  assert.equal((await state(expired.id)).openSessions, 2);

  console.log('PASS · password reset: one winner of two racing requests (the other gets token_expired), password + token + cut-off + web/phone sessions + refresh tokens in one transaction, a failure rolls back and returns an error, expired link refused');
  await db.end({ timeout: 5 });
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
