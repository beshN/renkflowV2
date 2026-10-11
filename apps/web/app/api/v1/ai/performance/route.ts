import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { assistantPerformance } from '@/lib/ai/performance.server';

export const dynamic = 'force-dynamic';

/** The assistant's performance panel (owner/admin): ?days=30|90|365. */
export async function GET(req: NextRequest) {
  try {
    const days = Math.min(365, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 90));
    return redactedJson(await assistantPerformance(await requireWorkOrderActor(), days), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-performance');
  }
}
