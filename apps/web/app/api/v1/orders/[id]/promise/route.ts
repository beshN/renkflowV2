import { NextRequest } from 'next/server';
import { redactedSuccess } from '@/lib/security/field-access.server';
import { getAPIUser, errorResponse } from '@/lib/api/auth-helpers';
import { orderIdSchema } from '@/lib/validations/order.schema';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { orderPromise } from '@/lib/features/manufacturing/promise-order.server';
import { reportServerError } from '@/lib/observability/report-server-error';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAPIUser(request);
    if (!user?.tenantId) return errorResponse('Yetkilendirme gereklidir', 401);
    if (user.role === 'worker') return errorResponse('Sipariş bulunamadı', 404);
    const { id } = await params;
    if (!orderIdSchema.safeParse(id).success) return errorResponse('Geçersiz sipariş ID formatı', 400);
    const result = await orderPromise({ userId: user.id, tenantId: user.tenantId, role: user.role as WorkOrderActor['role'] }, id);
    const response = await redactedSuccess(result);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    if (error instanceof WorkOrderApiError) return errorResponse(error.message, error.status, error.code);
    await reportServerError('orders/promise:GET', error);
    return errorResponse('Termin önerisi alınamadı', 500);
  }
}
