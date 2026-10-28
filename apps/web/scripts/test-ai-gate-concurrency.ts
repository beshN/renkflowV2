/**
 * Integration test for the atomic AI gate (audit S-06) on the isolated local test database only:
 * 20 concurrent reservations with one daily call left → exactly one passes; the same for the
 * firm's budget with each call's maximum cost; a reservation counts until released and stops
 * counting when its lease expires; withUsage reconciles the reservation to the real usage row (also
 * on a provider error) and 20 concurrent withUsage calls reach the provider exactly once.
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['029_ai_suggestions.sql', '048_ai_assistant.sql', '081_ai_call_reservations.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const gate = await import('../lib/ai/gate.server');
  const settings = await import('../lib/ai/settings.server');
  const { withUsage } = await import('../lib/ai/usage');
  const { ModelBlockedError } = await import('../lib/ai/policy');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), otherId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'AI kapı testi', ${'ai-gate-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [otherId, 'office']] as const) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${id}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const live = async () => Number((await db`SELECT count(*)::int AS n FROM ai_call_reservations WHERE tenant_id = ${tenantId} AND expires_at > now()`)[0].n);
  const settle = <T>(promises: Promise<T>[]) => Promise.allSettled(promises);
  const blocked = (r: PromiseSettledResult<unknown>, block: string) => r.status === 'rejected' && r.reason instanceof ModelBlockedError && r.reason.block === block;

  try {
    // One call left for the person (limit 2, one finished today): 20 at once → exactly one passes.
    await settings.saveAiSettings(owner, { mode: 'assist', kvkkAck: true, dailyBudgetUsd: null, userDailyCalls: 2 });
    await db`INSERT INTO ai_usage (tenant_id, user_id, feature, provider, model, latency_ms, status, cost_usd) VALUES (${tenantId}, ${ownerId}, 'test', 'anthropic', 'claude-sonnet-5-5', 10, 'ok', 0.01)`;
    const calls = await settle(Array.from({ length: 20 }, () => gate.reserveModelCall({ tenantId, userId: ownerId, feature: 'test' }, { model: 'claude-sonnet-5-5', estimateUsd: 0.05 })));
    const passed = calls.filter((r) => r.status === 'fulfilled' && r.value);
    assert.equal(passed.length, 1, `exactly one of 20 concurrent calls passes (got ${passed.length})`);
    assert.equal(calls.filter((r) => blocked(r, 'AI_USER_LIMIT')).length, 19, 'the others are refused with the daily call limit');
    assert.equal(await live(), 1);
    // The non-reserving check sees the call in flight too; another person is not affected.
    await assert.rejects(gate.assertModelAllowed({ tenantId, userId: ownerId }), (e: any) => e.block === 'AI_USER_LIMIT');
    await gate.assertModelAllowed({ tenantId, userId: otherId });
    // Released without a usage row (e.g. the provider never answered) → the call is free again.
    await gate.releaseModelReservation((passed[0] as PromiseFulfilledResult<any>).value);
    assert.equal(await live(), 0);
    const again = await gate.reserveModelCall({ tenantId, userId: ownerId }, { estimateUsd: 0 });
    assert.ok(again, 'a released reservation no longer counts');
    // A lease that expired (its process died) stops counting.
    await db`UPDATE ai_call_reservations SET expires_at = now() - interval '1 second' WHERE id = ${again!.id}`;
    assert.ok(await gate.reserveModelCall({ tenantId, userId: ownerId }, { estimateUsd: 0 }), 'an expired reservation stops counting');
    await db`DELETE FROM ai_call_reservations WHERE tenant_id = ${tenantId}`;

    // Budget: 1 USD, 0.3 spent, each call may cost up to 0.6 → 20 at once, exactly one passes.
    await settings.saveAiSettings(owner, { dailyBudgetUsd: 1, userDailyCalls: 1000 });
    await db`INSERT INTO ai_usage (tenant_id, user_id, feature, provider, model, latency_ms, status, cost_usd) VALUES (${tenantId}, ${otherId}, 'test', 'anthropic', 'claude-sonnet-5-5', 10, 'ok', 0.29)`;
    const spend = await settle(Array.from({ length: 20 }, (_, i) => gate.reserveModelCall({ tenantId, userId: i % 2 ? ownerId : otherId }, { estimateUsd: 0.6 })));
    assert.equal(spend.filter((r) => r.status === 'fulfilled' && r.value).length, 1, 'one call fits the remaining budget');
    assert.equal(spend.filter((r) => blocked(r, 'AI_BUDGET')).length, 19);
    // A small call still fits next to the reserved one (0.3 + 0.6 + 0.1 = 1.0).
    assert.ok(await gate.reserveModelCall({ tenantId, userId: ownerId }, { estimateUsd: 0.1 }));
    await assert.rejects(gate.reserveModelCall({ tenantId, userId: ownerId }, { estimateUsd: 0.01 }), (e: any) => e.block === 'AI_BUDGET');
    await db`DELETE FROM ai_call_reservations WHERE tenant_id = ${tenantId}`;
    await db`DELETE FROM ai_usage WHERE tenant_id = ${tenantId}`;

    // withUsage end to end: one call left → 20 concurrent requests reach the provider once; the
    // reservation becomes the real usage row (actual tokens and cost) and is gone afterwards.
    await settings.saveAiSettings(owner, { dailyBudgetUsd: null, userDailyCalls: 1 });
    let providerCalls = 0;
    const provider = async () => {
      providerCalls++;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { usage: { input_tokens: 1000, output_tokens: 100 } };
    };
    const results = await settle(Array.from({ length: 20 }, () => withUsage({ tenantId, userId: ownerId, feature: 'test' }, 'anthropic', 'claude-sonnet-5-5', provider, { maxOutputTokens: 1000 })));
    assert.equal(providerCalls, 1, 'the provider is called exactly once');
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rows = await db`SELECT status, input_tokens, output_tokens, cost_usd::float AS cost FROM ai_usage WHERE tenant_id = ${tenantId}`;
    assert.deepEqual(rows.map((r) => ({ ...r })), [{ status: 'ok', input_tokens: 1000, output_tokens: 100, cost: 0.003 }], 'the real cost replaces the estimate');
    assert.equal(await live(), 0, 'the reservation is released after the usage row is written');

    // A provider error: usage row with status error, reservation released.
    await settings.saveAiSettings(owner, { userDailyCalls: 10 });
    await assert.rejects(withUsage({ tenantId, userId: ownerId, feature: 'test' }, 'anthropic', 'claude-sonnet-5-5', async () => { throw Object.assign(new Error('overloaded'), { status: 529 }); }), /overloaded/);
    assert.equal((await db`SELECT count(*)::int AS n FROM ai_usage WHERE tenant_id = ${tenantId} AND status = 'error'`)[0].n, 1);
    assert.equal(await live(), 0, 'released on error');

    console.log('PASS · 20 concurrent gate checks with one call left → 1 passes (calls and budget), release / lease expiry, withUsage reconciles to the real cost and releases on error');
  } finally {
    await db`DELETE FROM ai_call_reservations WHERE tenant_id = ${tenantId}`;
    await db`DELETE FROM ai_usage WHERE tenant_id = ${tenantId}`;
    await db`DELETE FROM ai_settings WHERE tenant_id = ${tenantId}`;
    await db`DELETE FROM tenant_members WHERE tenant_id = ${tenantId}`;
    await db`DELETE FROM tenants WHERE id = ${tenantId}`;
    await db`DELETE FROM users WHERE id = ANY(${[ownerId, otherId]}::uuid[])`;
    await db.end();
    await (sql as any).end?.();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
