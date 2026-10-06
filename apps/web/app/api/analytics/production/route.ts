import { NextResponse } from 'next/server';
import { apiContextWithPermission } from '@/lib/features/auth/api-access';
import { getProductionMetrics } from '@/lib/analytics/reporting';

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export async function GET(request: Request) {
  const { context, denied } = await apiContextWithPermission('reports.view');
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const endDate = parseDate(searchParams.get('endDate'), new Date());
  const startDate = parseDate(
    searchParams.get('startDate'),
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
  );

  const data = await getProductionMetrics(context.tenantId, { startDate, endDate });
  return NextResponse.json({ success: true, data });
}
