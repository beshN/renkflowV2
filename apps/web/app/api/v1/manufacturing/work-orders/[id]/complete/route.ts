import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { readJsonBody } from '@/lib/security/request-body.server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { completeProductionRun } from '@/lib/features/manufacturing/manufacturing.service';
import { CompleteProductionRunInputSchema } from '@/lib/features/manufacturing/types';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginJson(request);
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'transition');
    const { id } = await params;
    const parsed = CompleteProductionRunInputSchema.safeParse({ ...z.record(z.string(), z.unknown()).parse(await readJsonBody(request)), workOrderId: id });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: z.flattenError(parsed.error) }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: await completeProductionRun(actor, parsed.data) });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Production completion error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
