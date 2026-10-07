import { readFileSync } from 'node:fs';
import type { EvalCase } from './core';

export type ProviderRun = { items: Array<Record<string, unknown>>; latencyMs: number; inputTokens: number | null; outputTokens: number | null; costUsd: number | null };
export type EvalProvider = { name: string; model: string; available: () => string | null; extract: (testCase: EvalCase) => Promise<ProviderRun> };

/**
 * The product path itself: the same prompt, masking and schema the app uses (AIService.analyzeText).
 * Other providers join through the provider layer once it exists; until then they are not listed,
 * so no comparison can be reported without having actually run.
 */
export function productProvider(): EvalProvider {
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-6-luna';
  return {
    name: 'openai',
    model,
    available: () => (process.env.OPENAI_API_KEY?.trim() ? null : 'OPENAI_API_KEY tanımlı değil'),
    extract: async (testCase) => {
      const { getAIService } = await import('../lib/ai/service');
      let usage: Omit<ProviderRun, 'items'> = { latencyMs: 0, inputTokens: null, outputTokens: null, costUsd: null };
      const result = await getAIService().analyzeText(testCase.input, [], { feature: 'eval.order-extraction', onUsage: (u) => { usage = u; } });
      return { items: result.items as Array<Record<string, unknown>>, ...usage };
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
