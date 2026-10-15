import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Config, ModelId } from './types.ts';
import { redact, tail } from './util.ts';

export type Mode = 'dev' | 'review' | 'plan';

export interface Invocation {
  cmd: string;
  args: string[];
  stdin: string;
  /** codex writes the final message to a file. */
  outputFile?: string;
}

export interface RunResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  text: string;
  costUsd: number | null;
  durationMs: number;
  stderrTail: string;
}

const CLAUDE_READ = 'Read,Grep,Glob,Bash(git diff:*),Bash(git log:*),Bash(git status:*),Bash(git show:*)';
const CLAUDE_DEV = `${CLAUDE_READ},Edit,Write`;

/**
 * Builds a least-privilege, non-interactive invocation. No mode ever auto-approves arbitrary
 * shell commands: no --yolo, no --dangerously-*, no bypassPermissions.
 */
export function buildInvocation(model: ModelId, cfg: Config, mode: Mode, prompt: string, cwd: string, outDir: string): Invocation {
  const m = cfg.models[model];
  const maxUsd = String(cfg.limits.maxUsdPerRun);
  switch (m.cli) {
    case 'claude':
      return {
        cmd: 'claude',
        stdin: prompt,
        args: [
          '-p', '--output-format', 'json', '--no-session-persistence',
          // Ignore project/local settings: this repo's .claude/settings.json uses bypassPermissions.
          '--setting-sources', 'user', '--strict-mcp-config',
          '--permission-mode', mode === 'dev' ? 'acceptEdits' : 'default',
          '--allowedTools', mode === 'dev' ? CLAUDE_DEV : CLAUDE_READ,
          '--disallowedTools', 'Bash(git push:*)', 'Bash(rm:*)', 'WebFetch', 'WebSearch',
          '--max-budget-usd', maxUsd,
          ...(m.model ? ['--model', m.model] : []),
        ],
      };
    case 'gemini':
      return {
        cmd: 'gemini',
        stdin: prompt,
        args: [
          '-p', 'Talimatlar stdin üzerinden verildi; onları uygula.', '--output-format', 'json', '--skip-trust',
          '--approval-mode', mode === 'dev' ? 'auto_edit' : 'plan',
          ...(m.model ? ['-m', m.model] : []),
        ],
      };
    case 'codex': {
      const outputFile = join(outDir, 'last-message.txt');
      return {
        cmd: 'codex',
        stdin: prompt,
        outputFile,
        args: [
          'exec', '--cd', cwd, '--ephemeral', '--color', 'never',
          '--sandbox', mode === 'dev' ? 'workspace-write' : 'read-only',
          '-c', 'approval_policy="never"',
          '--output-last-message', outputFile,
          ...(m.model ? ['-m', m.model] : []),
          '-',
        ],
      };
    }
  }
}

export function scrubbedEnv(cfg: Config): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const k of cfg.envAllowlist) if (process.env[k] !== undefined) env[k] = process.env[k];
  return env;
}

function extractText(cli: string, stdout: string): { text: string; cost: number | null } {
  if (cli === 'claude') {
    try {
      const j = JSON.parse(stdout) as { result?: string; total_cost_usd?: number; is_error?: boolean };
      return { text: j.result ?? '', cost: typeof j.total_cost_usd === 'number' ? j.total_cost_usd : null };
    } catch { /* fall through */ }
  }
  if (cli === 'gemini') {
    try {
      const j = JSON.parse(stdout) as { response?: string };
      if (typeof j.response === 'string') return { text: j.response, cost: null };
    } catch { /* fall through */ }
  }
  return { text: stdout, cost: null };
}

export async function runInvocation(inv: Invocation, cli: string, cwd: string, cfg: Config, timeoutMs: number): Promise<RunResult> {
  const started = Date.now();
  return new Promise<RunResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child;
    try {
      child = spawn(inv.cmd, inv.args, { cwd, env: scrubbedEnv(cfg), stdio: ['pipe', 'pipe', 'pipe'], detached: true });
    } catch (e) {
      return resolve({ ok: false, exitCode: null, timedOut: false, text: '', costUsd: null, durationMs: 0, stderrTail: String(e) });
    }
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { stderr += String(e); });
    child.on('close', async (code) => {
      clearTimeout(timer);
      let { text, cost } = extractText(cli, stdout);
      if (inv.outputFile) text = await readFile(inv.outputFile, 'utf8').catch(() => text);
      resolve({
        ok: code === 0 && !timedOut,
        exitCode: code,
        timedOut,
        text: redact(text),
        costUsd: cost,
        durationMs: Date.now() - started,
        stderrTail: redact(tail(stderr, 2000)),
      });
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(inv.stdin);
  });
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'renkflow-ai-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
