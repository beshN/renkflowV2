import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { saveSurvey } from '@/lib/features/field/leads.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ surveyId: string }> };

/** Save a survey's measures, time, place, person or status. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 40_000);
    const surveyId = z.string().uuid().parse((await params).surveyId);
    return redactedJson(await saveSurvey(await requireWorkOrderActor(), surveyId, await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'survey');
  }
}
