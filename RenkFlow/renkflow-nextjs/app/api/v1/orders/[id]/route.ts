import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse, handleCORS } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services';
import { hasPermission, UserRole, AuthorizationError } from '@/lib/auth/rbac';
import { 
  updateOrderSchema, 
  orderIdSchema,
  formatValidationErrors 
} from '@/lib/validations/order.schema';
import { ZodError } from 'zod';

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

    // RBAC Check
    const userRole = (user.role as UserRole) || 'member';
    if (!hasPermission(userRole, 'orders', 'read')) {
      return errorResponse('Bu işlem için yetkiniz bulunmuyor', 403);
    }

    const { id } = await params;
    
    // Validate ID format
    const idValidation = orderIdSchema.safeParse(id);
    if (!idValidation.success) {
      return errorResponse('Geçersiz sipariş ID formatı', 400);
    }

    const order = await orderService.getOrderById(id);
    
    if (!order) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    return successResponse(order, 'Sipariş başarıyla getirildi');
  } catch (error: unknown) {
    console.error('Get order error:', error);
    if (error instanceof AuthorizationError) {
      return errorResponse(error.message, 403);
    }
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

    // RBAC Check: Require 'update' permission on 'orders'
    const userRole = (user.role as UserRole) || 'member';
    if (!hasPermission(userRole, 'orders', 'update')) {
      return errorResponse('Sipariş güncelleme yetkiniz bulunmuyor', 403);
    }

    const { id } = await params;
    
    // Validate ID format
    const idValidation = orderIdSchema.safeParse(id);
    if (!idValidation.success) {
      return errorResponse('Geçersiz sipariş ID formatı', 400);
    }

    const rawUpdates = await request.json();

    // Validate updates with Zod (includes sanitization)
    const validationResult = updateOrderSchema.safeParse(rawUpdates);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return errorResponse('Geçersiz veri: ' + Object.values(errors).join(', '), 400);
    }

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    const order = await orderService.updateOrder(id, validationResult.data);
    
    return successResponse(order, 'Sipariş başarıyla güncellendi');
  } catch (error: unknown) {
    console.error('Update order error:', error);
    
    if (error instanceof ZodError) {
      const errors = formatValidationErrors(error);
      return errorResponse('Geçersiz veri: ' + Object.values(errors).join(', '), 400);
    }
    
    if (error instanceof AuthorizationError) {
      return errorResponse(error.message, 403);
    }
    
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

    // RBAC Check: Require 'delete' permission on 'orders'
    // Only owner and admin have delete permission in the matrix
    const userRole = (user.role as UserRole) || 'member';
    if (!hasPermission(userRole, 'orders', 'delete')) {
      return errorResponse('Sipariş silme yetkiniz bulunmuyor', 403);
    }

    const { id } = await params;

    // Validate ID format
    const idValidation = orderIdSchema.safeParse(id);
    if (!idValidation.success) {
      return errorResponse('Geçersiz sipariş ID formatı', 400);
    }

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    await orderService.deleteOrder(id);
    
    return successResponse({ id }, 'Sipariş başarıyla silindi');
  } catch (error: unknown) {
    console.error('Delete order error:', error);
    
    if (error instanceof AuthorizationError) {
      return errorResponse(error.message, 403);
    }
    
    return errorResponse('Sipariş silinirken bir hata oluştu', 500);
  }
}
