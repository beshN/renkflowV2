import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse, handleCORS } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services/orderService.server';
import { NewOrderFormData } from '@/lib/types';
import { hasPermission, UserRole, AuthorizationError } from '@/lib/auth/rbac';
import { 
  createOrderSchema, 
  validateFiles, 
  formatValidationErrors 
} from '@/lib/validations/order.schema';
import { ZodError } from 'zod';

// CORS preflight
export async function OPTIONS() {
  return handleCORS();
}

// GET /api/v1/orders - List all orders
export async function GET(request: NextRequest) {
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    if (!user.tenantId) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    // RBAC Check: Require 'list' permission on 'orders'
    const userRole = (user.role as UserRole) || 'member';
    if (!hasPermission(userRole, 'orders', 'list')) {
      return errorResponse('Bu işlem için yetkiniz bulunmuyor', 403);
    }

    const orders = await orderService.getOrders(user.tenantId);
    
    return successResponse(orders, 'Siparişler başarıyla getirildi');
  } catch (error: unknown) {
    console.error('Get orders error:', error);
    if (error instanceof AuthorizationError) {
      return errorResponse(error.message, 403);
    }
    return errorResponse('Siparişler alınırken bir hata oluştu', 500);
  }
}

// POST /api/v1/orders - Create new order
export async function POST(request: NextRequest) {
  let files: File[] = [];
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    if (!user.tenantId) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    // RBAC Check: Require 'create' permission on 'orders'
    const userRole = (user.role as UserRole) || 'member';
    if (!hasPermission(userRole, 'orders', 'create')) {
      return errorResponse('Sipariş oluşturma yetkiniz bulunmuyor', 403);
    }

    const contentType = request.headers.get('content-type') || '';
    let rawData: Record<string, unknown>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      files = formData.getAll('files') as File[];
      
      rawData = {
        customerName: formData.get('customerName'),
        email: formData.get('email') || undefined,
        phone: formData.get('phone') || undefined,
        productName: formData.get('productName'),
        quantity: formData.get('quantity'),
        totalAmount: formData.get('totalAmount'),
        currency: formData.get('currency') || undefined,
        deliveryDate: formData.get('deliveryDate'),
        notes: formData.get('notes') || undefined,
      };
    } else {
      // Handle JSON body
      rawData = await request.json();
    }

    // Validate input with Zod (includes sanitization)
    const validationResult = createOrderSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return errorResponse('Geçersiz veri: ' + Object.values(errors).join(', '), 400);
    }

    // Validate files
    if (files.length > 0) {
      const fileValidation = validateFiles(files);
      if (!fileValidation.valid) {
        return errorResponse('Dosya hatası: ' + fileValidation.errors.join(', '), 400);
      }
    }

    const orderData: NewOrderFormData = validationResult.data;

    const order = await orderService.createOrder(user.tenantId, orderData, files);
    
    return successResponse(order, 'Sipariş başarıyla oluşturuldu');
  } catch (error: unknown) {
    console.error('Create order error:', error);
    
    if (error instanceof ZodError) {
      const errors = formatValidationErrors(error);
      return errorResponse('Geçersiz veri: ' + Object.values(errors).join(', '), 400);
    }
    
    if (error instanceof AuthorizationError) {
      return errorResponse(error.message, 403);
    }
    
    return errorResponse('Sipariş oluşturulurken bir hata oluştu', 500);
  }
}
