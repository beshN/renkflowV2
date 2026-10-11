import 'server-only';

import { z } from 'zod';
import { withTransaction } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { tableExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { AI_MODES } from './policy';
import { forgetAiSettings, getAiSettings, type AiSettings } from './gate.server';

export { featureOn, getAiSettings, modelEnabledFor, type AiSettings } from './gate.server';

const DetectorPatch = z.object({ enabled: z.boolean().optional(), quietDays: z.number().int().min(0).max(365).optional(), threshold: z.number().min(0).max(1_000_000).nullable().optional() }).strict();
const SettingsInput = z.object({
  mode: z.enum(AI_MODES).optional(),
  /** Required to switch the model on: the firm confirms the cross-border transfer (KVKK). */
  kvkkAck: z.boolean().optional(),
  dailyBudgetUsd: z.number().min(0).max(100_000).nullable().optional(),
  userDailyCalls: z.number().int().min(0).max(5000).optional(),
  detectors: z.record(z.string().max(60), DetectorPatch).optional(),
  features: z.record(z.string().max(60), z.boolean()).optional(),
}).strict();

/** Owner and admins change the assistant; every change is on the audit trail. */
export async function saveAiSettings(actor: { tenantId: string; userId: string; role: string }, raw: unknown) {
  if (actor.role !== 'owner' && actor.role !== 'admin') throw new WorkOrderApiError('Asistan ayarlarını yalnız firma sahibi ve yöneticiler değiştirir', 403);
  if (!(await tableExists('ai_settings'))) throw new WorkOrderApiError('Asistan ayarları için veritabanı güncellemesi (048) bekleniyor', 409);
  const d = SettingsInput.parse(raw);
  const before = await getAiSettings(actor.tenantId);
  if (d.mode === 'assist' && before.mode !== 'assist' && !d.kvkkAck && !before.kvkkAckAt)
    throw new WorkOrderApiError('Model çağrısı yurt dışına veri aktarımıdır: açmadan önce KVKK onayını işaretleyin', 400);
  const detectors = { ...before.detectors };
  for (const [k, v] of Object.entries(d.detectors ?? {})) detectors[k] = { ...detectors[k], ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) } as AiSettings['detectors'][string];
  const next: AiSettings = {
    mode: d.mode ?? before.mode,
    kvkkAckAt: before.kvkkAckAt,
    dailyBudgetUsd: d.dailyBudgetUsd === undefined ? before.dailyBudgetUsd : d.dailyBudgetUsd,
    userDailyCalls: d.userDailyCalls ?? before.userDailyCalls,
    detectors,
    features: { ...before.features, ...(d.features ?? {}) },
  };
  await withTransaction(async (tx: any) => {
    await tx`INSERT INTO ai_settings (tenant_id, mode, daily_budget_usd, user_daily_calls, detectors, features, updated_by, updated_at)
      VALUES (${actor.tenantId}, ${next.mode}, ${next.dailyBudgetUsd}, ${next.userDailyCalls}, ${JSON.stringify(next.detectors)}::text::jsonb, ${JSON.stringify(next.features)}::text::jsonb, ${actor.userId}, now())
      ON CONFLICT (tenant_id) DO UPDATE SET mode = EXCLUDED.mode, daily_budget_usd = EXCLUDED.daily_budget_usd, user_daily_calls = EXCLUDED.user_daily_calls,
        detectors = EXCLUDED.detectors, features = EXCLUDED.features, updated_by = EXCLUDED.updated_by, updated_at = now()`;
    if (d.kvkkAck && d.mode === 'assist') await tx`UPDATE ai_settings SET kvkk_ack_by = ${actor.userId}, kvkk_ack_at = now() WHERE tenant_id = ${actor.tenantId}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'ai_settings_changed',
      changes: Object.fromEntries((['mode', 'dailyBudgetUsd', 'userDailyCalls'] as const).filter((k) => before[k] !== next[k]).map((k) => [k, { from: before[k], to: next[k] }])),
      metadata: { detectors: Object.keys(d.detectors ?? {}), features: Object.keys(d.features ?? {}), kvkkAck: Boolean(d.kvkkAck) } });
  });
  forgetAiSettings(actor.tenantId);
  return getAiSettings(actor.tenantId);
}

