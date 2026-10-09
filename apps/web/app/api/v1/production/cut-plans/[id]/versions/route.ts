import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { cutPlanVersions } from '@/lib/features/production/depth.server';

export const dynamic = 'force-dynamic';

/** Every plan made for the same jobs, with waste and its change from the plan before. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return redactedJson({ versions: await cutPlanVersions(await requireWorkOrderActor(), (await params).id) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'cut-plan-versions');
  }
}
