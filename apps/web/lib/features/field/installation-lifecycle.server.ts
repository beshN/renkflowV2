import 'server-only';

import { recordAudit } from '@/lib/audit/audit-log';
import { tableExists } from '@/lib/db/schema-guard';
import type { WorkOrderActor } from '@/lib/features/work-orders/security';

/** Web and mobile status changes commit their audit with the business transaction. */
export async function recordInstallationChange(tx: any, actor: WorkOrderActor, id: string, from: string, to: string, changes?: Record<string, unknown>) {
  await recordAudit(tx, {
    tenantId: actor.tenantId, actorId: actor.userId, entityType: 'installation', entityId: id,
    action: from === to ? 'updated' : 'status_changed',
    changes: changes ?? { status: { from, to } },
  });
}

/** Post-commit failure must not report the completed command as failed; queue refresh retries it. */
export async function queueInstallationDelivery(tenantId: string, id: string, actorId: string | null, why: string) {
  try {
    if (!(await tableExists('ai_suggestions'))) return;
    const { fileDeliveredSuggestion } = await import('@/lib/ai/suggestions/kinds/mark-delivered');
    await fileDeliveredSuggestion(tenantId, id, actorId, why);
  } catch {
    console.error('[installations] Delivery suggestion deferred to queue refresh');
  }
}
