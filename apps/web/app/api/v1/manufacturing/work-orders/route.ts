import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createProductionWorkOrder } from '@/lib/features/manufacturing/manufacturing.service';
import { CreateProductionWorkOrderInputSchema } from '@/lib/features/manufacturing/types';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'create');
    const parsed = CreateProductionWorkOrderInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: z.flattenError(parsed.error) }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: await createProductionWorkOrder(actor, parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Production work order error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
