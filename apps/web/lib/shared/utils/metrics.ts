import 'server-only';

type TimingMetric = {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  lastAt: string;
};

type CounterMetric = {
  count: number;
  lastAt: string;
};

type MetricsState = {
  timings: Record<string, TimingMetric>;
  counters: Record<string, CounterMetric>;
};

declare global {
  var __renkflowMetrics: MetricsState | undefined;
}

function getState(): MetricsState {
  if (!global.__renkflowMetrics) {
    global.__renkflowMetrics = { timings: {}, counters: {} };
  }
  return global.__renkflowMetrics;
}

function nowMs(): number {
  return Date.now();
}

export function incrementMetric(name: string, amount: number = 1): void {
  const state = getState();
  const current = state.counters[name] ?? { count: 0, lastAt: new Date().toISOString() };

  state.counters[name] = {
    count: current.count + amount,
    lastAt: new Date().toISOString(),
  };
}

export async function withServerActionTiming<T>(
  actionName: string,
  fn: () => Promise<T>,
  options: { slowMs?: number } = {}
): Promise<T> {
  const slowMs = options.slowMs ?? 300;
  const start = nowMs();

  try {
    return await fn();
  } finally {
    const elapsed = nowMs() - start;
    const state = getState();
    const metric = state.timings[actionName] ?? {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      lastMs: 0,
      lastAt: new Date().toISOString(),
    };

    state.timings[actionName] = {
      count: metric.count + 1,
      totalMs: metric.totalMs + elapsed,
      maxMs: Math.max(metric.maxMs, elapsed),
      lastMs: elapsed,
      lastAt: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== 'production' && elapsed >= slowMs) {
      console.warn(`[perf] slow server action: ${actionName} took ${elapsed}ms`);
    }
  }
}

export function getMetricsSnapshot(): MetricsState {
  const state = getState();
  return {
    timings: { ...state.timings },
    counters: { ...state.counters },
  };
}

export function resetMetricsSnapshot(): void {
  global.__renkflowMetrics = { timings: {}, counters: {} };
}
