import 'server-only';

import { sql, withTransaction } from '@/lib/db';
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
 * with the KVKK confirmation. Before migration 048 (no table) the old behaviour stays: model on.
 */
export const DEFAULT_AI_SETTINGS: AiSettings = { mode: 'rules', kvkkAckAt: null, dailyBudgetUsd: null, userDailyCalls: 60, detectors: {}, features: {}, profitFloorPercent: 15 };
const LEGACY_AI_SETTINGS: AiSettings = { ...DEFAULT_AI_SETTINGS, mode: 'assist', kvkkAckAt: 'before-048' };

const cache = new Map<string, { at: number; value: AiSettings }>();
const TTL = 15_000;

// postgres.js client or transaction; typed loosely like the rest of the data layer.
type Db = any;

// Row → settings; shared by the cached read and the gate's fresh read inside its lock.
function settingsFromRow(r: any): AiSettings {
  if (!r) return DEFAULT_AI_SETTINGS;
  return {
    mode: r.mode as AiMode, kvkkAckAt: r.kvkk_ack_at ? new Date(r.kvkk_ack_at).toISOString() : null,
    dailyBudgetUsd: r.daily_budget_usd === null ? null : Number(r.daily_budget_usd), userDailyCalls: Number(r.user_daily_calls),
    detectors: r.detectors ?? {}, features: r.features ?? {},
    profitFloorPercent: r.profit_floor_percent === undefined || r.profit_floor_percent === null ? 15 : Number(r.profit_floor_percent),
  };
}

async function readSettings(db: Db, tenantId: string): Promise<AiSettings> {
  if (!(await tableExists('ai_settings'))) return LEGACY_AI_SETTINGS;
  const [r] = await db`SELECT * FROM ai_settings WHERE tenant_id = ${tenantId}`;
  return settingsFromRow(r);
}

export async function getAiSettings(tenantId: string): Promise<AiSettings> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await readSettings(sql, tenantId);
  cache.set(tenantId, { at: Date.now(), value });
  return value;
}

export const forgetAiSettings = (tenantId: string) => cache.delete(tenantId);

/** Is a feature on (morning summary, price hint, voice …)? On unless the firm turned it off. */
export const featureOn = (s: AiSettings, feature: string) => s.features[feature] !== false;

type Usage = { spentTodayUsd: number; userCallsToday: number; reservedUsd: number; reservedUserCalls: number };
const NO_USAGE: Usage = { spentTodayUsd: 0, userCallsToday: 0, reservedUsd: 0, reservedUserCalls: 0 };

/**
 * Today's spend and the person's calls (finished ai_usage rows, Istanbul day) plus the calls still
 * running (live reservations). Without migration 081 the reservation part is zero.
 */
async function readUsage(db: Db, tenantId: string, userId: string | null, withReservations: boolean): Promise<Usage> {
  const [r] = await db`SELECT coalesce(sum(coalesce(cost_usd,(to_jsonb(ai_usage)->>'tool_cost_usd')::numeric)), 0) AS spent, count(*) FILTER (WHERE user_id = ${userId})::int AS mine
    FROM ai_usage WHERE tenant_id = ${tenantId} AND created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`;
  let reservedUsd = 0;
  let reservedUserCalls = 0;
  if (withReservations) {
    const [q] = await db`SELECT coalesce(sum(estimated_cost_usd), 0) AS reserved, count(*) FILTER (WHERE user_id = ${userId})::int AS mine
      FROM ai_call_reservations WHERE tenant_id = ${tenantId} AND expires_at > now()`;
    reservedUsd = Number(q?.reserved ?? 0);
    reservedUserCalls = userId ? Number(q?.mine ?? 0) : 0;
  }
  return { spentTodayUsd: Number(r?.spent ?? 0), userCallsToday: userId ? Number(r?.mine ?? 0) : 0, reservedUsd, reservedUserCalls };
}

function decide(s: AiSettings, userId: string | null | undefined, usage: Usage, estimateUsd = 0) {
  const d = modelDecision({ mode: s.mode, kvkkAck: Boolean(s.kvkkAckAt), dailyBudgetUsd: s.dailyBudgetUsd, userDailyCalls: userId ? s.userDailyCalls : Number.MAX_SAFE_INTEGER, ...usage, estimateUsd });
  if (!d.ok) throw new ModelBlockedError(d.block);
}

