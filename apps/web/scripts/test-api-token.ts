/**
 * Password-only API tokens (/api/v1/auth/login) on the isolated local test database only: an account
 * with two-step sign-in gets no token and loses earlier ones, closing sign-ins (new password) ends
 * every earlier token, and only the signing algorithm the server uses is accepted.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';
import { NextRequest } from 'next/server';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'api-token-integration-local-only-123456789012345';
  process.env.DATABASE_URL = localTestDatabaseURL();
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const login = (await import('../app/api/v1/auth/login/route')).POST;
    // The bearer check of getAPIUser (a rejected token then falls back to the browser session, which a script has none of).
    const { verifyAPIToken } = await import('../lib/shared/api/auth-helpers');

    const [tenant] = await db`INSERT INTO tenants (name, slug) VALUES ('API token', ${'api-' + randomUUID()}) RETURNING id`;
    const password = 'Local-test-only-Api-9152!';
    const email = `${randomUUID()}@example.invalid`;
    const [user] = await db`INSERT INTO users (name, email, password, email_verified) VALUES ('API owner', ${email}, ${await bcrypt.hash(password, 10)}, now()) RETURNING id`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenant.id}, ${user.id}, 'owner')`;

    let ip = 1;
    const signIn = async () => {
      const res = await login(new NextRequest('https://renkflow.com/api/v1/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.77.0.${ip++}` }, body: JSON.stringify({ email, password }),
      }));
      return { status: res.status, token: res.status === 200 ? (await res.json()).data.accessToken as string : null };
    };
    const whoAmI = async (token: string) => ((await verifyAPIToken(new NextRequest('https://renkflow.com/api/v1/auth/me', { headers: { authorization: `Bearer ${token}` } }))) ? 200 : 401);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Without two-step sign-in the password gives a working token.
    const first = await signIn();
    assert.equal(first.status, 200);
    assert.equal(await whoAmI(first.token!), 200);

    // Two-step sign-in turned on: the earlier token stops, and no new one is issued.
    await db`INSERT INTO user_mfa (user_id, secret_sealed, enabled_at) VALUES (${user.id}, 'sealed:v1:test-only', now())`;
    assert.equal(await whoAmI(first.token!), 401, 'a password-only token does not outlive two-step sign-in');
    assert.equal((await signIn()).status, 403, 'two-step accounts cannot get a password-only token');
    await db`DELETE FROM user_mfa WHERE user_id = ${user.id}`;

    // A new password / "sign out everywhere" closes every earlier token.
    const second = await signIn();
    assert.equal(await whoAmI(second.token!), 200);
    await wait(1100);
    await db`UPDATE users SET sessions_valid_after = now() WHERE id = ${user.id}`;
    assert.equal(await whoAmI(second.token!), 401, 'closed sign-ins end earlier tokens');
    await wait(1100);
    const third = await signIn();
    assert.equal(await whoAmI(third.token!), 200, 'a token issued afterwards works');

    // Only HS256 with the server's secret; a token without an issue time is not accepted.
    const payload = { sub: user.id, email, name: 'x', role: 'owner', tenantId: tenant.id };
    assert.equal(await whoAmI(jwt.sign(payload, process.env.AUTH_SECRET!, { algorithm: 'HS512' })), 401);
    assert.equal(await whoAmI(jwt.sign(payload, process.env.AUTH_SECRET!, { algorithm: 'HS256', noTimestamp: true })), 401);
    assert.equal(await whoAmI(jwt.sign(payload, 'some-other-secret-1234567890123456789012', { algorithm: 'HS256' })), 401);

    console.log('PASS · API tokens: two-step accounts get none and lose earlier ones, closed sign-ins end earlier tokens, only HS256 with the server secret and an issue time');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
