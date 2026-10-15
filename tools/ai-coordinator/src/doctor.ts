import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cliPath } from './pipeline.ts';
import { git } from './git.ts';
import { buildInvocation, runInvocation, withTempDir } from './runner.ts';
import type { Config, ModelId } from './types.ts';
import { redact, tail } from './util.ts';

export interface DoctorRow { model: ModelId; label: string; cli: string; installed: boolean; version: string | null; auth: 'ok' | 'missing' | 'unknown'; authNote: string; modelId: string; live: 'ok' | 'fail' | 'skipped'; liveNote: string }

const sh = (cmd: string, args: string[]) => new Promise<string>((res) => execFile(cmd, args, { timeout: 20_000 }, (_e, out, err) => res(redact(`${out}${err}`.trim()))));

async function authStatus(cli: string): Promise<{ auth: DoctorRow['auth']; note: string }> {
  if (cli === 'claude') {
    const out = await sh('claude', ['auth', 'status']);
    return /"loggedIn":\s*true/.test(out) ? { auth: 'ok', note: 'claude auth status: loggedIn' } : { auth: 'missing', note: 'claude auth login gerekli' };
  }
  if (cli === 'codex') {
    const out = await sh('codex', ['login', 'status']);
    return /logged in/i.test(out) && !/not logged/i.test(out) ? { auth: 'ok', note: out.split('\n')[0] } : { auth: 'missing', note: 'codex login (veya OPENAI_API_KEY) gerekli' };
  }
  const hasEnv = ['GEMINI_API_KEY', 'GOOGLE_GENAI_USE_VERTEXAI', 'GOOGLE_GENAI_USE_GCA'].some((k) => process.env[k]);
  const hasOauth = existsSync(join(process.env.GEMINI_CLI_HOME ?? homedir(), '.gemini', 'oauth_creds.json'));
  return hasEnv || hasOauth ? { auth: 'ok', note: hasEnv ? 'ortam değişkeni ile' : 'OAuth kimliği mevcut' } : { auth: 'missing', note: 'GEMINI_API_KEY veya "gemini" ile oturum açma gerekli' };
}

export async function doctor(repo: string, cfg: Config, live: boolean): Promise<{ rows: DoctorRow[]; git: string[] }> {
  const gitInfo = [
    `branch: ${await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])}`,
    `node: ${process.version}`,
    `worktrees: ${(await git(repo, ['worktree', 'list'])).split('\n').length}`,
  ];
  const rows: DoctorRow[] = [];
  for (const [model, m] of Object.entries(cfg.models) as [ModelId, Config['models'][ModelId]][]) {
    const installed = cliPath(m.cli) !== null;
    const row: DoctorRow = { model, label: m.label, cli: m.cli, installed, version: null, auth: 'unknown', authNote: '', modelId: m.model ?? '(CLI varsayılanı — model adı doğrulanmadı)', live: 'skipped', liveNote: '' };
    if (installed) {
      row.version = (await sh(m.cli, ['--version'])).split('\n')[0];
      Object.assign(row, await authStatus(m.cli));
      if (live && row.auth === 'ok') {
        await withTempDir(async (dir) => {
          const inv = buildInvocation(model, cfg, 'plan', 'Yalnızca şu kelimeyi yanıtla: PONG', repo, dir);
          const r = await runInvocation(inv, m.cli, repo, cfg, 90_000);
          row.live = r.ok && /PONG/i.test(r.text) ? 'ok' : 'fail';
          row.liveNote = r.ok ? `yanıt: ${tail(r.text, 60)}${r.costUsd ? ` ($${r.costUsd.toFixed(4)})` : ''}` : tail(r.stderrTail || r.text, 200);
        });
      }
    } else {
      row.authNote = `kurulum: npm i -g ${m.cli === 'gemini' ? '@google/gemini-cli' : '@openai/codex'}`;
    }
    rows.push(row);
  }
  return { rows, git: gitInfo };
}
