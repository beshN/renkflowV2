import { readFileSync } from 'node:fs';
import type { EvalCase } from './core';
import { providerConfig, providerUnavailable, type ProviderId } from '../lib/ai/providers';

export type ProviderRun = { items: Array<Record<string, unknown>>; latencyMs: number; inputTokens: number | null; outputTokens: number | null; costUsd: number | null };
export type EvalProvider = { name: string; model: string; available: () => string | null; extract: (testCase: EvalCase) => Promise<ProviderRun> };

/**
 * The product path itself: the same prompt, masking and schema the app uses (AIService.analyzeText),
 * on the given provider (lib/ai/providers.ts). A provider without its key is reported as not run,
 * so no comparison can be reported without having actually run.
 */
export function productProvider(id: ProviderId = 'openai'): EvalProvider {
  const { model } = providerConfig(id);
  return {
    name: id,
    model,
    available: () => providerUnavailable(id),
    extract: async (testCase) => {
      const { getAIService } = await import('../lib/ai/service');
      let usage: Omit<ProviderRun, 'items'> = { latencyMs: 0, inputTokens: null, outputTokens: null, costUsd: null };
      try {
        const result = await getAIService().analyzeText(testCase.input, [], { feature: 'eval.order-extraction', onUsage: (u) => { usage = u; } }, id);
        return { items: result.items as Array<Record<string, unknown>>, ...usage };
      } catch (error) {
        // A failed case keeps its time, tokens and cost, so a failing provider does not look cheaper.
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { run: usage });
      }
    },
  };
}

/** Replays recorded outputs ({ caseId: items }) — for testing the harness itself, never for comparisons. */
export function replayProvider(file: string): EvalProvider {
  const recorded = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Array<Record<string, unknown>>>;
  return {
    name: 'replay',
    model: file,
    available: () => null,
    extract: async (testCase) => ({ items: recorded[testCase.id] ?? [], latencyMs: 0, inputTokens: null, outputTokens: null, costUsd: null }),
  };
}
