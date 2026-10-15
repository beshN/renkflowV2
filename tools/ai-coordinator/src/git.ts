import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Config, ModelId } from './types.ts';
import { isWithin, redact } from './util.ts';

export class SecretLeakError extends Error {}

export function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, env: { ...process.env, ...env }, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`git ${args.join(' ')} failed: ${stderr || err.message}`));
      else resolve(stdout.trim());
    });
  });
}

export const branchFor = (taskId: string, owner: ModelId) => `ai/${owner}/${taskId.toLowerCase()}`;

export function assertSafeBranch(branch: string, cfg: Config): void {
  const bare = branch.replace(/^refs\/heads\//, '');
  if (cfg.protectedBranches.includes(bare) || !bare.startsWith('ai/')) {
    throw new Error(`Branch "${bare}" korumalı veya ai/ ön ekli değil; modeller yalnızca ai/<model>/<görev> dallarına yazabilir.`);
  }
}

/** One worktree per task under .ai-worktrees/<model>/<task>, on its own ai/* branch. */
export async function ensureWorktree(repo: string, cfg: Config, owner: ModelId, taskId: string, base: string): Promise<{ branch: string; path: string }> {
  const branch = branchFor(taskId, owner);
  assertSafeBranch(branch, cfg);
  const path = join(repo, cfg.worktreeRoot, owner, taskId.toLowerCase());
  if (!existsSync(path)) {
    await mkdir(dirname(path), { recursive: true });
    const exists = await git(repo, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).then(() => true, () => false);
    await git(repo, exists ? ['worktree', 'add', path, branch] : ['worktree', 'add', '-b', branch, path, base]);
  }
  return { branch, path };
}

export async function changedPaths(worktree: string): Promise<string[]> {
  const out = await git(worktree, ['status', '--porcelain', '-z', '--untracked-files=all']);
  if (!out) return [];
  return out.split('\0').filter(Boolean).map((l) => l.slice(3));
}

/** Changed paths that fall outside the task's declared file set. */
export async function scopeViolations(worktree: string, allowed: string[]): Promise<string[]> {
  return (await changedPaths(worktree)).filter((p) => !isWithin(p, allowed));
}

export async function commitAll(worktree: string, owner: ModelId, message: string): Promise<string | null> {
  const env = {
    GIT_AUTHOR_NAME: `renkflow-ai-${owner}`, GIT_AUTHOR_EMAIL: `${owner}@ai.renkflow.local`,
    GIT_COMMITTER_NAME: `renkflow-ai-${owner}`, GIT_COMMITTER_EMAIL: `${owner}@ai.renkflow.local`,
  };
  await git(worktree, ['add', '-A']);
  const staged = await git(worktree, ['diff', '--cached', '--name-only']);
  if (!staged) return null;
  const patch = await git(worktree, ['diff', '--cached']);
  if (redact(patch) !== patch) {
    await git(worktree, ['reset', '-q']);
    throw new SecretLeakError('Değişiklikte gizli anahtar/token benzeri içerik bulundu; commit engellendi.');
  }
  await git(worktree, ['commit', '-m', message], env);
  return git(worktree, ['rev-parse', 'HEAD']);
}

export async function removeWorktree(repo: string, path: string): Promise<void> {
  await git(repo, ['worktree', 'remove', '--force', path]);
}

export async function diffAgainst(worktree: string, base: string, maxChars = 60_000): Promise<string> {
  const d = await git(worktree, ['diff', `${base}...HEAD`]);
  return d.length > maxChars ? `${d.slice(0, maxChars)}\n…[diff truncated]` : d;
}

/** Push is only ever allowed for ai/* branches; never for protected ones. */
export async function pushBranch(repo: string, cfg: Config, branch: string): Promise<string> {
  assertSafeBranch(branch, cfg);
  return git(repo, ['push', '-u', 'origin', branch]);
}
