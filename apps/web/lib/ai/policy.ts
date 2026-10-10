/**
 * Whether a model call may run (pure): the firm's assistant mode, its daily spend cap and the
 * person's daily call cap. Rules-only and off never reach a model; the assistant still works on
 * its detectors and deterministic parsers.
 */

export const AI_MODES = ['off', 'rules', 'assist'] as const;
export type AiMode = (typeof AI_MODES)[number];
export const AI_MODE_LABELS: Record<AiMode, string> = {
  off: 'Kapalı',
  rules: 'Yalnız kural motoru',
  assist: 'Kural motoru + model',
};

export type ModelBlock = 'AI_OFF' | 'AI_RULES_ONLY' | 'AI_KVKK' | 'AI_BUDGET' | 'AI_USER_LIMIT';
export const MODEL_BLOCK_MESSAGES: Record<ModelBlock, string> = {
  AI_OFF: 'Asistan bu firmada kapalı (Ayarlar › Asistan).',
  AI_RULES_ONLY: 'Asistan yalnız kural motoruyla çalışıyor; model çağrısı kapalı (Ayarlar › Asistan).',
  AI_KVKK: 'Model çağrısı yurt dışına veri aktarımıdır; firma sahibi KVKK onayını Ayarlar › Asistan bölümünden vermeden model kullanılmaz.',
  AI_BUDGET: 'Asistanın bugünkü model bütçesi doldu; kural motoru çalışmaya devam ediyor.',
  AI_USER_LIMIT: 'Bugünkü asistan kullanım sınırınıza ulaştınız; yarın yeniden açılır.',
};

export function modelDecision(s: { mode: AiMode; kvkkAck: boolean; dailyBudgetUsd: number | null; userDailyCalls: number; spentTodayUsd: number; userCallsToday: number }): { ok: true } | { ok: false; block: ModelBlock } {
  if (s.mode === 'off') return { ok: false, block: 'AI_OFF' };
  if (s.mode === 'rules') return { ok: false, block: 'AI_RULES_ONLY' };
  if (!s.kvkkAck) return { ok: false, block: 'AI_KVKK' };
  if (s.dailyBudgetUsd !== null && s.spentTodayUsd >= s.dailyBudgetUsd) return { ok: false, block: 'AI_BUDGET' };
  if (s.userCallsToday >= s.userDailyCalls) return { ok: false, block: 'AI_USER_LIMIT' };
  return { ok: true };
}

/** A refused model call: the caller falls back to rules or tells the person why. */
export class ModelBlockedError extends Error {
  constructor(readonly block: ModelBlock) {
    super(MODEL_BLOCK_MESSAGES[block]);
    this.name = 'ModelBlockedError';
  }
}
