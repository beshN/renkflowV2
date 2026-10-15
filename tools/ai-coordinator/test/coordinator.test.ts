import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { assertSafeBranch } from '../src/git.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { pickNext } from '../src/store.ts';
import { validateNewTask } from '../src/tasks.ts';
import { pathsOverlap, redact } from '../src/util.ts';
import { makeEnv, sampleTask } from './helpers.ts';

test('redact removes API keys, tokens and DB passwords', () => {
  const s = redact('OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1 ghp_abcdefghijklmnopqrstuvwxyz0123456789 postgres://u:pw@h/db Bearer abcdefghijklmnopqrstuvwxyz');
  assert.doesNotMatch(s, /sk-abc|ghp_abc|:pw@|Bearer abc/);
});

test('pathsOverlap treats dirs as prefixes', () => {
  assert.ok(pathsOverlap('a/b', 'a/b/c.ts'));
  assert.ok(!pathsOverlap('a/b', 'a/bc'));
});

test('protected and non-ai branches are refused', () => {
  assert.throws(() => assertSafeBranch('main', DEFAULT_CONFIG));
  assert.throws(() => assertSafeBranch('feature/x', DEFAULT_CONFIG));
  assertSafeBranch('ai/argon/t-001', DEFAULT_CONFIG);
});

test('validateNewTask enforces independent review, scope and no secrets', () => {
  const { cfg } = makeEnv();
  const base = { id: 'T-001', title: 'a', description: 'b', kind: 'docs' as const, owner: 'argon' as const, reviewer: 'argon' as const, acceptance: ['x'], files: ['ai-workspace/x'] };
  assert.match(validateNewTask(base, cfg, []).join(), /aynı model/);
  assert.match(validateNewTask({ ...base, reviewer: 'sol', files: ['apps/web/x.ts'] }, cfg, []).join(), /yalnızca ai-workspace/);
  assert.match(validateNewTask({ ...base, reviewer: 'sol', kind: 'code', files: ['apps/web/.env'] }, cfg, []).join(), /hassas/);
  assert.match(validateNewTask({ ...base, reviewer: 'sol', kind: 'code', files: ['tools/ai-coordinator/src'] }, cfg, []).join(), /altyapısı/);
  assert.equal(validateNewTask({ ...base, reviewer: 'sol' }, cfg, []).length, 0);
});

test('concurrent board updates never lose writes', async () => {
  const { store } = makeEnv();
  await store.update((b) => { b.tasks.push(sampleTask('T-001')); });
  await Promise.all(Array.from({ length: 25 }, (_, i) => store.update((b) => { b.tasks[0].attempts += 1; b.tasks[0].nextAction = `w${i}`; })));
  assert.equal((await store.readBoard()).tasks[0].attempts, 25);
});

test('file locks: overlapping tasks are not scheduled together; deps gate scheduling', async () => {
  const { store } = makeEnv();
  await store.update((b) => {
    const a = sampleTask('T-001'); a.status = 'in_progress';
    b.tasks.push(a, sampleTask('T-002'), sampleTask('T-003', { files: ['ai-workspace/simulations'], dependencies: ['T-001'] }));
  });
  assert.equal(pickNext(await store.readBoard()), null);
});

test('happy path: argon implements, sol approves -> ready_for_pr, committed on ai/* branch, main untouched', async () => {
  const { store, pipe, root, run } = makeEnv();
  const mainBefore = run('git', ['rev-parse', 'main']).trim();
  await store.update((b) => { b.tasks.push(sampleTask()); });
  const t = await pipe.runTask('T-001');
  assert.equal(t.status, 'ready_for_pr');
  assert.equal(t.branch, 'ai/argon/t-001');
  assert.ok(t.commit);
  assert.equal(t.review.verdicts[0].verdict, 'pass');
  assert.equal(run('git', ['rev-parse', 'main']).trim(), mainBefore);
  assert.ok(!existsSync(join(root, 'ai-workspace', 'ux', 'out.md')), 'main checkout stays clean');
  assert.match(run('git', ['log', '--format=%an', '-1', 'ai/argon/t-001']), /renkflow-ai-argon/);
  assert.ok(existsSync(await pipe.preparePr('T-001', false)));
});

