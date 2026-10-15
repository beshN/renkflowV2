export type ModelId = 'argon' | 'sol' | 'sonnet';
export type TaskKind = 'docs' | 'code' | 'audit' | 'simulation';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'changes_requested'
  | 'ready_for_pr'
  | 'escalated'
  | 'blocked'
  | 'done'
  | 'cancelled';

export interface TestResult {
  name: string;
  command: string;
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  outputTail: string;
  at: string;
}

export interface ReviewVerdict {
  verdict: 'pass' | 'fail';
  reviewer: ModelId;
  summary: string;
  issues: string[];
  at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  kind: TaskKind;
  owner: ModelId;
  reviewer: ModelId;
  priority: Priority;
  dependencies: string[];
  acceptance: string[];
  /** Repo-relative paths/directories the task may touch; also the lock set. */
  files: string[];
  branch: string | null;
  worktree: string | null;
  commit: string | null;
  tests: TestResult[];
  review: { status: 'none' | 'pending' | 'pass' | 'fail'; verdicts: ReviewVerdict[] };
  status: TaskStatus;
  attempts: number;
  /** Review/test feedback handed to the developer on the next attempt. */
  feedback: string | null;
  nextAction: string;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  version: 1;
  tasks: Task[];
}

export interface ModelConfig {
  /** CLI executable name. */
  cli: 'claude' | 'gemini' | 'codex';
  /**
   * Exact model id passed to the CLI. null => CLI default. Intentionally NOT guessed:
   * set it only after `doctor` / the vendor docs confirm the id exists for your account.
   */
  model: string | null;
  /** Marketing name the project uses for this role (informational). */
  label: string;
  role: string;
}

export interface Limits {
  /** Per model-call wall clock. */
  timeoutMs: number;
  /** Dev retries after a failed review/test before escalating to Sonnet. */
  maxAttempts: number;
  /** Hard cap on total model invocations per coordinator state file. */
  maxTotalRuns: number;
  maxRunsPerTask: number;
  /** Enforced only when the CLI reports cost (Claude does); others are run-count capped. */
  maxTotalUsd: number;
  maxUsdPerRun: number;
  /** Consecutive failed model calls before the circuit breaker stops the loop. */
  maxConsecutiveFailures: number;
}

export interface CheckSpec {
  name: string;
  command: string;
  cwd: string;
  timeoutMs: number;
}

export interface Config {
  models: Record<ModelId, ModelConfig>;
  limits: Limits;
  checks: Record<TaskKind, CheckSpec[]>;
  /** Path prefixes a docs/audit/simulation task may touch. */
  docsAllowedPrefixes: string[];
  protectedBranches: string[];
  worktreeRoot: string;
  /** Env vars forwarded to model CLIs (everything else is scrubbed). */
  envAllowlist: string[];
}

export interface Usage {
  runs: number;
  consecutiveFailures: number;
  totalUsd: number;
  perTaskRuns: Record<string, number>;
  perModel: Record<string, { runs: number; usd: number; ms: number }>;
}
