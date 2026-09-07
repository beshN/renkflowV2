import { NextResponse } from 'next/server';
import { releaseWorkOrderReservation } from '@/lib/features/manufacturing/reservation.service';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'transition');
    const { id } = await params;
    return NextResponse.json({ success: true, data: await releaseWorkOrderReservation(actor, id) });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Reservation release error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
