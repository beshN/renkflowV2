import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/security/rate-limit';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { publicSignoff, signDelivery } from '@/lib/features/field/installations.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ token: string }> };

/** The customer's delivery sign-off page data (no prices). Public: the token is the key. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const data = await publicSignoff((await params).token);
    if (!data) return NextResponse.json({ error: 'Bu bağlantı geçersiz ya da süresi dolmuş' }, { status: 404, headers: NO_STORE });
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'signoff');
  }
}

/** { name, accept: true, note? } — rate limited per address. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: 'JSON isteği gerekli' }, { status: 415 });
    const result = await signDelivery((await params).token, await req.json(), { ip: getClientIp(req.headers), agent: req.headers.get('user-agent') ?? '' });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'signoff');
  }
}
