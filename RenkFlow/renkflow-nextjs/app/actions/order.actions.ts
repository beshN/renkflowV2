'use server';

import { orderService } from '@/lib/services';
import { NewOrderFormData, Order } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Server Actions for Order Management
 * These functions run on the server and can safely access the database.
 */

export async function getOrdersAction() {
  return await orderService.getOrders();
}

export async function getOrderByIdAction(id: string) {
  return await orderService.getOrderById(id);
}

export async function createOrderAction(formData: FormData) {
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
    currency: (formData.get('currency') as string) || '₺',
    deliveryDate: formData.get('deliveryDate') as string || undefined,
    notes: formData.get('notes') as string || undefined,
    documents: [], // Documents are handled via 'files'
  };

  const order = await orderService.createOrder(data, files);
  revalidatePath('/orders');
  return order;
}

export async function updateOrderAction(id: string, updates: Partial<Order>) {
  const order = await orderService.updateOrder(id, updates);
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return order;
}

export async function updateOrderStatusAction(id: string, status: Order['status']) {
  const order = await orderService.updateOrderStatus(id, status);
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return order;
}


export async function deleteOrderAction(id: string) {
  await orderService.deleteOrder(id);
  revalidatePath('/orders');
}

export async function uploadOrderDocumentsAction(id: string, formData: FormData) {
  const files = formData.getAll('files') as File[];
  if (files.length > 0) {
    await orderService.addDocuments(id, files);
    revalidatePath(`/orders/${id}`);
  }
}
