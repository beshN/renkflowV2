import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiAvailable } from '@/lib/ai/service';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { extractIntake, requireIntakeAccess } from '@/lib/features/manufacturing/intake.service';
import { readJsonBody } from '@/lib/security/request-body.server';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { recordError, NO_STORE } from '@/lib/features/records/http';

const Body = z.object({
  name: z.string().min(1).max(180).default('siparis.pdf'),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  base64: z.string().max(14_000_000).optional(),
  documentBase64: z.string().max(14_000_000).optional(),
  blobPath: z.string().max(700).optional(),
});

export async function GET() {
  try {
    requireIntakeAccess(await requireWorkOrderActor());
    return NextResponse.json({ available: aiAvailable() }, { headers: NO_STORE });
  } catch (error) {
    return recordError(error, 'document-capability');
  }
}

/** Both document entry points share the multi-line, evidence-preserving review workflow. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 15_000_000);
    const actor = await requireWorkOrderActor();
    requireIntakeAccess(actor);
    const limit = await consumeRateLimit('assistant', `${actor.tenantId}:${actor.userId}`);
    if (!limit.allowed) return NextResponse.json({ error: 'Kısa bir ara verip yeniden deneyin.' }, { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(limit) } });
    if (!aiAvailable()) throw new WorkOrderApiError('Belge analizi şu anda kapalı. Sipariş bilgilerini elle girebilirsiniz.', 503);
    const body = Body.parse(await readJsonBody(req, 15_000_000));
    const draft = await extractIntake(actor, { name: body.name, mime: body.mimeType, base64: body.base64 || body.documentBase64, blobPath: body.blobPath });
    return NextResponse.json({ success: true, draftId: draft.id, reviewUrl: `/production/intake/${draft.id}` }, { headers: NO_STORE });
  } catch (error) {
    return recordError(error, 'document-extract');
  }
}

export const maxDuration = 300;
