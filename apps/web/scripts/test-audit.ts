/** Audit trail integrity and sign-in events, on the isolated local test database only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

import mobileSpec from '../../../contracts/mobile/openapi.json';
import { localTestDatabaseURL } from './local-test-database';

async function rejects(run: () => Promise<unknown>, pattern: RegExp, message: string) {
  try {
    await run();
  } catch (error) {
    assert.match(String((error as Error).message), pattern, message);
    return;
  }
  assert.fail(message);
}

async function main() {
  process.env.AUTH_SECRET = 'audit-integration-local-only-1234567890123456';
  process.env.DATABASE_URL = localTestDatabaseURL();
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');

    const [tenant] = await db`INSERT INTO tenants(name, slug) VALUES ('Audit integration', ${'audit-' + randomUUID()}) RETURNING id`;
    const password = 'Local-test-only-Audit-4821!';
    const hash = await bcrypt.hash(password, 10);
    const [user] = await db`INSERT INTO users(name, email, password, email_verified) VALUES ('Audit worker', ${randomUUID() + '@example.invalid'}, ${hash}, now()) RETURNING id, email`;
    await db`INSERT INTO tenant_members(tenant_id, user_id, role) VALUES (${tenant.id}, ${user.id}, 'worker')`;

    // --- Append-only trail -------------------------------------------------------------------
    const [row] = await db`INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, actor_name)
      VALUES (${tenant.id}, 'order', ${randomUUID()}, 'created', ${user.id}, 'Audit worker') RETURNING id`;
    await rejects(() => db`UPDATE activity_logs SET action = 'tampered' WHERE id = ${row.id}`, /append-only/, 'an audit row cannot be edited');
    await rejects(() => db`DELETE FROM activity_logs WHERE id = ${row.id}`, /append-only/, 'an audit row cannot be deleted');
    await rejects(() => db`UPDATE activity_logs SET actor_id = NULL, note = 'x' WHERE id = ${row.id}`, /append-only/, 'clearing the actor cannot carry other edits');

    // A logged purge (retention, data-subject request) is the explicit way out.
    const [purgeRow] = await db`INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action) VALUES (${tenant.id}, 'order', ${randomUUID()}, 'created') RETURNING id`;
    await db.begin(async (tx) => {
      await tx`SELECT set_config('renkflow.audit_purge', 'on', true)`;
      await tx`DELETE FROM activity_logs WHERE id = ${purgeRow.id}`;
    });
    assert.equal((await db`SELECT count(*)::int AS n FROM activity_logs WHERE id = ${purgeRow.id}`)[0].n, 0);
    // The purge switch is transaction-local.
    await rejects(() => db`DELETE FROM activity_logs WHERE id = ${row.id}`, /append-only/, 'the purge switch does not leak');

    // --- Sign-in events (mobile route, real database) ----------------------------------------
    const { NextRequest } = await import('next/server');
    const { POST } = await import('../app/api/mobile/v1/[...path]/route');
    const login = (pwd: string) =>
      POST(
        new NextRequest('https://renkflow.com/api/mobile/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-renkflow-app-version': mobileSpec.info.version, 'x-renkflow-platform': 'android', 'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.0.1` },
          body: JSON.stringify({ email: user.email, password: pwd }),
        }),
        { params: Promise.resolve({ path: ['auth', 'login'] }) },
      );
    assert.equal((await login('wrong-password-123')).status, 401);
    assert.equal((await login(password)).status, 200);
    // The failed-attempt record is written without blocking the response.
    let actions: string[] = [];
    for (let i = 0; i < 20 && !actions.includes('login_failed'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      actions = (await db`SELECT action FROM activity_logs WHERE tenant_id = ${tenant.id} AND entity_type = 'user' ORDER BY created_at`).map((r) => r.action);
    }
    assert(actions.includes('login_failed'), 'failed sign-in on a member account is recorded');
    assert(actions.includes('login_succeeded'), 'successful sign-in is recorded');
    const [success] = await db`SELECT metadata FROM activity_logs WHERE tenant_id = ${tenant.id} AND action = 'login_succeeded'`;
    assert.equal(success.metadata.method, 'mobile');

    // --- FK paths stay open --------------------------------------------------------------------
    // Deleting a user clears actor_id (actor_name keeps the snapshot).
    await db`DELETE FROM tenant_members WHERE user_id = ${user.id}`;
    await db`DELETE FROM user_sessions WHERE user_id = ${user.id}`.catch(() => {});
    await db`DELETE FROM users WHERE id = ${user.id}`;
    const [kept] = await db`SELECT actor_id, actor_name FROM activity_logs WHERE id = ${row.id}`;
    assert.equal(kept.actor_id, null);
    assert.equal(kept.actor_name, 'Audit worker');
    // Deleting a firm removes its trail through the cascade.
    await db`DELETE FROM tenants WHERE id = ${tenant.id}`;
    assert.equal((await db`SELECT count(*)::int AS n FROM activity_logs WHERE tenant_id = ${tenant.id}`)[0].n, 0);

    console.log('PASS · audit trail is append-only (edit, delete, mixed edit refused; logged purge and FK set-null/cascade allowed), mobile sign-in success and failure recorded');
  } finally {
    await db.end({ timeout: 5 });
  }
}

// The app's own connection pool (imported with the route) would keep the process alive.
main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
