import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse, handleCORS } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services';
import { hasPermission, UserRole, AuthorizationError } from '@/lib/auth/rbac';
import { statusUpdateSchema, orderIdSchema, formatValidationErrors } from '@/lib/validations/order.schema';
import { ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// CORS preflight
export async function OPTIONS() {
  return handleCORS();
}

// PATCH /api/v1/orders/:id/status - Update order status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    // RBAC Check: Workers can update status (for mobile app)
    // But only on orders assigned to them (enforced at service level)
    const userRole = (user.role as UserRole) || 'member';
    if (!hasPermission(userRole, 'orders', 'update')) {
      return errorResponse('Durum güncelleme yetkiniz bulunmuyor', 403);
    }

    const { id } = await params;
    
    // Validate ID format
    const idValidation = orderIdSchema.safeParse(id);
    if (!idValidation.success) {
      return errorResponse('Geçersiz sipariş ID formatı', 400);
    }

    const body = await request.json();

    // Validate status with Zod
    const validationResult = statusUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return errorResponse('Geçersiz durum: ' + Object.values(errors).join(', '), 400);
    }

    const { status } = validationResult.data;

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    const order = await orderService.updateOrderStatus(id, status);
    
    return successResponse(order, `Sipariş durumu "${status}" olarak güncellendi`);
  } catch (error: unknown) {
    console.error('Update order status error:', error);
    
    if (error instanceof ZodError) {
      const errors = formatValidationErrors(error);
      return errorResponse('Geçersiz veri: ' + Object.values(errors).join(', '), 400);
    }
    
    if (error instanceof AuthorizationError) {
      return errorResponse(error.message, 403);
    }
    
    return errorResponse('Sipariş durumu güncellenirken bir hata oluştu', 500);
  }
}
