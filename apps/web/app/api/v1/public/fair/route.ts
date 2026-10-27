import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { recordError } from '@/lib/features/records/http';
import { createFairRequest } from '@/lib/features/fair/requests.server';
import { FAIR_MAX_ITEMS } from '@/lib/features/fair/schema';

export const dynamic = 'force-dynamic';
const HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' };

/** A fair visitor's configured products and contact details; the firm prices them later. */
export async function POST(req: NextRequest) {
  try {
    // The fair page is ours: same origin, JSON, a few small previews at most.
    requireSameOriginJson(req, FAIR_MAX_ITEMS * 310_000 + 20_000);
    const ip = getClientIp(req.headers);
    const limit = await consumeRateLimit('fairRequest', ip);
    if (!limit.allowed) return rateLimitResponse(limit);
    const body = await req.json();
    // A filled honeypot gets the same answer as a person, and nothing is stored.
    if (body && typeof body === 'object' && typeof body.website === 'string' && body.website.trim())
      return NextResponse.json({ reference: null }, { status: 201, headers: HEADERS });
    const result = await createFairRequest(body, { ip, agent: req.headers.get('user-agent') ?? '' });
    return NextResponse.json(result, { status: 201, headers: HEADERS });
  } catch (e) {
    const res = recordError(e, 'fair-request');
    for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
    return res;
  }
}
