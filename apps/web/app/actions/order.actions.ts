'use server';

import { auth } from '@/auth';
import { orderService } from '@/lib/services/orderService.server';
import { NewOrderFormData, Order, safeParseCurrency } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { withCache, cacheKeys, invalidateCache } from '@/lib/cache/enterprise';
import { withServerActionTiming } from '@/lib/utils/metrics';

/**
 * Server Actions for Order Management
 * Enterprise-grade with comprehensive error handling and caching
 */

// Helper for consistent error handling
function handleActionError(error: unknown, action: string): never {
  console.error(`[${action}] Error:`, {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(`${action} işlemi başarısız oldu`);
}

// Validate session and ensure tenantId is defined
async function validateSession(): Promise<{ user: { id: string; tenantId: string; email?: string | null; name?: string | null; role?: string }; }> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gereklidir');
  }
  // Return with guaranteed tenantId
  return {
    user: {
      id: session.user.id,
      tenantId: session.user.tenantId,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    }
  };
}

/**
 * Get all orders for the current tenant
 */
export async function getOrdersAction(): Promise<Order[]> {
  return withServerActionTiming('orders.getOrdersAction', async () => {
    try {
      const session = await validateSession();
      const cacheKey = cacheKeys.orders.list(session.user.tenantId);
      
      return await withCache(
        cacheKey,
        () => orderService.getOrders(session.user.tenantId),
        60000 // 1 minute cache
      );
    } catch (error) {
      return handleActionError(error, 'getOrdersAction');
    }
  });
}

/**
 * Get a single order by ID
 */
export async function getOrderByIdAction(id: string): Promise<Order | null> {
  return withServerActionTiming('orders.getOrderByIdAction', async () => {
    try {
      const session = await validateSession();
      return await orderService.getOrderById(session.user.tenantId, id);
    } catch (error) {
      return handleActionError(error, 'getOrderByIdAction');
    }
  });
}

/**
 * Create a new order with files
 */
export async function createOrderAction(formData: FormData): Promise<Order> {
  return withServerActionTiming('orders.createOrderAction', async () => {
    try {
      const session = await validateSession();
    
    // Extract files
    const files = formData.getAll('files') as File[];
    
    // Extract and validate other data
    const customFieldsRaw = formData.get('customFields') as string | null;
    let parsedCustomFields: Record<string, string> | undefined;
    
    if (customFieldsRaw) {
      try {
        parsedCustomFields = JSON.parse(customFieldsRaw);
      } catch {
        console.warn('[createOrderAction] Invalid customFields JSON');
      }
    }

    const customerName = formData.get('customerName') as string;
    const productName = formData.get('productName') as string;
    const quantityStr = formData.get('quantity') as string;
    const quantity = parseInt(quantityStr);

    // Validate required fields
    if (!customerName?.trim()) {
      throw new Error('Müşteri adı zorunludur');
    }
    
    if (!productName?.trim()) {
      throw new Error('Ürün adı zorunludur');
    }
    
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error('Geçerli bir miktar giriniz');
    }

    const data: NewOrderFormData = {
      customerName: customerName.trim(),
      email: (formData.get('email') as string)?.trim() || undefined,
      phone: (formData.get('phone') as string)?.trim() || undefined,
      productName: productName.trim(),
      quantity,
      totalAmount: parseFloat(formData.get('totalAmount') as string) || 0,
      currency: safeParseCurrency(formData.get('currency') as string | null),
      deliveryDate: (formData.get('deliveryDate') as string) || undefined,
      notes: (formData.get('notes') as string)?.trim() || undefined,
      customFields: parsedCustomFields,
    };

    const order = await orderService.createOrder(session.user.tenantId, data, files);
    
    revalidatePath('/orders');
    revalidatePath('/dashboard');
    
      return order;
    } catch (error) {
      return handleActionError(error, 'createOrderAction');
    }
  });
}

/**
 * Update an existing order
 */
export async function updateOrderAction(id: string, updates: Partial<Order>): Promise<Order> {
  return withServerActionTiming('orders.updateOrderAction', async () => {
    try {
      const session = await validateSession();
    
    if (!id) {
      throw new Error('Sipariş ID gerekli');
    }
    
    const order = await orderService.updateOrder(session.user.tenantId, id, updates);
    
    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);
    revalidatePath('/dashboard');
    
      return order;
    } catch (error) {
      return handleActionError(error, 'updateOrderAction');
    }
  });
}

/**
 * Update order status
 */
export async function updateOrderStatusAction(id: string, status: Order['status']): Promise<Order> {
  return withServerActionTiming('orders.updateOrderStatusAction', async () => {
    try {
      const session = await validateSession();
    
    if (!id) {
      throw new Error('Sipariş ID gerekli');
    }
    
    if (!status) {
      throw new Error('Durum bilgisi gerekli');
    }
    
    const order = await orderService.updateOrderStatus(session.user.tenantId, id, status);
    
    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);
    revalidatePath('/kanban');
    revalidatePath('/dashboard');
    
      return order;
    } catch (error) {
      return handleActionError(error, 'updateOrderStatusAction');
    }
  });
}

/**
 * Delete an order
 */
export async function deleteOrderAction(id: string): Promise<void> {
  return withServerActionTiming('orders.deleteOrderAction', async () => {
    try {
      const session = await validateSession();
    
    if (!id) {
      throw new Error('Sipariş ID gerekli');
    }
    
    await orderService.deleteOrder(session.user.tenantId, id);
    
    revalidatePath('/orders');
      revalidatePath('/dashboard');
    } catch (error) {
      return handleActionError(error, 'deleteOrderAction');
    }
  });
}

/**
 * Upload documents for an order
 */
export async function uploadOrderDocumentsAction(id: string, formData: FormData): Promise<void> {
  return withServerActionTiming('orders.uploadOrderDocumentsAction', async () => {
    try {
      const session = await validateSession();
    
    if (!id) {
      throw new Error('Sipariş ID gerekli');
    }
    
    const files = formData.getAll('files') as File[];
    
    if (files.length === 0) {
      console.warn('[uploadOrderDocumentsAction] No files provided');
      return;
    }
    
    // Validate file sizes and types
    const maxSize = 10 * 1024 * 1024; // 10MB
    for (const file of files) {
      if (file.size > maxSize) {
        throw new Error(`Dosya çok büyük: ${file.name}. Maksimum 10MB.`);
      }
    }
    
    await orderService.addDocuments(session.user.tenantId, id, files);
    
    revalidatePath(`/orders/${id}`);
      revalidatePath('/finance/documents');
    } catch (error) {
      return handleActionError(error, 'uploadOrderDocumentsAction');
    }
  });
}
