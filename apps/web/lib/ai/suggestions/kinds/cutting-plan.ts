import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { cuttingEstimateNotice } from '@/lib/features/manufacturing/cutting-defaults';
import { planAndReserveCut, proposeCutForPool } from '@/lib/features/manufacturing/platform.service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { registerSuggestionKind, type SuggestionActor } from '../kinds';

export const CUTTING_PLAN_KIND = 'production.cutting_plan';

const PayloadSchema = z.object({
  workOrderIds: z.array(z.string().uuid()).min(1).max(100),
  lotIds: z.array(z.string().uuid()).min(1),
  parameterSource: z.enum(['confirmed', 'default', 'unconfirmed']),
  /** The plan the card described; approval refuses when today's plan differs in any way. */
  fingerprint: z.string().length(40),
});
type Payload = z.infer<typeof PayloadSchema>;

type PlanLike = {
  parameters: { kerfMm: number; trimStartMm: number; trimEndMm: number; minimumRemnantMm: number; standardLengthMm?: number };
  parameterSource: string;
  bars: Array<{ source: { id: string; lengthMm: number }; pieces: Array<{ lengthMm: number; workOrderId: string }> }>;
};

/** Jobs, values and the whole layout (bar, its length, every cut): any change gives a new print. */
export function cutFingerprint(workOrderIds: string[], plan: PlanLike) {
  const layout = plan.bars.map((bar) => [bar.source.id, bar.source.lengthMm, bar.pieces.map((p) => [p.lengthMm, p.workOrderId])]);
  // Fixed order: a plan read back from jsonb has its object keys reordered.
  const p = plan.parameters;
  const values = [p.kerfMm, p.trimStartMm, p.trimEndMm, p.minimumRemnantMm, p.standardLengthMm ?? null];
  return createHash('sha256')
    .update(JSON.stringify([[...workOrderIds].sort(), values, plan.parameterSource, layout]))
    .digest('hex')
    .slice(0, 40);
}

const mmText = (n: number) => Math.round(n).toLocaleString('tr-TR');
const percent = (n: number) => '%' + n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * The cutting suggestion: every job waiting for cutting, planned together by the deterministic
 * engine. No model is involved: the order was already read at intake, the recipe gave the cuts and
 * the engine does the arithmetic. No customer names or prices are in the suggestion.
 */
export async function refreshCuttingSuggestion(actor: SuggestionActor) {
  const { fileSuggestion, expireOtherPending } = await import('../service');
  const proposal = await proposeCutForPool(sql, actor);
  // Nothing waiting, or stock covers none of it (the purchase need is shown on the plan itself).
  if (!proposal || !proposal.jobs.length || proposal.result.unfulfilled.length || proposal.result.stockProblems?.length) {
    await expireOtherPending(sql, actor.tenantId, CUTTING_PLAN_KIND, null);
    return;
  }
  const { result, jobs, leftOut, morePending } = proposal;
  const workOrderIds = jobs.map((j) => j.id);
  const fingerprint = cutFingerprint(workOrderIds, result);
  await expireOtherPending(sql, actor.tenantId, CUTTING_PLAN_KIND, fingerprint);
  const remnants = result.bars.filter((bar) => bar.source.isRemnant).length;
  const notice = cuttingEstimateNotice(result.parameterSource);
  const p = result.parameters;
  await fileSuggestion(
    sql,
    actor.tenantId,
    null,
    {
      kind: CUTTING_PLAN_KIND,
      title: `${jobs.length === 1 ? '1 iş emrini kes' : `${jobs.length} iş emrini birlikte kes`}: ${result.bars.length} çubuk, ${(result.wastePercent == null ? 'hesaplanamadı' : percent(result.wastePercent))} fire`,
      rationale: [
        `Kesim bekleyen ${jobs.length} iş emri kesim motoruyla ${jobs.length === 1 ? '' : 'birlikte '}hesaplandı (${result.alternatives.length} yerleşim karşılaştırıldı).`,
        `${result.bars.length} çubuk kullanılır: ${result.newBars} yeni çubuk${remnants ? `, ${remnants} artık` : ''}. Fire ${mmText(result.wasteMm)} mm (${(result.wastePercent == null ? 'hesaplanamadı' : percent(result.wastePercent))}), ${mmText(result.reusableMm)} mm kullanılabilir artık kalır.`,
        `Değerler: testere payı ${p.kerfMm} mm, tıraş ${p.trimStartMm}/${p.trimEndMm} mm, en kısa artık ${p.minimumRemnantMm} mm.`,
        ...(leftOut.length ? [`${leftOut.length} iş emri için stokta yeterli profil yok; bu öneriye alınmadı (Toplu kesim'de satın alma ihtiyacı görünür).`] : []),
        ...(morePending ? ['Kesim bekleyen 100\'den fazla iş var; en eski 100 iş hesaba katıldı.'] : []),
        'Onaylarsanız plan kaydedilir ve bu çubuklar bu işler için ayrılır. Kalıcı stok düşümü ve artık girişi ölçülen kesimle yapılır.',
      ].join('\n'),
      payload: { workOrderIds, lotIds: result.bars.map((bar) => bar.source.id).sort(), parameterSource: result.parameterSource, fingerprint },
      affected: jobs.slice(0, 50).map((job) => ({ entityType: 'work_order', entityId: job.id, label: job.title.slice(0, 200), href: `/work-orders/${job.id}` })),
      uncertain: Boolean(notice),
      uncertaintyNote: notice,
      source: 'system',
      dedupeKey: fingerprint,
    },
    { notAgainAfterRejection: true },
  );
}

registerSuggestionKind<Payload>({
  kind: CUTTING_PLAN_KIND,
  label: 'Kesim planı',
  payloadSchema: PayloadSchema,
  // The same roles that may approve a cutting plan by hand.
  roles: ['owner', 'admin'],
  refresh: refreshCuttingSuggestion,
  apply: async (tx, actor, payload, suggestion) => {
    const plan = await planAndReserveCut(tx, actor, payload.workOrderIds, {
      key: `ai-suggestion:${suggestion.id}`,
      // Only the estimate the card showed ("Emin değilim") is accepted by approving it.
      acceptEstimate: Boolean(cuttingEstimateNotice(payload.parameterSource)),
      suggestionId: suggestion.id,
      // Anything changed since the card was made (stock, lengths, values, layout): refuse before
      // anything is reserved rather than approve a different plan; the transaction rolls back.
      verify: (draft) => {
        if (cutFingerprint(payload.workOrderIds, draft.result) !== payload.fingerprint)
          throw new WorkOrderApiError('Stok, değerler veya kesim havuzu değişti; öneri yenilenecek. Listeyi yenileyin.', 409);
      },
    });
    return { planId: plan.id, status: plan.status, bars: plan.result.bars.length, href: `/production?tab=cutting&cut=${plan.id}` };
  },
});
