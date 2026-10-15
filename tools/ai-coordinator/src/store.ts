import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Board, Task, Usage } from './types.ts';
import { atomicWrite, isWithin, nowIso, pathsOverlap, redact, withLock } from './util.ts';

export const HOLDING: Task['status'][] = ['in_progress', 'in_review', 'changes_requested'];
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

export const emptyUsage = (): Usage => ({ runs: 0, consecutiveFailures: 0, totalUsd: 0, perTaskRuns: {}, perModel: {} });

/** Atomic, lock-protected access to TASK_BOARD.json, usage counters and the event log. */
export class Store {
  readonly dir: string;
  constructor(workspace: string) {
    this.dir = workspace;
  }
  private get boardPath() { return join(this.dir, 'TASK_BOARD.json'); }
  private get usagePath() { return join(this.dir, 'reports', 'usage.json'); }
  private get lockPath() { return join(this.dir, '.board.lock'); }
  get stopFile() { return join(this.dir, 'STOP'); }
  stopRequested(): boolean { return existsSync(this.stopFile); }

  async readBoard(): Promise<Board> {
    if (!existsSync(this.boardPath)) return { version: 1, tasks: [] };
    return JSON.parse(await readFile(this.boardPath, 'utf8')) as Board;
  }

  /** Locked read-modify-write. `fn` mutates the board and may return a value. */
  async update<T>(fn: (board: Board, usage: Usage) => T | Promise<T>): Promise<T> {
    await mkdir(this.dir, { recursive: true });
    return withLock(this.lockPath, async () => {
      const board = await this.readBoard();
      const usage = existsSync(this.usagePath) ? (JSON.parse(await readFile(this.usagePath, 'utf8')) as Usage) : emptyUsage();
      const result = await fn(board, usage);
      await atomicWrite(this.boardPath, `${JSON.stringify(board, null, 2)}\n`);
      await atomicWrite(this.usagePath, `${JSON.stringify(usage, null, 2)}\n`);
      return result;
    });
  }

  async readUsage(): Promise<Usage> {
    return existsSync(this.usagePath) ? (JSON.parse(await readFile(this.usagePath, 'utf8')) as Usage) : emptyUsage();
  }

  async patchTask(id: string, patch: Partial<Task>): Promise<Task> {
    return this.update((board) => {
      const t = board.tasks.find((x) => x.id === id);
      if (!t) throw new Error(`Unknown task ${id}`);
      Object.assign(t, patch, { updatedAt: nowIso() });
      return structuredClone(t);
    });
  }

  async event(type: string, data: Record<string, unknown> = {}): Promise<void> {
    await mkdir(join(this.dir, 'reports'), { recursive: true });
    const line = redact(JSON.stringify({ at: nowIso(), type, ...data }));
    await appendFile(join(this.dir, 'reports', 'events.jsonl'), `${line}\n`);
  }
}

/** Files already claimed by other tasks that are currently being worked on. */
export function conflictingTasks(board: Board, task: Task): Task[] {
  return board.tasks.filter(
    (o) => o.id !== task.id && HOLDING.includes(o.status) && o.files.some((f) => task.files.some((g) => pathsOverlap(f, g))),
  );
}

/** Next task that may start now: deps done, no file conflict, highest priority first. */
export function pickNext(board: Board): Task | null {
  const done = new Set(board.tasks.filter((t) => t.status === 'done').map((t) => t.id));
  const candidates = board.tasks
    .filter((t) => (t.status === 'todo' || t.status === 'changes_requested') && t.dependencies.every((d) => done.has(d)))
    .filter((t) => conflictingTasks(board, t).length === 0)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt));
  return candidates[0] ?? null;
}

export { isWithin };
