import { NextRequest, NextResponse } from 'next/server';
import { getAPIUser } from '@/lib/api/auth-helpers';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { traceLots } from '@/lib/features/manufacturing/lot-trace.server';
import { NO_STORE, recordError } from '@/lib/features/records/http';

export async function GET(request: NextRequest) {
  try {
    const user = await getAPIUser(request);
    if (!user?.tenantId) throw new WorkOrderApiError('Unauthorized', 401);
    const result = await traceLots({ userId: user.id, tenantId: user.tenantId,
      role: user.role as WorkOrderActor['role'] }, {
      heat: request.nextUrl.searchParams.get('heat'),
      supplierLot: request.nextUrl.searchParams.get('supplierLot'),
    });
    return NextResponse.json({ data: result }, { headers: NO_STORE });
  } catch (error) {
    return recordError(error, 'lot-trace');
  }
}
