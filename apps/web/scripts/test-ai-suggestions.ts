/** Integration test for the approval-gated suggestion queue, only on the isolated local test database. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  await db.unsafe(readFileSync('lib/db/migrations/029_ai_suggestions.sql', 'utf8'));
  await db.unsafe('CREATE TABLE IF NOT EXISTS ai_test_effects (id serial PRIMARY KEY, tenant_id uuid, value numeric)');

  const { registerSuggestionKind } = await import('../lib/ai/suggestions/kinds');
  const { fileSuggestion, listPendingSuggestions, decideSuggestion, suggestionsAvailable } = await import('../lib/ai/suggestions/service');
  const { sql } = await import('../lib/db');

  // A test-only kind: approving it writes one row, so the effect (or its absence) is checkable.
  registerSuggestionKind({
    kind: 'test.effect',
    label: 'Test etkisi',
    payloadSchema: z.object({ value: z.number().positive(), fail: z.boolean().default(false) }),
    roles: ['owner', 'admin'],
    editableFields: [{ key: 'value', label: 'Değer', type: 'number', min: 1 }],
    apply: async (tx, actor, payload) => {
      await tx`INSERT INTO ai_test_effects (tenant_id, value) VALUES (${actor.tenantId}, ${payload.value})`;
      if (payload.fail) { const { WorkOrderApiError } = await import('../lib/features/work-orders/security'); throw new WorkOrderApiError('Stok değişti; öneri artık geçerli değil.', 409); }
      return { written: payload.value };
    },
  });

  const tenantId = randomUUID(), ownerId = randomUUID(), workerId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'AI test', ${'ai-test-' + tenantId.slice(0, 8)})`;
  for (const [id, email] of [[ownerId, `owner-${tenantId}@test.local`], [workerId, `worker-${tenantId}@test.local`]]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${email}, 'Test')`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const worker = { tenantId, userId: workerId, role: 'worker' as const };

  assert.equal(await suggestionsAvailable(), true);

  const filed = await fileSuggestion(sql, tenantId, null, { kind: 'test.effect', title: 'Test önerisi', rationale: 'Gerekçe', payload: { value: 5 }, dedupeKey: 'same-situation', affected: [{ entityType: 'order', entityId: 'x', label: 'RF-1' }] });
  assert.equal(filed.created, true);
  const again = await fileSuggestion(sql, tenantId, null, { kind: 'test.effect', title: 'Test önerisi', rationale: 'Gerekçe', payload: { value: 5 }, dedupeKey: 'same-situation' });
  assert.equal(again.created, false);
  assert.equal(again.suggestion.id, filed.suggestion.id);
  await assert.rejects(fileSuggestion(sql, tenantId, null, { kind: 'test.effect', title: 'Belirsiz', rationale: 'x x x', payload: { value: 1 }, uncertain: true }), /neden emin olunmadığını/);
  console.log('PASS · filing: created once per open situation, audited; an uncertain suggestion must say why');

  assert.equal((await listPendingSuggestions(worker)).length, 0);
  const listed = await listPendingSuggestions(owner);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].kindLabel, 'Test etkisi');
  await assert.rejects(decideSuggestion(worker, filed.suggestion.id, { action: 'approve', expectedVersion: 1 }), (e: any) => e.status === 403);
  console.log('PASS · roles: a worker neither sees nor decides an owner/admin kind');

  const edited = await decideSuggestion(owner, filed.suggestion.id, { action: 'edit', expectedVersion: 1, payload: { value: 7, fail: true }, note: 'Ölçü yanlış' });
  assert.equal(edited.status, 'pending');
  assert.deepEqual((edited as any).payload, { value: 7, fail: false });
  const [example] = await db`SELECT original_payload, corrected_payload, note FROM ai_feedback_examples WHERE suggestion_id = ${filed.suggestion.id}`;
  assert.deepEqual(example.original_payload, { value: 5, fail: false });
  assert.deepEqual(example.corrected_payload, { value: 7, fail: false });
  await assert.rejects(decideSuggestion(owner, filed.suggestion.id, { action: 'approve', expectedVersion: 1 }), (e: any) => e.status === 409);
  console.log('PASS · edit: only editable fields change, the correction is kept as an example, stale versions are refused');

  const failing = await fileSuggestion(sql, tenantId, null, { kind: 'test.effect', title: 'Bozulacak', rationale: 'Gerekçe', payload: { value: 3, fail: true } });
  await assert.rejects(decideSuggestion(owner, failing.suggestion.id, { action: 'approve', expectedVersion: 1 }), (e: any) => e.status === 409);
  const [stillPending] = await db`SELECT status FROM ai_suggestions WHERE id = ${failing.suggestion.id}`;
  assert.equal(stillPending.status, 'pending');
  assert.equal((await db`SELECT count(*)::int AS n FROM ai_test_effects WHERE tenant_id = ${tenantId} AND value = 3`)[0].n, 0);
  console.log('PASS · a refused approval rolls back completely and leaves the suggestion pending');

  const approved = await decideSuggestion(owner, filed.suggestion.id, { action: 'approve', expectedVersion: 2 });
  assert.deepEqual(approved, { status: 'approved', result: { written: 7 } });
  assert.equal((await db`SELECT count(*)::int AS n FROM ai_test_effects WHERE tenant_id = ${tenantId} AND value = 7`)[0].n, 1);
  await assert.rejects(decideSuggestion(owner, filed.suggestion.id, { action: 'approve', expectedVersion: 3 }), (e: any) => e.status === 409);
  const audit = await db`SELECT action FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_type = 'ai_suggestion' ORDER BY created_at`;
  assert.deepEqual(audit.map((r: any) => r.action), ['created', 'edited', 'created', 'approved']);
  await decideSuggestion(owner, failing.suggestion.id, { action: 'reject', expectedVersion: 1, note: 'Gerek yok' });
  assert.equal((await db`SELECT status FROM ai_suggestions WHERE id = ${failing.suggestion.id}`)[0].status, 'rejected');
  console.log('PASS · approval runs the command once inside the transaction; reject and approve are audited');

  await db`DELETE FROM tenants WHERE id = ${tenantId}`;
  await db`DELETE FROM users WHERE id IN (${ownerId}, ${workerId})`;
  await db.end();
  await sql.end({ timeout: 5 });
}

main().catch((error) => { console.error(error); process.exit(1); });
