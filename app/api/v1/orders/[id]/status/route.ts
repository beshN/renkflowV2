export const runtime = 'edge';
import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse, handleCORS } from '@/lib/api/middleware';
import { orderService } from '@/lib/services';
import { Order } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// CORS preflight
export async function OPTIONS() {
  return handleCORS();
}

// Valid order statuses
const VALID_STATUSES: Order['status'][] = ['pending', 'in_production', 'delivered'];

// PATCH /api/v1/orders/:id/status - Update order status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    // All authenticated users can update status (workers, office, admin, owner)
    // This is intentional for mobile app usage by workers

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse(
        `Geçersiz durum. Geçerli değerler: ${VALID_STATUSES.join(', ')}`,
        400
      );
    }

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    const order = await orderService.updateOrderStatus(id, status);
    
    return successResponse(order, `Sipariş durumu "${status}" olarak güncellendi`);
  } catch (error: unknown) {
    console.error('Update order status error:', error);
    return errorResponse('Sipariş durumu güncellenirken bir hata oluştu', 500);
  }
}
