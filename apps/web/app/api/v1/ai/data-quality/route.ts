import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { recentQualityFixes, undoQualityFix } from '@/lib/ai/detectors/quality.server';

export const dynamic = 'force-dynamic';

/** Data fixes approved in the last 30 days (for "Geri al"). */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    if (!['owner', 'admin', 'office'].includes(actor.role)) throw new WorkOrderApiError('Bu işlem için yetkiniz yok', 403);
    return redactedJson({ fixes: await recentQualityFixes(actor) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-data-quality');
  }
}

/** Undo one approved fix (only values nobody changed since). */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2_000);
    const actor = await requireWorkOrderActor();
    const { suggestionId } = z.object({ suggestionId: z.string().uuid() }).parse(await req.json());
    return redactedJson(await undoQualityFix(actor, suggestionId), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-data-quality');
  }
}
