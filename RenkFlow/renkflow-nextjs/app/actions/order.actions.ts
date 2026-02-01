'use server';

import { auth } from '@/auth';
import { orderService } from '@/lib/services/orderService.server';
import { NewOrderFormData, Order, safeParseCurrency } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Server Actions for Order Management
 * These functions run on the server and can safely access the database.
 */

export async function getOrdersAction() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gereklidir');
  }
  return await orderService.getOrders(session.user.tenantId);
}

export async function getOrderByIdAction(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gereklidir');
  }
  return await orderService.getOrderById(session.user.tenantId, id);
}

export async function createOrderAction(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      console.error('[createOrderAction] No session or tenant ID');
      throw new Error('Yetkilendirme gereklidir');
    }
    
    // Extract files
    const files = formData.getAll('files') as File[];
    
    // Extract other data
    const customFieldsRaw = formData.get('customFields') as string | null;
    let parsedCustomFields: Record<string, string> | undefined = undefined;
    if (customFieldsRaw) {
      try {
        parsedCustomFields = JSON.parse(customFieldsRaw);
      } catch (error) {
        console.warn('[createOrderAction] Invalid customFields JSON');
      }
    }

    const data: NewOrderFormData = {
      customerName: formData.get('customerName') as string,
      email: formData.get('email') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      productName: formData.get('productName') as string,
      quantity: parseInt(formData.get('quantity') as string),
      totalAmount: parseFloat(formData.get('totalAmount') as string) || 0,
      currency: safeParseCurrency(formData.get('currency') as string | null),
      deliveryDate: formData.get('deliveryDate') as string || undefined,
      notes: formData.get('notes') as string || undefined,
      customFields: parsedCustomFields,
      // documents property removed - handled via files parameter
    };

    // Validate required fields
    if (!data.customerName || !data.productName) {
      console.error('[createOrderAction] Missing required fields:', { 
        hasCustomerName: !!data.customerName, 
        hasProductName: !!data.productName 
      });
      throw new Error('Müşteri adı ve ürün adı zorunludur');
    }

    if (isNaN(data.quantity) || data.quantity <= 0) {
      console.error('[createOrderAction] Invalid quantity:', data.quantity);
      throw new Error('Geçersiz miktar');
    }

    // console.log('[createOrderAction] Creating order for tenant:', session.user.tenantId);

    const order = await orderService.createOrder(session.user.tenantId, data, files);
    
    // console.log('[createOrderAction] Order created successfully');
    
    revalidatePath('/orders');
    return order;  // Return created order
  } catch (error) {
    console.error('[createOrderAction] Error creating order:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export async function updateOrderAction(id: string, updates: Partial<Order>) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gereklidir');
  }
  const order = await orderService.updateOrder(session.user.tenantId, id, updates);
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return order;
}

export async function updateOrderStatusAction(id: string, status: Order['status']) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gereklidir');
  }
  const order = await orderService.updateOrderStatus(session.user.tenantId, id, status);
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return order;
}


export async function deleteOrderAction(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gereklidir');
  }
  await orderService.deleteOrder(session.user.tenantId, id);
  revalidatePath('/orders');
}

export async function uploadOrderDocumentsAction(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gereklidir');
  }
  const files = formData.getAll('files') as File[];
  if (files.length > 0) {
    await orderService.addDocuments(session.user.tenantId, id, files);
    revalidatePath(`/orders/${id}`);
  }
}
