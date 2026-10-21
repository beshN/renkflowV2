import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addWorkOrderComment,
  listWorkOrderComments,
  WorkOrderCommentInputSchema,
  getWorkOrderDetails,
} from '@/lib/features/work-orders/service';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';

const ParamsSchema = z.object({
  workOrderId: z.string().uuid(),
});

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

    if (actor.role === 'worker') {
      const workOrder = await getWorkOrderDetails(actor.tenantId, parsedParams.data.workOrderId);
      if (workOrder.assignedTo !== actor.userId) throw new WorkOrderApiError('İş emri bulunamadı', 404);
    }
    const comments = await listWorkOrderComments(actor.tenantId, parsedParams.data.workOrderId);
    return NextResponse.json({ success: true, data: comments });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Work order comments list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workOrderId: string }> }
) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'comment');

    const params = await context.params;
    const parsedParams = ParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid work order id' }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = WorkOrderCommentInputSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: z.flattenError(parsedBody.error) },
        { status: 400 }
      );
    }

    const comment = await addWorkOrderComment(
      actor,
      parsedParams.data.workOrderId,
      parsedBody.data.body
    );
    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Work order comment create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
