import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { accessSync, constants } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { runCheck } from './checks.ts';
import { assertCanRun, BudgetError, recordRun } from './guard.ts';
import { commitAll, diffAgainst, ensureWorktree, git, pushBranch, scopeViolations, SecretLeakError } from './git.ts';
import { escalationPrompt, devPrompt, parseTailJson, reviewPrompt } from './prompts.ts';
import { buildInvocation, runInvocation, scrubbedEnv, withTempDir, type Mode, type RunResult } from './runner.ts';
import { conflictingTasks, pickNext, Store } from './store.ts';
import type { Config, ModelId, ReviewVerdict, Task, TestResult } from './types.ts';
import { nowIso, redact, tail } from './util.ts';

export class BlockedError extends Error {}

export function cliPath(cmd: string): string | null {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const p = join(dir, cmd);
    try { accessSync(p, constants.X_OK); return p; } catch { /* next */ }
  }
  return null;
}

export class Pipeline {
  readonly repo: string;
  readonly cfg: Config;
  readonly store: Store;
  readonly baseBranch: string;
  constructor(repo: string, cfg: Config, store: Store, baseBranch = 'main') {
    this.repo = repo;
    this.cfg = cfg;
    this.store = store;
    this.baseBranch = baseBranch;
  }

  /** Budget-checked model call with run accounting and structured event logging. */
  async callModel(model: ModelId, mode: Mode, prompt: string, cwd: string, taskId: string): Promise<RunResult> {
    const m = this.cfg.models[model];
    if (!cliPath(m.cli)) throw new BlockedError(`${m.label}: "${m.cli}" CLI kurulu değil (PATH'te bulunamadı).`);
    await this.store.update((_b, usage) => assertCanRun(this.cfg, usage, taskId));
    const res = await withTempDir(async (dir) => {
      const inv = buildInvocation(model, this.cfg, mode, prompt, cwd, dir);
      return runInvocation(inv, m.cli, cwd, this.cfg, this.cfg.limits.timeoutMs);
    });
    await this.store.update((_b, usage) => recordRun(usage, model, taskId, res.ok, res.costUsd, res.durationMs));
    await this.store.event('model_run', {
      task: taskId, model, cli: m.cli, mode, ok: res.ok, exitCode: res.exitCode, timedOut: res.timedOut,
      costUsd: res.costUsd, ms: res.durationMs, stderr: res.ok ? undefined : res.stderrTail,
    });
    return res;
  }

  /** Atomically claim the task (status, attempt, file locks). Returns null if it cannot start. */
  private async claim(id: string): Promise<Task | null> {
    return this.store.update((board) => {
      const t = board.tasks.find((x) => x.id === id);
      if (!t || (t.status !== 'todo' && t.status !== 'changes_requested')) return null;
      const done = new Set(board.tasks.filter((x) => x.status === 'done').map((x) => x.id));
      if (!t.dependencies.every((d) => done.has(d)) || conflictingTasks(board, t).length > 0) return null;
      t.status = 'in_progress';
      t.attempts += 1;
      t.updatedAt = nowIso();
      return structuredClone(t);
    });
  }

  private async setState(id: string, patch: Partial<Task>): Promise<Task> {
    return this.store.patchTask(id, patch);
  }

  private async fail(t: Task, feedback: string, nextAction: string): Promise<Task> {
    const exhausted = t.attempts >= this.cfg.limits.maxAttempts;
    await this.store.event('task_attempt_failed', { task: t.id, attempt: t.attempts, exhausted, feedback: tail(feedback, 500) });
    return this.setState(t.id, exhausted
      ? { status: 'escalated', feedback, nextAction: 'Sonnet kararı gerekli (deneme limiti doldu): escalate komutu.' }
      : { status: 'changes_requested', feedback, nextAction });
  }

  async runTask(id: string): Promise<Task> {
    const t = await this.claim(id);
    if (!t) throw new Error(`${id} şu an başlatılamaz (durum/bağımlılık/dosya kilidi).`);
    await this.store.event('task_started', { task: id, owner: t.owner, attempt: t.attempts });
    try {
      return await this.runAttempt(t);
    } catch (err) {
      const msg = redact(err instanceof Error ? err.message : String(err));
      const infra = err instanceof BlockedError || err instanceof BudgetError;
      await this.store.event('task_aborted', { task: id, infra, error: msg });
      // Infrastructure problems must not burn a developer attempt.
      return this.setState(id, { status: infra ? 'blocked' : 'changes_requested', blockedReason: infra ? msg : null,
        attempts: infra ? Math.max(0, t.attempts - 1) : t.attempts, nextAction: infra ? `Engel: ${msg}` : `Hata sonrası yeniden dene: ${msg}` });
    }
  }

