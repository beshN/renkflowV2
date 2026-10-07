import { NextResponse } from 'next/server';
import { apiContextWithPermission } from '@/lib/features/auth/api-access';
import { getDashboardSummary } from '@/lib/analytics/reporting';

export async function GET() {
  const { context, denied } = await apiContextWithPermission('reports.view');
  if (denied) return denied;

  const data = await getDashboardSummary(context.tenantId);
  return NextResponse.json({ success: true, data });
}
