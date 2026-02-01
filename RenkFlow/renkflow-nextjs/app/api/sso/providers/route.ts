import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSSOProviders, createSSOProvider } from '@/lib/auth/sso';

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providers = await getSSOProviders(session.user.tenantId);
  return NextResponse.json({ success: true, providers });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId || session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const provider = await createSSOProvider({
    ...body,
    tenantId: session.user.tenantId,
  });

  return NextResponse.json({ success: true, provider });
}
