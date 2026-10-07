import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { visibleOrdersForActor } from '@/lib/features/orders/access';
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
import { ZodError, z } from 'zod';
import { UploadReferenceSchema, resolveUploadedFile } from '@/lib/storage/upload-reference';

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
    
    return successResponse(await visibleOrdersForActor(orders, { tenantId: user.tenantId, userId: user.id, role: userRole }), 'Siparişler başarıyla getirildi');
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
  let references: z.infer<typeof UploadReferenceSchema>[] = [];
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
      files = formData.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const uploadedFiles = formData.get('uploadedFiles');
      if (uploadedFiles) {
        try {
          references = z.array(UploadReferenceSchema).max(10).parse(JSON.parse(String(uploadedFiles)));
        } catch {
          return errorResponse('Geçersiz dosya referansı', 400);
        }
      }
      if (files.length + references.length > 10) return errorResponse('En fazla 10 dosya yüklenebilir', 400);
      
      rawData = {
        customerId: formData.get('customerId') || undefined,
        customerName: formData.get('customerName'),
        email: formData.get('email') || undefined,
        phone: formData.get('phone') || undefined,
        productName: formData.get('productName'),
        quantity: formData.get('quantity'),
        totalAmount: formData.get('totalAmount'),
        currency: formData.get('currency') || undefined,
        deliveryDate: formData.get('deliveryDate') || undefined,
        notes: formData.get('notes') || undefined,
        specialNotes: formData.get('specialNotes') || undefined,
      };
      
      const itemsRaw = formData.get('items');
      if (itemsRaw && typeof itemsRaw === 'string') {
        try {
          rawData.items = JSON.parse(itemsRaw);
        } catch (e) {
          return errorResponse('Geçersiz sipariş kalemleri', 400);
        }
      }
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

    for (const reference of references) {
      try {
        files.push(await resolveUploadedFile({tenantId:user.tenantId,userId:user.id},reference));
      } catch {
        return errorResponse('Dosya doğrulanamadı. Dosyayı yeniden seçip yükleyin.', 400);
      }
    }

    // Validate files
    if (files.length > 0) {
      const fileValidation = validateFiles(files);
      if (!fileValidation.valid) {
        return errorResponse('Dosya hatası: ' + fileValidation.errors.join(', '), 400);
      }
    }

    const orderData: NewOrderFormData = {
      ...validationResult.data,
      items: validationResult.data.items?.map((item) => ({
        ...item,
        totalPrice: item.totalPrice ?? (item.unitPrice ?? 0) * item.quantity,
      })),
    };

    const order = await orderService.createOrder(user.tenantId, orderData, files, user.id);
    
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
    if (error instanceof WorkOrderApiError) {
      return errorResponse(error.message, error.status);
    }
    
    return errorResponse('Sipariş oluşturulurken bir hata oluştu', 500);
  }
}
