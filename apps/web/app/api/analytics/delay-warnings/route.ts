import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listDelayWarnings } from '@/lib/features/orders/delay-warning';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limitParam = request.nextUrl.searchParams.get('limit');
    const parsedLimit = Number(limitParam || '30');
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
      : 30;

    const data = await listDelayWarnings(session.user.tenantId, limit);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Delay warning analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
