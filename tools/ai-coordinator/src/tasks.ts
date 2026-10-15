import type { Config, Priority, Task, TaskKind, ModelId } from './types.ts';
import { isWithin, nowIso } from './util.ts';
import { branchFor } from './git.ts';

export interface NewTask {
  id: string; title: string; description: string; kind: TaskKind; owner: ModelId; reviewer: ModelId;
  priority?: Priority; dependencies?: string[]; acceptance: string[]; files: string[];
}

const SENSITIVE = /(^|\/)(\.env|.*\.pem|.*secret.*|.*credentials.*)(\.|$)/i;

export function validateNewTask(n: NewTask, cfg: Config, existing: Task[]): string[] {
  const errs: string[] = [];
  if (!/^[A-Z][A-Z0-9]*-\d{3,}$/.test(n.id)) errs.push('id biçimi PREFIX-001 olmalı');
  if (existing.some((t) => t.id === n.id)) errs.push(`id zaten var: ${n.id}`);
  if (!n.title || !n.description) errs.push('title ve description zorunlu');
  if (!(n.owner in cfg.models) || n.owner === 'sonnet') errs.push('owner argon veya sol olmalı (sonnet geliştirici değildir)');
  if (!(n.reviewer in cfg.models)) errs.push('reviewer geçersiz');
  if (n.owner === n.reviewer) errs.push('reviewer ile owner aynı model olamaz (bağımsız denetim)');
  if (!n.acceptance?.length) errs.push('en az bir kabul kriteri gerekli');
  if (!n.files?.length) errs.push('files boş olamaz (dosya kilidi için gerekli)');
  for (const f of n.files ?? []) {
    if (f.startsWith('/') || f.split('/').includes('..')) errs.push(`geçersiz yol: ${f}`);
    if (SENSITIVE.test(f)) errs.push(`hassas dosya yasak: ${f}`);
    if (n.kind !== 'code' && !isWithin(f, cfg.docsAllowedPrefixes)) errs.push(`${n.kind} görevi yalnızca ${cfg.docsAllowedPrefixes.join(', ')} altına yazabilir: ${f}`);
    if (isWithin(f, ['.git', 'tools/ai-coordinator', '.github', 'ai-workspace/TASK_BOARD.json'])) errs.push(`koordinatör/CI altyapısı model tarafından değiştirilemez: ${f}`);
  }
  for (const d of n.dependencies ?? []) if (!existing.some((t) => t.id === d)) errs.push(`bilinmeyen bağımlılık: ${d}`);
  return errs;
}

export function makeTask(n: NewTask): Task {
  const ts = nowIso();
  return {
    id: n.id, title: n.title, description: n.description, kind: n.kind, owner: n.owner, reviewer: n.reviewer,
    priority: n.priority ?? 'P2', dependencies: n.dependencies ?? [], acceptance: n.acceptance, files: n.files,
    branch: branchFor(n.id, n.owner), worktree: null, commit: null, tests: [],
    review: { status: 'none', verdicts: [] }, status: 'todo', attempts: 0, feedback: null,
    nextAction: `${n.owner} görevi alacak.`, blockedReason: null, createdAt: ts, updatedAt: ts,
  };
}
