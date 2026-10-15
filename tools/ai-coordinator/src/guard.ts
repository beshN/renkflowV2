import type { Config, ModelId, Usage } from './types.ts';

export class BudgetError extends Error {}

/** Throws before a model call if any cost/run/circuit-breaker limit is exhausted. */
export function assertCanRun(cfg: Config, usage: Usage, taskId: string): void {
  const l = cfg.limits;
  if (usage.runs >= l.maxTotalRuns) throw new BudgetError(`Toplam model çağrısı limiti doldu (${l.maxTotalRuns}).`);
  if ((usage.perTaskRuns[taskId] ?? 0) >= l.maxRunsPerTask) throw new BudgetError(`${taskId}: görev başına çağrı limiti doldu (${l.maxRunsPerTask}).`);
  if (usage.totalUsd >= l.maxTotalUsd) throw new BudgetError(`Toplam maliyet limiti doldu ($${l.maxTotalUsd}).`);
  if (usage.consecutiveFailures >= l.maxConsecutiveFailures) {
    throw new BudgetError(`Devre kesici açık: ${usage.consecutiveFailures} ardışık model hatası. Sebebi inceleyip "reset-breaker" çalıştırın.`);
  }
}

export function recordRun(usage: Usage, model: ModelId, taskId: string, ok: boolean, costUsd: number | null, ms: number): void {
  usage.runs += 1;
  usage.perTaskRuns[taskId] = (usage.perTaskRuns[taskId] ?? 0) + 1;
  usage.consecutiveFailures = ok ? 0 : usage.consecutiveFailures + 1;
  usage.totalUsd += costUsd ?? 0;
  const m = (usage.perModel[model] ??= { runs: 0, usd: 0, ms: 0 });
  m.runs += 1;
  m.usd += costUsd ?? 0;
  m.ms += ms;
}
