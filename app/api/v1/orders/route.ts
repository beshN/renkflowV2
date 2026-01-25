import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse, handleCORS, corsHeaders } from '@/lib/api/middleware';
import { orderService } from '@/lib/services';
import { NewOrderFormData } from '@/lib/types';

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

    const orders = await orderService.getOrders();
    
    return successResponse(orders, 'Siparişler başarıyla getirildi');
  } catch (error: unknown) {
    console.error('Get orders error:', error);
    return errorResponse('Siparişler alınırken bir hata oluştu', 500);
  }
}

// POST /api/v1/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    const contentType = request.headers.get('content-type') || '';
    
    let orderData: NewOrderFormData;
    let files: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Handle form data with files
      const formData = await request.formData();
      files = formData.getAll('files') as File[];
      
      orderData = {
        customerName: formData.get('customerName') as string,
        customerEmail: formData.get('customerEmail') as string || undefined,
        customerPhone: formData.get('customerPhone') as string || undefined,
        productName: formData.get('productName') as string,
        quantity: parseInt(formData.get('quantity') as string) || 1,
        unitPrice: parseFloat(formData.get('unitPrice') as string) || undefined,
        deliveryDate: formData.get('deliveryDate') as string,
        notes: formData.get('notes') as string || undefined,
        documents: [],
      };
    } else {
      // Handle JSON body
      const body = await request.json();
      orderData = {
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        productName: body.productName,
        quantity: body.quantity || 1,
        unitPrice: body.unitPrice,
        deliveryDate: body.deliveryDate,
        notes: body.notes,
        documents: [],
      };
    }

    // Validate required fields
    if (!orderData.customerName || !orderData.productName) {
      return errorResponse('Müşteri adı ve ürün adı gereklidir', 400);
    }

    const order = await orderService.createOrder(orderData, files);
    
    return successResponse(order, 'Sipariş başarıyla oluşturuldu');
  } catch (error: unknown) {
    console.error('Create order error:', error);
    return errorResponse('Sipariş oluşturulurken bir hata oluştu', 500);
  }
}
export const runtime = 'edge';
