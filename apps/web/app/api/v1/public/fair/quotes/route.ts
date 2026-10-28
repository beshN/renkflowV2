import { NextRequest } from 'next/server';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { readJsonLimited, requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { submitQuote } from '@/lib/features/fair/quotes.server';
import { publicError, publicJson } from '../http';

export const dynamic = 'force-dynamic';
/** Eight products with their preview images (≤ 300 kB each) fit well within this. */
const MAX_BODY = 3_000_000;

/** A quote request: contact details plus the design as it is now. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, MAX_BODY);
    const ip = getClientIp(req.headers);
    const limit = await consumeRateLimit('fairQuote', ip);
    if (!limit.allowed) return rateLimitResponse(limit);
    const body = (await readJsonLimited(req, MAX_BODY)) as { website?: unknown } | null;
    // A filled honeypot gets an answer that looks like success, and nothing is stored or sent.
    if (body && typeof body === 'object' && typeof body.website === 'string' && body.website.trim()) return publicJson({ number: null, emailStatus: 'not_configured' }, 201);
    return publicJson(await submitQuote(body, { ip, agent: req.headers.get('user-agent') ?? '' }), 201);
  } catch (e) {
    return publicError(e, 'fair-quote');
  }
}
