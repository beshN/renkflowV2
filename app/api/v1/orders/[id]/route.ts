import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse, handleCORS, hasRole } from '@/lib/api/middleware';
import { orderService } from '@/lib/services';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// CORS preflight
export async function OPTIONS() {
  return handleCORS();
}

// GET /api/v1/orders/:id - Get order by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    const { id } = await params;
    const order = await orderService.getOrderById(id);
    
    if (!order) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    return successResponse(order, 'Sipariş başarıyla getirildi');
  } catch (error: unknown) {
    console.error('Get order error:', error);
    return errorResponse('Sipariş alınırken bir hata oluştu', 500);
  }
}

// PATCH /api/v1/orders/:id - Update order
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    // Only owner and admin can update orders
    if (!hasRole(user, ['owner', 'admin'])) {
      return errorResponse('Bu işlem için yetkiniz yok', 403);
    }

    const { id } = await params;
    const updates = await request.json();

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    const order = await orderService.updateOrder(id, updates);
    
    return successResponse(order, 'Sipariş başarıyla güncellendi');
  } catch (error: unknown) {
    console.error('Update order error:', error);
    return errorResponse('Sipariş güncellenirken bir hata oluştu', 500);
  }
}

// DELETE /api/v1/orders/:id - Delete order
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    // Only owner and admin can delete orders
    if (!hasRole(user, ['owner', 'admin'])) {
      return errorResponse('Bu işlem için yetkiniz yok', 403);
    }

    const { id } = await params;

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    await orderService.deleteOrder(id);
    
    return successResponse({ id }, 'Sipariş başarıyla silindi');
  } catch (error: unknown) {
    console.error('Delete order error:', error);
    return errorResponse('Sipariş silinirken bir hata oluştu', 500);
  }
}
export const runtime = 'edge';
