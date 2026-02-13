'use server';

import { orderService } from '@/lib/services/orderService.server';
import { NewOrderFormData, Order, safeParseCurrency } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { withCache, cacheKeys, invalidateCache } from '@/lib/cache/enterprise';
import { withServerActionTiming } from '@/lib/utils/metrics';
import { requireTenantContext } from '@/lib/auth/serverAuth';
import {
  createOrderSchema,
  updateOrderSchema,
  statusUpdateSchema,
  validateFiles,
  formatValidationErrors,
} from '@/lib/validations/order.schema';
import { z } from 'zod';

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

const ALLOWED_STATUS_TRANSITIONS: Record<Order['status'], Order['status'][]> = {
  pending: ['in_production', 'delivered'],
  in_production: ['pending', 'delivered'],
  delivered: ['in_production'],
};

// Validate session and ensure tenantId is defined
async function validateSession(): Promise<{ user: { id: string; tenantId: string; email?: string | null; name?: string | null; role?: string }; }> {
  const context = await requireTenantContext();

  // Return with guaranteed tenantId
  return {
    user: {
      id: context.userId,
      tenantId: context.tenantId,
      email: context.email,
      name: context.name,
      role: context.role,
    }
  };
}

function toActionErrorMessage(error: z.ZodError): string {
  const errors = formatValidationErrors(error);
  const uniqueMessages = [...new Set(Object.values(errors))];
  return uniqueMessages.join(', ');
}

function normalizeCustomFields(
  value: unknown
): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Özel alanlar geçersiz formatta');
  }

  const normalized = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, rawValue]) => {
      const cleanKey = String(key).trim();
      if (!cleanKey) return acc;
      acc[cleanKey] = String(rawValue ?? '').trim();
      return acc;
    },
    {}
  );

  return normalized;
}

function parseCustomFieldsFromFormData(formData: FormData): Record<string, string> | undefined {
  const customFieldsRaw = formData.get('customFields');
  if (!customFieldsRaw || typeof customFieldsRaw !== 'string') return undefined;

  try {
    const parsed = JSON.parse(customFieldsRaw);
    return normalizeCustomFields(parsed);
  } catch {
    throw new Error('Özel alanlar JSON formatında olmalıdır');
  }
}

function getFilesFromFormData(formData: FormData): File[] {
  return formData
    .getAll('files')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function getOptionalFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function validateFilesOrThrow(files: File[]): void {
  if (files.length === 0) return;
  const fileValidation = validateFiles(files);
  if (!fileValidation.valid) {
    throw new Error(fileValidation.errors.join(', '));
  }
}

function invalidateOrderCaches(tenantId: string, orderId?: string): void {
  invalidateCache(cacheKeys.orders.list(tenantId));
  invalidateCache(cacheKeys.orders.stats(tenantId));
  if (orderId) {
    invalidateCache(cacheKeys.orders.detail(tenantId, orderId));
  }
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
      const cacheKey = cacheKeys.orders.detail(session.user.tenantId, id);
      return await withCache(
        cacheKey,
        () => orderService.getOrderById(session.user.tenantId, id),
        30000
      );
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
      const files = getFilesFromFormData(formData);
      validateFilesOrThrow(files);

      const validationResult = createOrderSchema.safeParse({
        customerName: formData.get('customerName'),
        email: getOptionalFormString(formData, 'email'),
        phone: getOptionalFormString(formData, 'phone'),
        productName: formData.get('productName'),
        quantity: formData.get('quantity'),
        totalAmount: formData.get('totalAmount'),
        currency: formData.get('currency'),
        deliveryDate: getOptionalFormString(formData, 'deliveryDate'),
        notes: getOptionalFormString(formData, 'notes'),
      });

      if (!validationResult.success) {
        throw new Error(toActionErrorMessage(validationResult.error));
      }

      const data: NewOrderFormData = {
        ...validationResult.data,
        currency: safeParseCurrency(validationResult.data.currency),
        customFields: parseCustomFieldsFromFormData(formData),
      };

      const order = await orderService.createOrder(session.user.tenantId, data, files);

      invalidateOrderCaches(session.user.tenantId, order.id);
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

      const { customFields, ...rest } = updates as Partial<Order> & {
        customFields?: unknown;
      };
      const validationResult = updateOrderSchema.safeParse(rest);
      if (!validationResult.success) {
        throw new Error(toActionErrorMessage(validationResult.error));
      }

      const sanitizedUpdates: Partial<Order> = {
        ...validationResult.data,
      };

      if (customFields !== undefined) {
        sanitizedUpdates.customFields = normalizeCustomFields(customFields);
      }

      const order = await orderService.updateOrder(session.user.tenantId, id, sanitizedUpdates);

      invalidateOrderCaches(session.user.tenantId, id);
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

      const parsedStatus = statusUpdateSchema.safeParse({ status });
      if (!parsedStatus.success) {
        throw new Error(toActionErrorMessage(parsedStatus.error));
      }

      const existingOrder = await orderService.getOrderById(session.user.tenantId, id);
      if (!existingOrder) {
        throw new Error('Sipariş bulunamadı');
      }

      if (existingOrder.status !== parsedStatus.data.status) {
        const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[existingOrder.status] || [];
        if (!allowedTransitions.includes(parsedStatus.data.status)) {
          throw new Error(
            `Durum geçişine izin verilmiyor: ${existingOrder.status} -> ${parsedStatus.data.status}`
          );
        }
      }

      const order = await orderService.updateOrderStatus(
        session.user.tenantId,
        id,
        parsedStatus.data.status
      );

      invalidateOrderCaches(session.user.tenantId, id);
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

      invalidateOrderCaches(session.user.tenantId, id);
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

      const files = getFilesFromFormData(formData);
      if (files.length === 0) {
        return;
      }

      validateFilesOrThrow(files);

      await orderService.addDocuments(session.user.tenantId, id, files);

      invalidateOrderCaches(session.user.tenantId, id);
      revalidatePath(`/orders/${id}`);
      revalidatePath('/finance/documents');
    } catch (error) {
      return handleActionError(error, 'uploadOrderDocumentsAction');
    }
  });
}
