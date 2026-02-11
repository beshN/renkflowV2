import { NextResponse } from 'next/server';
import { getWorkOrderSummary } from '@/lib/features/work-orders/service';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';

export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');

    const summary = await getWorkOrderSummary(actor.tenantId);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Work order summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
