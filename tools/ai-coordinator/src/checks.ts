import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { CheckSpec, TestResult } from './types.ts';
import { nowIso, redact, tail } from './util.ts';

// Commands the coordinator itself runs come from the trusted config file, never from model output.
// This denylist is a last line of defence against a poisoned config.
const FORBIDDEN = /\b(rm\s+-rf\s+\/|git\s+push|vercel\s+(deploy|--prod)|db:(push|migrate|deploy)|curl\b.*\|\s*(sh|bash)|DROP\s+TABLE)/i;

export function runCheck(spec: CheckSpec, worktree: string, env: NodeJS.ProcessEnv): Promise<TestResult> {
  const started = Date.now();
  if (FORBIDDEN.test(spec.command)) {
    return Promise.resolve({ name: spec.name, command: spec.command, ok: false, exitCode: null, durationMs: 0, outputTail: 'Komut güvenlik denetiminde reddedildi.', at: nowIso() });
  }
  return new Promise((resolve) => {
    let out = '';
    const child = spawn('sh', ['-c', spec.command], { cwd: join(worktree, spec.cwd), env, detached: true });
    const timer = setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* gone */ } }, spec.timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ name: spec.name, command: spec.command, ok: code === 0, exitCode: code, durationMs: Date.now() - started, outputTail: redact(tail(out)), at: nowIso() });
    });
  });
}
