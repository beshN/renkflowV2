import 'server-only';

import { sql } from '@/lib/db';
import { columnExists, tableExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { suggestionKinds } from '@/lib/ai/suggestions/kinds';
import '@/lib/ai/suggestions/registry';
import { performance } from './performance';

/** The last N days of suggestions and model usage for the panel (owner/admin). */
export async function assistantPerformance(actor: WorkOrderActor, days = 90) {
  if (actor.role !== 'owner' && actor.role !== 'admin') throw new WorkOrderApiError('Bulunamadı', 404);
  if (!(await tableExists('ai_suggestions'))) return { days, available: false as const };
  const reason = await columnExists('ai_suggestions', 'reject_reason');
  const rows = await sql`SELECT kind, status, edited, created_at, decided_at, ${reason ? sql`reject_reason` : sql`NULL::text AS reject_reason`}
    FROM ai_suggestions WHERE tenant_id = ${actor.tenantId} AND created_at >= now() - make_interval(days => ${days})`;
  const usage = (await tableExists('ai_usage'))
    ? await sql`SELECT feature, count(*)::int AS calls, count(*) FILTER (WHERE status = 'error')::int AS errors,
        coalesce(sum(input_tokens), 0)::int AS input_tokens, coalesce(sum(output_tokens), 0)::int AS output_tokens,
        CASE WHEN count(cost_usd) = 0 THEN NULL ELSE sum(cost_usd) END AS cost
      FROM ai_usage WHERE tenant_id = ${actor.tenantId} AND created_at >= now() - make_interval(days => ${days}) GROUP BY feature`
    : [];
  const labels = Object.fromEntries(suggestionKinds().map((k) => [k.kind, k.label]));
  return {
    days, available: true as const,
    ...performance(
      rows.map((r: any) => ({ kind: r.kind, status: r.status, rejectReason: r.reject_reason ?? null, edited: Boolean(r.edited), createdAt: new Date(r.created_at).toISOString(), decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null })),
      usage.map((u: any) => ({ feature: u.feature, calls: u.calls, errors: u.errors, inputTokens: u.input_tokens, outputTokens: u.output_tokens, costUsd: u.cost === null ? null : Number(u.cost) })),
      labels,
    ),
  };
}
