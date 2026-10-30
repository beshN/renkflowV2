import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { savePushSubscription, removePushSubscription } from '@/lib/notifications/service';
import { crossOriginRejection } from '@/lib/features/manufacturing/http-security';

export async function POST(request: Request) {
  const crossOrigin = crossOriginRejection(request);
  if (crossOrigin) return crossOrigin;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await savePushSubscription(session.user.id, {
    userId: session.user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const crossOrigin = crossOriginRejection(request);
  if (crossOrigin) return crossOrigin;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.endpoint) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await removePushSubscription(body.endpoint, session.user.id);
  return NextResponse.json({ success: true });
}