test('reviewer rejection returns task to developer, then escalates after maxAttempts', async () => {
  const { store, pipe } = makeEnv();
  process.env.FAKE_REVIEW = 'fail';
  await store.update((b) => { b.tasks.push(sampleTask()); });
  let t = await pipe.runTask('T-001');
  assert.equal(t.status, 'changes_requested');
  assert.match(t.feedback ?? '', /kabul kriteri 1 yok/);
  t = await pipe.runTask('T-001');
  t = await pipe.runTask('T-001');
  assert.equal(t.status, 'escalated');
  assert.equal(t.attempts, 3);
  delete process.env.FAKE_REVIEW;
});

test('unparseable review is never a pass -> blocked', async () => {
  const { store, pipe } = makeEnv();
  process.env.FAKE_REVIEW = 'garbage';
  await store.update((b) => { b.tasks.push(sampleTask()); });
  const t = await pipe.runTask('T-001');
  assert.equal(t.status, 'blocked');
  delete process.env.FAKE_REVIEW;
});

test('scope violation is reverted and sent back', async () => {
  const { store, pipe, root } = makeEnv();
  process.env.FAKE_DEV = 'scope';
  await store.update((b) => { b.tasks.push(sampleTask()); });
  const t = await pipe.runTask('T-001');
  assert.equal(t.status, 'changes_requested');
  assert.match(t.feedback ?? '', /Kapsam ihlali/);
  assert.ok(!existsSync(join(root, '.ai-worktrees', 'argon', 't-001', 'apps', 'evil.txt')));
  delete process.env.FAKE_DEV;
});

test('missing CLI blocks the task without consuming an attempt and without fake success', async () => {
  const { store, pipe, cfg } = makeEnv();
  cfg.models.argon = { ...cfg.models.argon, cli: 'gemini' };
  const saved = process.env.PATH;
  process.env.PATH = '/usr/bin:/bin'; // no gemini/codex here
  await store.update((b) => { b.tasks.push(sampleTask()); });
  const t = await pipe.runTask('T-001');
  process.env.PATH = saved;
  assert.equal(t.status, 'blocked');
  assert.equal(t.attempts, 0);
  assert.match(t.blockedReason ?? '', /kurulu değil/);
});

test('circuit breaker stops after consecutive model failures', async () => {
  const { store, pipe } = makeEnv({ maxConsecutiveFailures: 2, maxAttempts: 9 });
  process.env.FAKE_DEV = 'crash';
  await store.update((b) => { b.tasks.push(sampleTask()); });
  await pipe.runTask('T-001');
  await pipe.runTask('T-001');
  const t = await pipe.runTask('T-001');
  assert.equal(t.status, 'blocked');
  assert.match(t.blockedReason ?? '', /Devre kesici/);
  delete process.env.FAKE_DEV;
});

test('run budget caps model calls per task', async () => {
  const { store, pipe } = makeEnv({ maxRunsPerTask: 2, maxAttempts: 9 });
  process.env.FAKE_REVIEW = 'fail';
  await store.update((b) => { b.tasks.push(sampleTask()); });
  await pipe.runTask('T-001'); // dev + review = 2 runs
  const t = await pipe.runTask('T-001');
  assert.equal(t.status, 'blocked');
  assert.match(t.blockedReason ?? '', /görev başına/);
  delete process.env.FAKE_REVIEW;
});

test('secrets written by a model never reach persisted audit/event files', async () => {
  const { store, root } = makeEnv();
  await store.event('x', { leak: 'sk-abcdefghijklmnopqrstuvwxyz123456' });
  const { readFileSync } = await import('node:fs');
  assert.doesNotMatch(readFileSync(join(root, 'ai-workspace', 'reports', 'events.jsonl'), 'utf8'), /sk-abc/);
});

test('a secret in the model diff blocks the commit and is rolled back', async () => {
  const { store, pipe, run } = makeEnv();
  process.env.FAKE_DEV = 'leak';
  await store.update((b) => { b.tasks.push(sampleTask()); });
  const t = await pipe.runTask('T-001');
  assert.equal(t.status, 'changes_requested');
  assert.match(t.feedback ?? '', /gizli anahtar/);
  assert.equal(run('git', ['log', '--oneline', 'ai/argon/t-001']).trim().split('\n').length, 1, 'no commit created');
  delete process.env.FAKE_DEV;
});
