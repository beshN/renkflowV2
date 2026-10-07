import { NextRequest, NextResponse } from 'next/server';
import { apiContextWithPermission } from '@/lib/features/auth/api-access';
import { listDelayWarnings } from '@/lib/features/orders/delay-warning';

export async function GET(request: NextRequest) {
  try {
    const { context, denied } = await apiContextWithPermission('reports.view');
    if (denied) return denied;

    const limitParam = request.nextUrl.searchParams.get('limit');
    const parsedLimit = Number(limitParam || '30');
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
      : 30;

    const data = await listDelayWarnings(context.tenantId, limit);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Delay warning analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
