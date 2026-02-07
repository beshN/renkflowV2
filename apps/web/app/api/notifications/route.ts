import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserNotifications, markAllNotificationsAsRead } from '@/lib/notifications/service';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === 'true';
  const limit = Number(searchParams.get('limit') || 20);
  const offset = Number(searchParams.get('offset') || 0);

  const data = await getUserNotifications(session.user.id, {
    unreadOnly,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, ...data });
}

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await markAllNotificationsAsRead(session.user.id);
  return NextResponse.json({ success: true });
}
