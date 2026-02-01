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
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gereklidir');
  }
  // Extract files
  const files = formData.getAll('files') as File[];
  
  // Extract other data
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
    // documents property removed - handled via files parameter
  };

  const order = await orderService.createOrder(session.user.tenantId, data, files);
  revalidatePath('/orders');
  return order;  // Return created order
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
