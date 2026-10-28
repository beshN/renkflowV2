import 'server-only';

import { sql } from '@/lib/db';
import { releaseModelReservation, reserveModelCall } from './gate.server';
import {COMPANY_RESEARCH_SEARCH_USD} from './company-research';

/** Who a model request was made for; written next to its tokens, latency and cost. */
export type AIRequestMeta = {
  tenantId?: string | null; userId?: string | null; feature: string;
  /** Also reports the measured usage to the caller (evals/ compares providers with it). */
  onUsage?: (usage: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null; latencyMs: number }) => void;
};

/** Anthropic reports prompt-cache reads and writes apart from input_tokens; OpenAI-style usage has neither. */
type Tokens = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;server_tool_use?:{web_search_requests?:number}|null } | null | undefined;
export function searchRequests(usage:Tokens){const n=usage?.server_tool_use?.web_search_requests;return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?n:0;}
export function toolCostUsd(usage:Tokens){return Number((searchRequests(usage)*COMPANY_RESEARCH_SEARCH_USD).toFixed(6));}

/** Anthropic list prices, USD per million tokens. */
const DEFAULT_PRICES: Record<string, { input: number; output: number }> = {
  'minimax-m3.1-flash-free': { input: 0, output: 0 },
  'deepseek-v4.1-flash-free': { input: 0, output: 0 },
  'mimo-v2.6-flash-free': { input: 0, output: 0 },
  'glm-5.3-flash-free': { input: 0, output: 0 },
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
  return Number(((input * price.input + output * price.output) / 1_000_000+toolCostUsd(usage)).toFixed(6));
}

/**
 * What the gate reserves for a model without a known price: an expensive model's list price, so
 * an unknown model never slips under the budget for being unpriced.
 */
export const UNKNOWN_MODEL_PRICE = { input: 15, output: 75 } as const;
/** Assumed when the caller does not say: request max_tokens and prompt size. */
export const DEFAULT_ESTIMATE_OUTPUT_TOKENS = 8_000;
export const DEFAULT_ESTIMATE_INPUT_TOKENS = 20_000;

/** The caller's worst case for one request; reserved before the call, reconciled after it. */
export type CallEstimate = { maxOutputTokens?: number; inputTokens?: number; webSearches?: number };

/**
 * Estimates for callers that do not pass one, by feature (the AI office sends its own request
 * sizes: max_tokens 32 000 per runner turn with files and lookups in the prompt).
 */
const FEATURE_ESTIMATES: Record<string, CallEstimate> = {
  office: { maxOutputTokens: 32_000, inputTokens: 60_000 },
  office_review: { maxOutputTokens: 2_500, inputTokens: 40_000 },
  office_triage: { maxOutputTokens: 2_000, inputTokens: 5_000 },
};
export function defaultEstimate(feature: string | undefined): CallEstimate {
  return (feature && FEATURE_ESTIMATES[feature]) || {};
}

/** Tokens a document / image block is assumed to cost (its base64 body is not text the model reads). */
const BINARY_BLOCK_TOKENS = 5_000;
/**
 * A rough upper estimate of the prompt's input tokens (about 3 characters per token for Turkish
 * text and JSON). Base64 bodies (`data`) count a fixed amount per block instead of their length.
 */
export function approxInputTokens(...parts: unknown[]): number {
  let binary = 0;
  const text = JSON.stringify(parts, (key, value) => {
    if (key === 'data' && typeof value === 'string' && value.length > 256) { binary++; return ''; }
    return value;
  }) ?? '';
  return Math.ceil(text.length / 3) + binary * BINARY_BLOCK_TOKENS;
}

/** Maximum cost of one request: max_tokens × output price + expected input × input price (+ searches). */
export function estimateCallCostUsd(model: string, estimate: CallEstimate = {}): number {
  const price = modelPrice(model) ?? UNKNOWN_MODEL_PRICE;
  const positive = (n: number | undefined, fallback: number) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback);
  const output = positive(estimate.maxOutputTokens, DEFAULT_ESTIMATE_OUTPUT_TOKENS);
  const input = positive(estimate.inputTokens, DEFAULT_ESTIMATE_INPUT_TOKENS);
  const searches = positive(estimate.webSearches, 0) * COMPANY_RESEARCH_SEARCH_USD;
  return Number(((input * price.input + output * price.output) / 1_000_000 + searches).toFixed(6));
}

let tableMissingLogged = false;

/** Best effort: a usage row must never fail the request it describes. */
export async function recordAIUsage(entry: AIRequestMeta & { provider: string; model: string; usage?: Tokens; latencyMs: number; status: 'ok' | 'error'; errorCode?: string | null }) {
  try {
    await sql`
      INSERT INTO ai_usage (tenant_id, user_id, feature, provider, model, input_tokens, output_tokens, cost_usd, latency_ms, status, error_code,web_search_requests,tool_cost_usd)
      VALUES (${entry.tenantId ?? null}, ${entry.userId ?? null}, ${entry.feature}, ${entry.provider}, ${entry.model},
        ${inputTokens(entry.usage)}, ${entry.usage?.output_tokens ?? null}, ${costUsd(entry.model, entry.usage)},
        ${Math.round(entry.latencyMs)}, ${entry.status}, ${entry.errorCode ?? null},${searchRequests(entry.usage)},${toolCostUsd(entry.usage)})
    `;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    // Existing installations may not have 072 yet. Keep their original usage log working.
    if(code==='42703'){
      try{
        await sql`INSERT INTO ai_usage(tenant_id,user_id,feature,provider,model,input_tokens,output_tokens,cost_usd,latency_ms,status,error_code) VALUES(${entry.tenantId??null},${entry.userId??null},${entry.feature},${entry.provider},${entry.model},${inputTokens(entry.usage)},${entry.usage?.output_tokens??null},${costUsd(entry.model,entry.usage)},${Math.round(entry.latencyMs)},${entry.status},${entry.errorCode??null})`;
        return;
      }catch{/* Report the original schema error below if the legacy insert also fails. */}
    }
    if (code === '42P01') {
      if (!tableMissingLogged) console.warn('[AI usage] ai_usage tablosu yok; 029 migration uygulanana kadar kullanım kaydı tutulmuyor.');
      tableMissingLogged = true;
      return;
    }
    console.error('[AI usage] Kayıt yazılamadı:', error instanceof Error ? error.message : error);
  }
}

/**
 * Runs one model call and records its usage, latency and outcome; errors are rethrown, never replaced.
 * The firm's assistant mode and spend caps come first, atomically: a reservation with the call's
 * maximum cost (`estimate`) is taken before the provider is called and released after the real
 * usage row is written, so concurrent calls cannot all pass the same remaining budget.
 */
export async function withUsage<T extends { usage?: Tokens }>(meta: AIRequestMeta | undefined, provider: string, model: string, call: () => Promise<T>, estimate?: CallEstimate): Promise<T> {
  const reservation = meta?.tenantId
    ? await reserveModelCall(meta, { model, estimateUsd: estimateCallCostUsd(model, estimate ?? defaultEstimate(meta.feature)) })
    : null;
  try {
    return await measured(meta, provider, model, call);
  } finally {
    // After recordAIUsage: for a moment the call counts twice (safe), never zero times.
    await releaseModelReservation(reservation);
  }
}

async function measured<T extends { usage?: Tokens }>(meta: AIRequestMeta | undefined, provider: string, model: string, call: () => Promise<T>): Promise<T> {
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
