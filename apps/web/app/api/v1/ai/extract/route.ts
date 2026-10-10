import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { pdfText, quoteRequestPreview, supplierOfferPreview } from '@/lib/ai/extract/run.server';

export const dynamic = 'force-dynamic';

const Body = z.discriminatedUnion('type', [
  z.object({ type: z.literal('quote_request'), text: z.string() }),
  z.object({ type: z.literal('supplier_offer'), rfqId: z.string(), supplierId: z.string(), text: z.string().optional(), pdfBase64: z.string().max(6_000_000).optional() }),
]);

/** Pasted message / supplier PDF → a draft waiting for approval (preview only; nothing is written to records). */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 6_500_000);
    const actor = await requireWorkOrderActor();
    const limit = await consumeRateLimit('assistant', actor.tenantId + ':' + actor.userId);
    if (!limit.allowed) return redactedJson({ error: 'Kısa bir ara verip yeniden deneyin.' }, { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(limit) } });
    const body = Body.parse(await req.json());
    if (body.type === 'quote_request') return redactedJson(await quoteRequestPreview(actor, body), { headers: NO_STORE });
    const text = body.pdfBase64 ? await pdfText(body.pdfBase64) : body.text ?? '';
    return redactedJson(await supplierOfferPreview(actor, { ...body, text }), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-extract');
  }
}
