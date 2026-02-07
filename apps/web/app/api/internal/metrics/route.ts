import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getMetricsSnapshot } from '@/lib/utils/metrics';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    metrics: getMetricsSnapshot(),
    capturedAt: new Date().toISOString(),
  });
}
