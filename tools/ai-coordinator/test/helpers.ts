import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { Pipeline } from '../src/pipeline.ts';
import { Store } from '../src/store.ts';
import type { Config } from '../src/types.ts';
import { makeTask, type NewTask } from '../src/tasks.ts';

/**
 * TEST-ONLY fakes. They stand in for the gemini/codex binaries so the coordinator's own state
 * machine can be exercised offline. They are never used by the real pilot (see docs in README).
 */
const FAKE_GEMINI = `#!/usr/bin/env node
const mode = process.env.FAKE_DEV || 'ok';
const fs = require('fs');
const n = Date.now();
if (mode === 'crash') { process.stderr.write('boom'); process.exit(7); }
fs.mkdirSync('ai-workspace/ux', { recursive: true });
if (mode !== 'noop') fs.writeFileSync('ai-workspace/ux/out.md', '# ok ' + (n+1) + '\\n');
if (mode === 'scope') { fs.mkdirSync('apps', { recursive: true }); fs.writeFileSync('apps/evil.txt', 'x'); }
if (mode === 'leak') fs.writeFileSync('ai-workspace/ux/out.md', 'key sk-abcdefghijklmnopqrstuvwxyz123456');
process.stdin.resume(); process.stdin.on('data', () => {}); process.stdin.on('end', () => console.log(JSON.stringify({ response: 'done' })));
`;
const FAKE_CODEX = `#!/usr/bin/env node
const fs = require('fs');
const out = process.argv[process.argv.indexOf('--output-last-message') + 1];
const mode = process.env.FAKE_REVIEW || 'pass';
const msg = { pass: 'ok\\n{"verdict":"pass","summary":"temiz","issues":[]}', fail: '{"verdict":"fail","summary":"eksik","issues":["kabul kriteri 1 yok"]}', garbage: 'bilmiyorum' }[mode];
process.stdin.resume(); process.stdin.on('data', () => {});
process.stdin.on('end', () => { fs.writeFileSync(out, msg); console.log('done'); });
`;

export function makeEnv(overrides: Partial<Config['limits']> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rf-test-'));
  const run = (cmd: string, args: string[], cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'pipe' }).toString();
  run('git', ['init', '-q', '-b', 'main']);
  run('git', ['config', 'user.email', 't@t']);
  run('git', ['config', 'user.name', 't']);
  mkdirSync(join(root, 'ai-workspace'), { recursive: true });
  writeFileSync(join(root, 'ai-workspace', 'README.md'), 'x\n');
  writeFileSync(join(root, '.gitignore'), '.ai-worktrees/\nai-workspace/.board.lock/\nai-workspace/reports/\nai-workspace/audits/\nai-workspace/TASK_BOARD.json\n');
  run('git', ['add', '-A']);
  run('git', ['commit', '-qm', 'init']);
  const bin = join(root, '..', `bin-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(bin, { recursive: true });
  for (const [name, src] of [['gemini', FAKE_GEMINI], ['codex', FAKE_CODEX]] as const) {
    writeFileSync(join(bin, name), src);
    chmodSync(join(bin, name), 0o755);
  }
  process.env.PATH = `${bin}:${process.env.PATH}`;
  const cfg: Config = { ...DEFAULT_CONFIG, limits: { ...DEFAULT_CONFIG.limits, timeoutMs: 20_000, ...overrides }, envAllowlist: [...DEFAULT_CONFIG.envAllowlist, 'FAKE_DEV', 'FAKE_REVIEW'] };
  const store = new Store(join(root, 'ai-workspace'));
  return { root, cfg, store, pipe: new Pipeline(root, cfg, store, 'main'), run };
}

export const sampleTask = (id = 'T-001', extra: Partial<NewTask> = {}) => makeTask({
  id, title: 'örnek', description: 'doc yaz', kind: 'docs', owner: 'argon', reviewer: 'sol',
  acceptance: ['ai-workspace/ux/out.md var'], files: ['ai-workspace/ux'], ...extra,
});
