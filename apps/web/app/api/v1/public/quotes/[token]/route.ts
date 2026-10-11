import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/security/rate-limit';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { recordError } from '@/lib/features/records/http';
import { publicDecision, publicQuote } from '@/lib/features/sales/quotes.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ token: string }> };
const HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' };

/** The quote behind a customer approval link (its own lines and prices; never internal notes). */
export async function GET(_req: NextRequest, { params }: Params) {
  const data = await publicQuote((await params).token).catch(() => null);
  return NextResponse.json(data ? { data } : { error: 'Bağlantı geçersiz veya süresi dolmuş.' }, { status: data ? 200 : 404, headers: HEADERS });
}

/** The customer's decision: { decision: 'accept' | 'reject', name, note? }. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    // The approval page is ours: same origin, small JSON body.
    requireSameOriginJson(req, 4_000);
    const result = await publicDecision((await params).token, await req.json(), { ip: getClientIp(req.headers), agent: req.headers.get('user-agent') ?? '' });
    return NextResponse.json(result, { headers: HEADERS });
  } catch (e) {
    const res = recordError(e, 'public-quote');
    for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
    return res;
  }
}
