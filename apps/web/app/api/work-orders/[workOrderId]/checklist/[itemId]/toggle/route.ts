import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  toggleWorkOrderChecklistItem,
  ToggleChecklistInputSchema,
} from '@/lib/features/work-orders/service';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';

const ParamsSchema = z.object({
  workOrderId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workOrderId: string; itemId: string }> }
) {
  try {
    requireSameOrigin(request);
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'checklist');

    const params = await context.params;
    const parsedParams = ParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid route params' }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = ToggleChecklistInputSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: z.flattenError(parsedBody.error) },
        { status: 400 }
      );
    }

    const result = await toggleWorkOrderChecklistItem(
      actor,
      parsedParams.data.workOrderId,
      parsedParams.data.itemId,
      parsedBody.data.completed
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Work order checklist toggle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
