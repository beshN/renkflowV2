import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription, removePushSubscription } from '@/lib/notifications/service';
import { PushSubscriptionSchema } from '@/lib/notifications/push-validation';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { readJsonBody } from '@/lib/security/request-body.server';
import { recordError, NO_STORE } from '@/lib/features/records/http';

export async function POST(request: NextRequest) {
  try {
    requireSameOriginJson(request, 8_000);
    const actor = await requireWorkOrderActor();
    const body = PushSubscriptionSchema.parse(await readJsonBody(request, 8_000));
    await savePushSubscription(actor.userId, { userId: actor.userId, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth });
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) { return recordError(error, 'push-subscribe'); }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOriginJson(request, 8_000);
    const actor = await requireWorkOrderActor();
    const { endpoint } = PushSubscriptionSchema.pick({ endpoint: true }).parse(await readJsonBody(request, 8_000));
    // No record existence/owner is disclosed; removing your own missing endpoint is idempotent.
    await removePushSubscription(endpoint, actor.userId);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) { return recordError(error, 'push-unsubscribe'); }
}
