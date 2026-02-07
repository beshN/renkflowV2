import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDashboardSummary } from '@/lib/analytics/reporting';

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getDashboardSummary(session.user.tenantId);
  return NextResponse.json({ success: true, data });
}
