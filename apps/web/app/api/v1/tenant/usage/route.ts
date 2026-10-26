import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAiSettings } from '@/lib/ai/gate.server';
import { collectTenantUsage } from '@/lib/features/account/usage.server';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';

export const dynamic = 'force-dynamic';

/** Plan and this month's usage of the signed-in member's firm. Owner/admin only, read-only. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    if (actor.role !== 'owner' && actor.role !== 'admin') throw new WorkOrderApiError('Bu bilgiyi firma sahibi ve yöneticiler görebilir', 403);
    const dailyBudgetUsd = await getAiSettings(actor.tenantId).then((s) => s.dailyBudgetUsd, () => null);
    const usage = await collectTenantUsage(sql, actor.tenantId, { dailyBudgetUsd });
    return NextResponse.json({ usage, isOwner: actor.role === 'owner' }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'tenant-usage');
  }
}
