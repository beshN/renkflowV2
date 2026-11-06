import { reportServerError } from '@/lib/observability/report-server-error';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    await reportServerError("app/api/notifications/vapid-key/route:GET", undefined);
    return NextResponse.json({ error: 'VAPID public key not configured' }, { status: 500 });
  }

  return NextResponse.json({ publicKey });
}
