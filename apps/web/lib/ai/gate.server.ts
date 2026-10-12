import 'server-only';

import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { ModelBlockedError, modelDecision, type AiMode } from './policy';

/*
 * Reading the firm's assistant settings and the model gate. Kept free of the session/auth code so
 * the model layer (usage.ts) can load it anywhere; saving lives in settings.server.ts.
 */

export type AiSettings = {
  mode: AiMode;
  kvkkAckAt: string | null;
  dailyBudgetUsd: number | null;
  userDailyCalls: number;
  detectors: Record<string, { enabled?: boolean; quietDays?: number; threshold?: number }>;
  features: Record<string, boolean>;
  profitFloorPercent: number;
};

/**
 * A firm without a settings row: detectors on, no model call until the owner turns the model on
 * with the KVKK confirmation. A missing schema never implies consent.
 */
export const DEFAULT_AI_SETTINGS: AiSettings = { mode: 'rules', kvkkAckAt: null, dailyBudgetUsd: null, userDailyCalls: 60, detectors: {}, features: {}, profitFloorPercent: 15 };

const cache = new Map<string, { at: number; value: AiSettings }>();
const TTL = 15_000;

export async function getAiSettings(tenantId: string, options: { fresh?: boolean } = {}): Promise<AiSettings> {
  const hit = cache.get(tenantId);
  if (!options.fresh && hit && Date.now() - hit.at < TTL) return hit.value;
  let value = DEFAULT_AI_SETTINGS;
  if (await tableExists('ai_settings')) {
    value = DEFAULT_AI_SETTINGS;
    const [r] = await sql`SELECT * FROM ai_settings WHERE tenant_id = ${tenantId}`;
    if (r) value = {
      mode: r.mode as AiMode, kvkkAckAt: r.kvkk_ack_at ? new Date(r.kvkk_ack_at).toISOString() : null,
      dailyBudgetUsd: r.daily_budget_usd === null ? null : Number(r.daily_budget_usd), userDailyCalls: Number(r.user_daily_calls),
      detectors: r.detectors ?? {}, features: r.features ?? {},
      profitFloorPercent: r.profit_floor_percent === undefined || r.profit_floor_percent === null ? 15 : Number(r.profit_floor_percent),
    };
  }
  cache.set(tenantId, { at: Date.now(), value });
  return value;
}

export const forgetAiSettings = (tenantId: string) => cache.delete(tenantId);

/** Is a feature on (morning summary, price hint, voice …)? On unless the firm turned it off. */
export const featureOn = (s: AiSettings, feature: string) => s.features[feature] !== false;

/**
 * Throws ModelBlockedError when the firm's mode, its daily budget or the person's daily calls do
 * not allow a model call. Calls without a firm (evals, scripts) are not gated.
 */
export async function assertModelAllowed(meta: { tenantId?: string | null; userId?: string | null }) {
  if (!meta.tenantId) return;
  const s = await getAiSettings(meta.tenantId, { fresh: true });
  let spentTodayUsd = 0;
  let userCallsToday = 0;
  if(s.mode==='assist' && !(await tableExists('ai_usage'))) throw new ModelBlockedError('AI_USAGE_UNAVAILABLE');
  if (s.mode === 'assist') {
    const [r] = await sql`SELECT coalesce(sum(cost_usd), 0) AS spent, count(*) FILTER (WHERE user_id = ${meta.userId ?? null})::int AS mine, count(*) FILTER (WHERE cost_usd IS NULL)::int AS unknown
      FROM ai_usage WHERE tenant_id = ${meta.tenantId} AND created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`;
    if(s.dailyBudgetUsd!==null && Number(r?.unknown ?? 0)>0) throw new ModelBlockedError('AI_PRICE_UNKNOWN');
    spentTodayUsd = Number(r?.spent ?? 0);
    userCallsToday = meta.userId ? Number(r?.mine ?? 0) : 0;
  }
  const d = modelDecision({ mode: s.mode, kvkkAck: Boolean(s.kvkkAckAt), dailyBudgetUsd: s.dailyBudgetUsd, userDailyCalls: meta.userId ? s.userDailyCalls : Number.MAX_SAFE_INTEGER, spentTodayUsd, userCallsToday });
  if (!d.ok) throw new ModelBlockedError(d.block);
}

/** May this firm call a model at all right now (key set, mode assist)? For screens that offer it. */
export async function modelEnabledFor(tenantId: string, keyAvailable: boolean) {
  const s = await getAiSettings(tenantId);
  return keyAvailable && s.mode === 'assist' && Boolean(s.kvkkAckAt);
}
