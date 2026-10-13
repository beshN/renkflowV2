import 'server-only';

import { sql } from '@/lib/db';
import { assertModelAllowed } from './gate.server';

/** Who a model request was made for; written next to its tokens, latency and cost. */
export type AIRequestMeta = {
  tenantId?: string | null; userId?: string | null; feature: string;
  /** Also reports the measured usage to the caller (evals/ compares providers with it). */
  onUsage?: (usage: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null; latencyMs: number }) => void;
};

/** Anthropic reports prompt-cache reads and writes apart from input_tokens; OpenAI-style usage has neither. */
type Tokens = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | null | undefined;

/** Anthropic list prices, USD per million tokens. */
const DEFAULT_PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10 },
};

/**
 * USD per million tokens, from AI_MODEL_PRICES_USD_PER_MTOK (e.g. {"claude-sonnet-5-5":{"input":2,"output":10}}),
 * else the built-in list price. No price, no cost: tokens are still recorded and the cost stays null
 * rather than being guessed.
 */
export function modelPrice(model: string): { input: number; output: number } | null {
  try {
    const table = JSON.parse(process.env.AI_MODEL_PRICES_USD_PER_MTOK || '{}') as Record<string, { input?: unknown; output?: unknown }>;
    const entry = table[model];
    if (entry && typeof entry.input === 'number' && typeof entry.output === 'number') return { input: entry.input, output: entry.output };
  } catch {
    // A malformed table falls back to the built-in prices.
  }
  return DEFAULT_PRICES[model] ?? null;
}

/** Every input token the model read, cached or not. */
export function inputTokens(usage: Tokens): number | null {
  if (!usage || usage.input_tokens == null) return null;
  return usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
}

export function costUsd(model: string, usage: Tokens): number | null {
  const price = modelPrice(model);
  if (!price || !usage) return null;
  // Cache reads cost 0.1x and 5-minute cache writes 1.25x the input price.
  const input = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) * 0.1 + (usage.cache_creation_input_tokens ?? 0) * 1.25;
  const output = usage.output_tokens ?? 0;
  return Number(((input * price.input + output * price.output) / 1_000_000).toFixed(6));
}

let tableMissingLogged = false;

/** Best effort: a usage row must never fail the request it describes. */
export async function recordAIUsage(entry: AIRequestMeta & { provider: string; model: string; usage?: Tokens; latencyMs: number; status: 'ok' | 'error'; errorCode?: string | null }) {
  try {
    await sql`
      INSERT INTO ai_usage (tenant_id, user_id, feature, provider, model, input_tokens, output_tokens, cost_usd, latency_ms, status, error_code)
      VALUES (${entry.tenantId ?? null}, ${entry.userId ?? null}, ${entry.feature}, ${entry.provider}, ${entry.model},
        ${inputTokens(entry.usage)}, ${entry.usage?.output_tokens ?? null}, ${costUsd(entry.model, entry.usage)},
        ${Math.round(entry.latencyMs)}, ${entry.status}, ${entry.errorCode ?? null})
    `;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === '42P01') {
      if (!tableMissingLogged) console.warn('[AI usage] ai_usage tablosu yok; 029 migration uygulanana kadar kullanım kaydı tutulmuyor.');
      tableMissingLogged = true;
      return;
    }
    console.error('[AI usage] Kayıt yazılamadı:', error instanceof Error ? error.message : error);
  }
}

/** Runs one model call and records its usage, latency and outcome; errors are rethrown, never replaced. */
export async function withUsage<T extends { usage?: Tokens }>(meta: AIRequestMeta | undefined, provider: string, model: string, call: () => Promise<T>): Promise<T> {
  // The firm's assistant mode and spend caps come first: a refused call never reaches the provider.
  if (meta?.tenantId) await assertModelAllowed(meta);
  const started = Date.now();
  let response: T;
  try {
    response = await call();
  } catch (error) {
    if (meta) {
      const errorCode = (error as { code?: string; status?: number })?.code || String((error as { status?: number })?.status ?? '') || (error instanceof Error ? error.name : 'error');
      // An answer that arrived but was unusable still used (and cost) tokens.
      const usage = (error as { usage?: Tokens })?.usage ?? undefined;
      const latencyMs = Date.now() - started;
      const { onUsage, ...entry } = meta;
      await recordAIUsage({ ...entry, provider, model, usage, latencyMs, status: 'error', errorCode: errorCode.slice(0, 80) });
      try {
        onUsage?.({ inputTokens: inputTokens(usage), outputTokens: usage?.output_tokens ?? null, costUsd: costUsd(model, usage), latencyMs });
      } catch {
        // The caller's report must not hide the model error.
      }
    }
    throw error;
  }
  // Outside the try: a failing callback cannot turn a successful call into an "error" row.
  const latencyMs = Date.now() - started;
  if (meta) {
    const { onUsage, ...entry } = meta;
    // Awaited on purpose: one small insert, and a cost record that may silently vanish is worse.
    await recordAIUsage({ ...entry, provider, model, usage: response.usage, latencyMs, status: 'ok' });
    onUsage?.({ inputTokens: inputTokens(response.usage), outputTokens: response.usage?.output_tokens ?? null, costUsd: costUsd(model, response.usage), latencyMs });
  }
  return response;
}
