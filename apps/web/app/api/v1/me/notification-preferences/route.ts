import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationType } from '@/lib/notifications/service';
import { PREFERENCE_CHANNELS, PREFERENCE_EVENTS, channelStatus, normalizePreferences } from '@/lib/notifications/preferences';

export const dynamic = 'force-dynamic';

const status = () => channelStatus({ pushConfigured: Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) });

/** Your notification preferences: event × channel, and which channels deliver today. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    const prefs = await getNotificationPreferences(actor.userId);
    return NextResponse.json({ events: PREFERENCE_EVENTS, channels: PREFERENCE_CHANNELS, status: status(), preferences: normalizePreferences(prefs) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'notification-preferences');
  }
}

const Row = z.record(z.string(), z.boolean());
const Body = z.object({ inApp: Row, email: Row, push: Row }).strict();

/** Save the whole matrix (only known events are kept). */
export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 10_000);
    const actor = await requireWorkOrderActor();
    const p = normalizePreferences(Body.parse(await req.json()));
    type Prefs = Record<NotificationType, boolean>;
    await updateNotificationPreferences(actor.userId, { inApp: p.inApp as Prefs, email: p.email as Prefs, push: p.push as Prefs });
    return NextResponse.json({ preferences: p }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'notification-preferences');
  }
}
