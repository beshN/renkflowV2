import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getWorkOrderDetails,
  updateWorkOrder,
  UpdateWorkOrderInputSchema,
} from '@/lib/features/work-orders/service';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';
import { isWorkOrderTerminalStatus, WORK_ORDER_STATUSES } from '@/lib/features/work-orders/status';

const ParamsSchema = z.object({
  workOrderId: z.string().uuid(),
});

const mutableFields = new Set([
  'title',
  'description',
  'category',
  'priority',
  'dueAt',
  'location',
  'assetTag',
  'estimatedMinutes',
  'actualMinutes',
  'blockedReasonCategory',
  'blockedReasonDetail',
]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workOrderId: string }> }
) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');

    const params = await context.params;
    const parsedParams = ParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid work order id' }, { status: 400 });
    }

    const data = await getWorkOrderDetails(actor.tenantId, parsedParams.data.workOrderId);
    if (actor.role === 'worker' && data.assignedTo !== actor.userId) throw new WorkOrderApiError('İş emri bulunamadı', 404);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Work order detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workOrderId: string }> }
) {
  try {
    requireSameOrigin(request);
    const actor = await requireWorkOrderActor();

    const params = await context.params;
    const parsedParams = ParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid work order id' }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = UpdateWorkOrderInputSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: z.flattenError(parsedBody.error) },
        { status: 400 }
      );
    }

    const keys = Object.keys(parsedBody.data);

    if (keys.some((key) => mutableFields.has(key))) {
      requireWorkOrderPermission(actor, 'edit');
    }

    if (keys.includes('assignedToUserId')) {
      requireWorkOrderPermission(actor, 'assign');
    }
    if (keys.includes('boardPlacement')) requireWorkOrderPermission(actor, 'transition');
    if (keys.includes('appendChecklistItems')) requireWorkOrderPermission(actor, 'edit');

    const rawStatus = (parsedBody.data as Record<string, unknown>).status;
    if (typeof rawStatus === 'string' && (WORK_ORDER_STATUSES as readonly string[]).includes(rawStatus)) {
      requireWorkOrderPermission(actor, 'transition');
      if (isWorkOrderTerminalStatus(rawStatus as any)) {
        requireWorkOrderPermission(actor, 'close');
      }
    }

    const data = await updateWorkOrder(actor, parsedParams.data.workOrderId, parsedBody.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Work order update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
