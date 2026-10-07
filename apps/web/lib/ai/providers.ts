import 'server-only';

/**
 * Model providers the app can be pointed at. Production stays on OpenAI (gpt-6-luna) until the
 * evaluation set (evals/) shows a winner; the deployment contract (lib/config/deployment-env.ts)
 * enforces that. Gemini and GLM are reached through their OpenAI-compatible Chat Completions
 * endpoints, so one client serves both. Keys, addresses and model ids come from the environment.
 *
 * Data protection: every provider receives the same masked text (lib/ai/privacy.ts). All three are
 * outside Turkey, so sending order text to any of them is a cross-border transfer (KVKK).
 */
export type ProviderId = 'openai' | 'gemini' | 'glm';

type ProviderSpec = {
  label: string;
  keyEnv: string;
  /** Null for OpenAI: its own SDK default is used and the Responses API path ignores it. */
  baseUrlEnv: string | null;
  defaultBaseUrl: string | null;
  modelEnv: string;
  defaultModel: string;
  /** How the provider is asked for structured output on Chat Completions. */
  structuredOutput: 'json_schema' | 'json_object';
  /** Request fields that keep reasoning low, matching `reasoning.effort: low` on the OpenAI path. */
  lowReasoning: Record<string, unknown>;
};

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  openai: { label: 'OpenAI', keyEnv: 'OPENAI_API_KEY', baseUrlEnv: null, defaultBaseUrl: null, modelEnv: 'OPENAI_MODEL', defaultModel: 'gpt-6-luna', structuredOutput: 'json_schema', lowReasoning: {} },
  // https://ai.google.dev/gemini-api/docs/openai
  gemini: { label: 'Google Gemini', keyEnv: 'GEMINI_API_KEY', baseUrlEnv: 'GEMINI_BASE_URL', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', modelEnv: 'GEMINI_MODEL', defaultModel: 'gemini-3.8-flash', structuredOutput: 'json_schema', lowReasoning: { reasoning_effort: 'low' } },
  // Z.ai (international); the mainland endpoint is https://open.bigmodel.cn/api/paas/v4/. GLM has
  // no effort levels, only thinking on/off; off is the nearest to "low".
  glm: { label: 'Z.ai GLM', keyEnv: 'ZAI_API_KEY', baseUrlEnv: 'ZAI_BASE_URL', defaultBaseUrl: 'https://api.z.ai/api/paas/v4/', modelEnv: 'ZAI_MODEL', defaultModel: 'glm-5.3-flash', structuredOutput: 'json_object', lowReasoning: { thinking: { type: 'disabled' } } },
};

export function isProviderId(value: string): value is ProviderId {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, value);
}

/** The provider chosen in the environment (AI_PROVIDER), OpenAI when unset. An unknown value is an error, not a fallback. */
export function activeProvider(): ProviderId {
  const value = process.env.AI_PROVIDER?.trim().toLowerCase() || 'openai';
  if (!isProviderId(value)) throw new Error(`AI_PROVIDER geçersiz: ${value}. Geçerli değerler: ${Object.keys(PROVIDERS).join(', ')}.`);
  return value;
}

export function providerConfig(id: ProviderId) {
  const spec = PROVIDERS[id];
  return {
    id,
    label: spec.label,
    apiKey: process.env[spec.keyEnv]?.trim() || null,
    baseURL: (spec.baseUrlEnv && process.env[spec.baseUrlEnv]?.trim()) || spec.defaultBaseUrl,
    model: process.env[spec.modelEnv]?.trim() || spec.defaultModel,
    structuredOutput: spec.structuredOutput,
    lowReasoning: spec.lowReasoning,
  };
}

/** Why a provider cannot be used right now, or null when it can. */
export function providerUnavailable(id: ProviderId): string | null {
  return providerConfig(id).apiKey ? null : `${PROVIDERS[id].keyEnv} tanımlı değil`;
}
