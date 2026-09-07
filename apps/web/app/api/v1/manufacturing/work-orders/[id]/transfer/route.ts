import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transferWorkOrderMaterials } from '@/lib/features/manufacturing/manufacturing.service';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';

const BodySchema = z.object({ idempotencyKey: z.string().trim().min(8).max(160) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'transition');
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const { id } = await params;
    return NextResponse.json({ success: true, data: await transferWorkOrderMaterials(actor, id, parsed.data.idempotencyKey) });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('WIP transfer error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
