import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCustomerMetrics } from '@/lib/analytics/reporting';

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const endDate = parseDate(searchParams.get('endDate'), new Date());
  const startDate = parseDate(
    searchParams.get('startDate'),
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
  );

  const data = await getCustomerMetrics(session.user.tenantId, { startDate, endDate });
  return NextResponse.json({ success: true, data });
}