  private async runAttempt(t: Task): Promise<Task> {
    for (const m of [t.owner, t.reviewer]) {
      const c = this.cfg.models[m];
      if (!cliPath(c.cli)) throw new BlockedError(`${c.label}: "${c.cli}" CLI kurulu değil (PATH'te bulunamadı).`);
    }
    const { branch, path } = await ensureWorktree(this.repo, this.cfg, t.owner, t.id, this.baseBranch);
    await this.setState(t.id, { branch, worktree: path, blockedReason: null });

    const dev = await this.callModel(t.owner, 'dev', devPrompt(t, t.feedback), path, t.id);
    if (!dev.ok) {
      return this.fail(t, `Geliştirici çağrısı başarısız (exit ${dev.exitCode}${dev.timedOut ? ', zaman aşımı' : ''}): ${dev.stderrTail}`, 'Aynı görevi yeniden dene.');
    }

    const bad = await scopeViolations(path, t.files);
    if (bad.length) {
      for (const p of bad) {
        await git(path, ['checkout', '--', p]).catch(() => undefined);
        await git(path, ['clean', '-fdq', '--', p]).catch(() => undefined);
      }
      return this.fail(t, `Kapsam ihlali — izinli dosyalar dışında değişiklik yapıldı ve geri alındı: ${bad.join(', ')}`, 'Yalnızca izinli dosyalarda çalış.');
    }

    let commit: string | null;
    try {
      commit = await commitAll(path, t.owner, `${t.id}: ${t.title}\n\nAI görevi ${t.id} (${t.owner}, deneme ${t.attempts}).`);
    } catch (e) {
      if (!(e instanceof SecretLeakError)) throw e;
      await git(path, ['checkout', '--', '.']).catch(() => undefined);
      await git(path, ['clean', '-fdq']).catch(() => undefined);
      return this.fail(t, `${e.message} Değişiklikler geri alındı; sırları dosyalara yazma.`, 'Gizli bilgi içermeden yeniden uygula.');
    }
    if (!commit && !(await git(path, ['rev-parse', 'HEAD']).then((h) => h !== '', () => false))) throw new Error('Commit okunamadı.');
    const head = commit ?? (await git(path, ['rev-parse', 'HEAD']));
    const changed = await git(path, ['diff', '--name-only', `${this.baseBranch}...HEAD`]);
    if (!changed) return this.fail(t, 'Geliştirici hiçbir dosya değiştirmedi.', 'Görevi gerçekten uygula; dosya üret.');
    await this.setState(t.id, { commit: head });

    const tests: TestResult[] = [];
    for (const spec of this.cfg.checks[t.kind]) tests.push(await runCheck(spec, path, scrubbedEnv(this.cfg)));
    await this.setState(t.id, { tests });
    const failed = tests.filter((x) => !x.ok);
    if (failed.length) {
      return this.fail(t, `Başarısız kontroller:\n${failed.map((f) => `# ${f.name}\n${f.outputTail}`).join('\n')}`, 'Başarısız testleri düzelt.');
    }

    await this.setState(t.id, { status: 'in_review', review: { ...t.review, status: 'pending' }, nextAction: `${t.reviewer} denetimi bekleniyor.` });
    const diff = await diffAgainst(path, this.baseBranch);
    const rev = await this.callModel(t.reviewer, 'review', reviewPrompt(t, diff, tests), path, t.id);
    const parsed = rev.ok ? parseTailJson<{ verdict?: string; summary?: string; issues?: string[] }>(rev.text) : null;
    if (!parsed || (parsed.verdict !== 'pass' && parsed.verdict !== 'fail')) {
      // Unparseable / failed review is never treated as a pass.
      await this.setState(t.id, { status: 'blocked', blockedReason: `Denetim sonucu okunamadı (exit ${rev.exitCode}): ${tail(rev.text || rev.stderrTail, 300)}`, review: { ...t.review, status: 'pending' } });
      return (await this.store.readBoard()).tasks.find((x) => x.id === t.id)!;
    }
    const verdict: ReviewVerdict = { verdict: parsed.verdict, reviewer: t.reviewer, summary: redact(parsed.summary ?? ''), issues: (parsed.issues ?? []).map(redact), at: nowIso() };
    const verdicts = [...t.review.verdicts, verdict];
    await this.writeAudit(t, verdict);
    if (verdict.verdict === 'pass') {
      return this.setState(t.id, { status: 'ready_for_pr', feedback: null, review: { status: 'pass', verdicts }, nextAction: 'prepare-pr ile PR hazırla, sonra insan/Sonnet onayı.' });
    }
    await this.setState(t.id, { review: { status: 'fail', verdicts } });
    return this.fail({ ...t, review: { status: 'fail', verdicts } }, `Denetçi (${t.reviewer}) reddetti: ${verdict.summary}\n${verdict.issues.map((i) => `- ${i}`).join('\n')}`, 'Denetçi bulgularını gider.');
  }

  private async writeAudit(t: Task, v: ReviewVerdict): Promise<void> {
    const dir = join(this.repo, 'ai-workspace', 'audits');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${t.id}-attempt${t.attempts}-${v.verdict}.md`),
      `# Denetim ${t.id} (deneme ${t.attempts})\n\n- Denetçi: ${v.reviewer}\n- Karar: **${v.verdict}**\n- Zaman: ${v.at}\n\n${v.summary}\n\n${v.issues.map((i) => `- ${i}`).join('\n')}\n`);
  }

  /** Sonnet decision for escalated tasks, or a sign-off summary for tasks that are ready for PR. */
  async decide(id: string): Promise<{ decision: string; reason: string }> {
    const board = await this.store.readBoard();
    const t = board.tasks.find((x) => x.id === id);
    if (!t) throw new Error(`Bilinmeyen görev ${id}`);
    if (t.status !== 'escalated' && t.status !== 'ready_for_pr') throw new Error(`${id}: Sonnet kararı yalnızca escalated/ready_for_pr için (durum: ${t.status}).`);
    const history = [
      `Durum: ${t.status}, deneme: ${t.attempts}`,
      `Kabul kriterleri:\n${t.acceptance.map((a) => `- ${a}`).join('\n')}`,
      `Testler: ${t.tests.map((x) => `${x.name}=${x.ok ? 'ok' : 'FAIL'}`).join(', ') || '(yok)'}`,
      `Denetimler:\n${t.review.verdicts.map((v) => `- [${v.verdict}] ${v.reviewer}: ${v.summary} ${v.issues.join(' | ')}`).join('\n') || '(yok)'}`,
      t.feedback ? `Son geri bildirim:\n${tail(t.feedback, 1500)}` : '',
    ].join('\n\n');
    const res = await this.callModel('sonnet', 'plan', escalationPrompt(t, history), this.repo, id);
    const d = res.ok ? parseTailJson<{ decision?: string; reason?: string; guidance?: string }>(res.text) : null;
    if (!d?.decision) throw new BlockedError(`Sonnet kararı okunamadı: ${tail(res.text || res.stderrTail, 300)}`);
    const reason = redact(d.reason ?? '');
    await this.store.event('sonnet_decision', { task: id, decision: d.decision, reason });
    const patch: Record<string, Partial<Task>> = {
      accept: { status: 'ready_for_pr', nextAction: 'Sonnet onayladı: prepare-pr.' },
      retry: { status: 'changes_requested', attempts: 0, feedback: redact(d.guidance ?? reason), nextAction: 'Sonnet yönlendirmesiyle yeniden dene.' },
      cancel: { status: 'cancelled', nextAction: 'İptal edildi.' },
      split: { status: 'blocked', blockedReason: `Sonnet: görevi böl — ${reason}`, nextAction: 'Görevi parçalayıp yeni görevler ekleyin.' },
    };
    if (!patch[d.decision]) throw new BlockedError(`Bilinmeyen Sonnet kararı: ${d.decision}`);
    await this.setState(id, patch[d.decision]);
    await mkdir(join(this.repo, 'ai-workspace', 'reports'), { recursive: true });
    await writeFile(join(this.repo, 'ai-workspace', 'reports', `decision-${id}.md`), `# Sonnet kararı — ${id}\n\n- Karar: **${d.decision}**\n- Gerekçe: ${reason}\n- Zaman: ${nowIso()}\n`);
    return { decision: d.decision, reason };
  }

  async preparePr(id: string, push: boolean): Promise<string> {
    const t = (await this.store.readBoard()).tasks.find((x) => x.id === id);
    if (!t || t.status !== 'ready_for_pr' || !t.branch) throw new Error(`${id} PR için hazır değil.`);
    const body = `## ${t.id} — ${t.title}\n\n${t.description}\n\n### Kabul kriterleri\n${t.acceptance.map((a) => `- [x] ${a}`).join('\n')}\n\n### Testler\n${t.tests.map((x) => `- ${x.ok ? '✅' : '❌'} ${x.name}`).join('\n') || '- (otomatik test yok — docs/denetim görevi)'}\n\n### Denetim\n${t.review.verdicts.map((v) => `- ${v.reviewer}: **${v.verdict}** — ${v.summary}`).join('\n')}\n\nSahip: ${t.owner} · Dal: \`${t.branch}\` · Commit: \`${t.commit}\`\n`;
    const path = join(this.repo, 'ai-workspace', 'reports', `pr-${id}.md`);
    await writeFile(path, body);
    if (push) await pushBranch(this.repo, this.cfg, t.branch);
    await this.setState(id, { nextAction: push ? 'Dal itildi; PR açın ve insan onayıyla birleştirin.' : 'PR gövdesi hazır; --push ile dalı itin.' });
    return path;
  }

  /** Deterministic loop: no Sonnet involvement except explicit escalation. */
  async tick(): Promise<Task | null> {
    if (this.store.stopRequested()) throw new BudgetError('STOP dosyası mevcut; koordinatör güvenli şekilde durdu.');
    const next = pickNext(await this.store.readBoard());
    return next ? this.runTask(next.id) : null;
  }
}

export { existsSync };
