import { redactedSuccess } from '@/lib/security/field-access.server';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireSameOrigin, requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { visibleOrdersForActor } from '@/lib/features/orders/access';
import { NextRequest } from 'next/server';
import { getAPIUser, errorResponse, handleCORS } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services/orderService.server';
import { hasPermission, UserRole, AuthorizationError } from '@/lib/auth/rbac';
import { TenantMismatchError } from '@/lib/services/types';
import { 
  updateOrderSchema, 
  orderIdSchema,
  formatValidationErrors 
} from '@/lib/validations/order.schema';
import { ZodError } from 'zod';
import { changedFields, recordAuditAfterCommit } from '@/lib/audit/audit-log';

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

    if (!user.tenantId) {
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

    const order = await orderService.getOrderById(user.tenantId, id);
    
    if (!order) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    const visible = await visibleOrdersForActor([order], { tenantId: user.tenantId, userId: user.id, role: userRole });
    if (!visible.length) return errorResponse('Sipariş bulunamadı', 404);
    return redactedSuccess(visible[0], 'Sipariş başarıyla getirildi');
  } catch (error: unknown) {
    if (error instanceof WorkOrderApiError) return errorResponse(error.message, error.status, error.code);
    console.error('Get order error:', error);
    if (error instanceof TenantMismatchError) {
      // A cross-tenant id is answered exactly like an unknown id, so order existence is not disclosed.
      return errorResponse('Sipariş bulunamadı', 404);
    }
    if (error instanceof AuthorizationError) {
      return errorResponse(error.message, 403);
    }
    return errorResponse('Sipariş alınırken bir hata oluştu', 500);
  }
}

// PATCH /api/v1/orders/:id - Update order
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    requireSameOriginJson(request);
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    if (!user.tenantId) {
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
    const existingOrder = await orderService.getOrderById(user.tenantId, id);
    if (!existingOrder) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    const order = await orderService.updateOrder(user.tenantId, id, validationResult.data);
    const changes = changedFields(existingOrder as unknown as Record<string, unknown>, validationResult.data as Record<string, unknown>);
    if (Object.keys(changes).length) await recordAuditAfterCommit({ tenantId: user.tenantId, actorId: user.id, entityType: 'order', entityId: id, action: 'updated', changes });
    
    return redactedSuccess(order, 'Sipariş başarıyla güncellendi');
  } catch (error: unknown) {
    console.error('Update order error:', error);
    
    if (error instanceof WorkOrderApiError) {
      return errorResponse(error.message, error.status, error.code);
    }
    
    if (error instanceof ZodError) {
      const errors = formatValidationErrors(error);
      return errorResponse('Geçersiz veri: ' + Object.values(errors).join(', '), 400);
    }

    if (error instanceof TenantMismatchError) {
      // A cross-tenant id is answered exactly like an unknown id, so order existence is not disclosed.
      return errorResponse('Sipariş bulunamadı', 404);
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
    requireSameOrigin(request);
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    if (!user.tenantId) {
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
    const existingOrder = await orderService.getOrderById(user.tenantId, id);
    if (!existingOrder) {
      return errorResponse('Sipariş bulunamadı', 404);
    }

    await orderService.deleteOrder(user.tenantId, id, user.id);
    
    return redactedSuccess({ id }, 'Sipariş başarıyla silindi');
  } catch (error: unknown) {
    if (error instanceof WorkOrderApiError) return errorResponse(error.message, error.status, error.code);
    console.error('Delete order error:', error);
    if (error instanceof TenantMismatchError) {
      // A cross-tenant id is answered exactly like an unknown id, so order existence is not disclosed.
      return errorResponse('Sipariş bulunamadı', 404);
    }
    
    if (error instanceof AuthorizationError) {
      return errorResponse(error.message, 403);
    }
    
    return errorResponse('Sipariş silinirken bir hata oluştu', 500);
  }
}
