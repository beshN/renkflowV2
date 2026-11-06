/** Real PostgreSQL tenant isolation and live membership enforcement, local renkflow_test only.
 * Automatically discovered by run-integration-tests.ts and validate.yml's integration job.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'fun-policy-local-test-only-12345678901234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  delete process.env.DATABASE_URL_UNPOOLED;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { readFunFeatures, saveFunFeatures } = await import('../lib/features/settings/fun-features.server');
  const { getSql } = await import('../lib/db');
  const { accessDecision } = await import('../lib/security/member-access.server');
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  try {
    for (const id of tenants) await db`INSERT INTO tenants (id, name, slug) VALUES (${id}, 'Fun policy integration fixture', ${'fun-' + id})`;
    const migration = readFileSync('lib/db/migrations/082_fun_features.sql', 'utf8');
    await db.unsafe(migration); await db.unsafe(migration);
    const contexts: Record<string, { tenantId: string; userId: string }> = {};
    for (const role of ['owner', 'admin', 'office', 'worker']) {
      const id = randomUUID(); users.push(id);
      await db`INSERT INTO users (id, name, email) VALUES (${id}, 'Policy fixture', ${id + '@example.invalid'})`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenants[0]}, ${id}, ${role})`;
      contexts[role] = { tenantId: tenants[0], userId: id };
    }
    // One identity has different roles in the two firms: the current tenant still controls the write.
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenants[1]}, ${contexts.owner.userId}, 'worker')`;
    const other = { tenantId: tenants[1], userId: contexts.owner.userId };
    // The proxy's real membership gate permits a worker's read, without an access_denied decision.
    for (let i = 0; i < 3; i++) assert.equal(await accessDecision(contexts.worker.userId, tenants[0], '/api/tenant/fun-features', 'GET'), null);
    assert.equal((await readFunFeatures(contexts.worker)).enabled, true, 'worker keeps the default enabled policy');
    for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await accessDecision(contexts.worker.userId, tenants[0], '/api/tenant/fun-features', method))?.status, 403);
    assert.equal((await accessDecision(contexts.worker.userId, tenants[0], '/api/tenant/fun-features/other', 'GET'))?.status, 403);
    assert.equal((await readFunFeatures(contexts.owner)).enabled, true);
    assert.equal((await readFunFeatures(other)).enabled, true);
    await saveFunFeatures(contexts.owner, false);
    assert.equal((await readFunFeatures(contexts.worker)).enabled, false);
    assert.equal((await readFunFeatures(other)).enabled, true, 'other tenant unchanged');
    for (const ctx of [contexts.worker, contexts.office, other]) await assert.rejects(saveFunFeatures(ctx, false), /yetkiniz/);
    await saveFunFeatures(contexts.admin, true);
    await saveFunFeatures(contexts.admin, false);
    await db`UPDATE tenant_members SET role = 'worker' WHERE tenant_id = ${tenants[0]} AND user_id = ${contexts.admin.userId}`;
    await assert.rejects(saveFunFeatures(contexts.admin, true), /yetkiniz/, 'stale admin context does not grant access');
    await db`UPDATE tenant_members SET deactivated_at = now() WHERE tenant_id = ${tenants[0]} AND user_id = ${contexts.owner.userId}`;
    await assert.rejects(saveFunFeatures(contexts.owner, true), /yetkiniz/);
    await assert.rejects(readFunFeatures(contexts.owner), /yetkiniz/);
    await assert.rejects(readFunFeatures({ tenantId: tenants[1], userId: contexts.office.userId }), /yetkiniz/);
    assert.equal((await readFunFeatures(other)).enabled, true);
    const audit = await db`SELECT changes FROM activity_logs WHERE tenant_id = ${tenants[0]} AND entity_type = 'tenant' AND action = 'settings_updated'`;
    assert.equal(audit.length, 3, 'each real change is audited');
    console.log('PASS: default true, idempotent migration, two tenants, owner/admin writes, office/worker refusal, demotion/deactivation and audit');
  } finally {
    await db`DELETE FROM tenants WHERE id IN ${db(tenants)}`;
    await db`DELETE FROM users WHERE id IN ${db(users)}`;
    await db.end(); await getSql().end();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