/**
 * A check without a reservation (screens that offer a model call, pre-checks before a claim).
 * Throws ModelBlockedError when the firm's mode, its daily budget or the person's daily calls do
 * not allow a model call; calls still in flight count. Calls without a firm (evals, scripts) are
 * not gated. The model call itself goes through reserveModelCall (withUsage does that).
 */
export async function assertModelAllowed(meta: { tenantId?: string | null; userId?: string | null }) {
  if (!meta.tenantId) return;
  const s = await getAiSettings(meta.tenantId);
  const usage = s.mode === 'assist' && (await tableExists('ai_usage'))
    ? await readUsage(sql, meta.tenantId, meta.userId ?? null, await tableExists('ai_call_reservations'))
    : NO_USAGE;
  decide(s, meta.userId, usage);
}

/** A reservation stops counting after this long, even if its process died without releasing it. */
export const RESERVATION_LEASE_MINUTES = 6;

export type ModelReservation = { id: string; tenantId: string } | null;

let reservationsMissingLogged = false;

/**
 * The atomic gate before a model call (audit S-06). In one short transaction, under a per-firm
 * advisory lock: fresh settings (not the 15 s cache), today's spend and calls plus live
 * reservations, the decision including this call's maximum cost, and a reservation row for it.
 * Concurrent requests therefore see each other: with one call left exactly one passes.
 * Release it with releaseModelReservation once the real usage is recorded (withUsage does).
 *
 * Before migration 081 (no ai_call_reservations) it falls back to the old, non-atomic check and
 * returns null.
 */
export async function reserveModelCall(
  meta: { tenantId?: string | null; userId?: string | null; feature?: string },
  call: { model?: string; estimateUsd: number },
): Promise<ModelReservation> {
  if (!meta.tenantId) return null;
  const tenantId = meta.tenantId;
  if (!(await tableExists('ai_usage')) || !(await tableExists('ai_call_reservations'))) {
    if (!reservationsMissingLogged) console.warn('[AI gate] ai_call_reservations tablosu yok (081 uygulanmamış); bütçe ve çağrı sınırı atomik değil.');
    reservationsMissingLogged = true;
    await assertModelAllowed(meta);
    return null;
  }
  const userId = meta.userId ?? null;
  const estimateUsd = Number.isFinite(call.estimateUsd) && call.estimateUsd > 0 ? Number(call.estimateUsd.toFixed(6)) : 0;
  return withTransaction(async (tx: Db): Promise<ModelReservation> => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'ai_gate:' + tenantId}, 0))`;
    const s = await readSettings(tx, tenantId);
    cache.set(tenantId, { at: Date.now(), value: s });
    if (s.mode !== 'assist') decide(s, userId, NO_USAGE);
    decide(s, userId, await readUsage(tx, tenantId, userId, true), estimateUsd);
    // Housekeeping: long-expired leases of this firm.
    await tx`DELETE FROM ai_call_reservations WHERE tenant_id = ${tenantId} AND expires_at < now() - interval '1 hour'`;
    const [row] = await tx`INSERT INTO ai_call_reservations (tenant_id, user_id, feature, model, estimated_cost_usd, expires_at)
      VALUES (${tenantId}, ${userId}, ${meta.feature ?? null}, ${call.model ?? null}, ${estimateUsd}, now() + make_interval(mins => ${RESERVATION_LEASE_MINUTES}))
      RETURNING id`;
    return { id: String(row.id), tenantId };
  });
}

/**
 * Ends a reservation once the call's real usage is in ai_usage (or the call failed). Best effort:
 * a reservation that cannot be deleted stops counting when its lease expires.
 */
export async function releaseModelReservation(reservation: ModelReservation) {
  if (!reservation) return;
  try {
    await sql`DELETE FROM ai_call_reservations WHERE tenant_id = ${reservation.tenantId} AND id = ${reservation.id}`;
  } catch (error) {
    console.error('[AI gate] Rezervasyon kapatılamadı:', error instanceof Error ? error.message : error);
  }
}

/** May this firm call a model at all right now (key set, mode assist)? For screens that offer it. */
export async function modelEnabledFor(tenantId: string, keyAvailable: boolean) {
  const s = await getAiSettings(tenantId);
  return keyAvailable && s.mode === 'assist' && Boolean(s.kvkkAckAt);
}
