'use server';

import { resolveUploadedFile, UploadReferenceSchema } from '@/lib/storage/upload-reference';
import { orderService } from '@/lib/services/orderService.server';
import { NewOrderFormData, Order, safeParseCurrency } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { cacheKeys, invalidateCache } from '@/lib/cache/enterprise';
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
import { hasPermission, type Permission, type UserRole } from '@/lib/features/auth/permissions';
import { visibleOrdersForActor } from '@/lib/features/orders/access';
import { changedFields, recordAuditAfterCommit } from '@/lib/audit/audit-log';

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
async function validateSession(permission: Permission = 'orders.view'): Promise<{ user: { id: string; tenantId: string; email?: string | null; name?: string | null; role?: string }; }> {
  const context = await requireTenantContext();
  if (!hasPermission(context.role, permission)) throw new Error('Bu işlem için yetkiniz bulunmuyor');

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

function parseItems(formData: FormData): unknown {
  const value = formData.get('items');
  if (!value) return undefined;
  if (typeof value !== 'string') throw new Error('Sipariş kalemleri geçersiz');
  try { return JSON.parse(value); } catch { throw new Error('Sipariş kalemleri geçersiz'); }
}

async function getFilesFromFormData(formData: FormData, actor:{tenantId:string;userId:string}): Promise<File[]> {
 const files=formData.getAll('files').filter((entry):entry is File=>entry instanceof File && entry.size>0);
 const value=formData.get('uploadedFiles');
 if(value){
  const references=z.array(UploadReferenceSchema).max(10).parse(JSON.parse(String(value)));
  for(const reference of references) files.push(await resolveUploadedFile(actor,reference));
 }
 if(files.length>10) throw new Error('En fazla 10 dosya yüklenebilir');
 return files;
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
      const orders = await orderService.getOrders(session.user.tenantId);
      return visibleOrdersForActor(orders, { tenantId: session.user.tenantId, userId: session.user.id, role: session.user.role as UserRole });
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
      const order = await orderService.getOrderById(session.user.tenantId, id);
      if (!order) return null;
      return (await visibleOrdersForActor([order], { tenantId: session.user.tenantId, userId: session.user.id, role: session.user.role as UserRole }))[0] || null;
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
      const session = await validateSession('orders.create');
      const files = await getFilesFromFormData(formData, {tenantId:session.user.tenantId,userId:session.user.id});
      validateFilesOrThrow(files);

      const validationResult = createOrderSchema.safeParse({
        customerId: formData.get('customerId') || undefined,
        customerName: formData.get('customerName'),
        email: getOptionalFormString(formData, 'email'),
        phone: getOptionalFormString(formData, 'phone'),
        productName: formData.get('productName'),
        quantity: formData.get('quantity'),
        totalAmount: formData.get('totalAmount'),
        currency: formData.get('currency'),
        deliveryDate: getOptionalFormString(formData, 'deliveryDate'),
        notes: getOptionalFormString(formData, 'notes'),
        items: parseItems(formData),
      });

      if (!validationResult.success) {
        throw new Error(toActionErrorMessage(validationResult.error));
      }

      const data: NewOrderFormData = {
        ...validationResult.data,
        currency: safeParseCurrency(validationResult.data.currency),
        items: validationResult.data.items?.map((item) => ({
          ...item,
          totalPrice: item.totalPrice ?? (item.unitPrice ?? 0) * item.quantity,
        })),
        customFields: parseCustomFieldsFromFormData(formData),
      };

      const order = await orderService.createOrder(session.user.tenantId, data, files, session.user.id);

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
      const session = await validateSession('orders.edit');
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

      const before = await orderService.getOrderById(session.user.tenantId, id);
      const order = await orderService.updateOrder(session.user.tenantId, id, sanitizedUpdates);
      const changes = before ? changedFields(before as unknown as Record<string, unknown>, sanitizedUpdates as Record<string, unknown>) : {};
      if (Object.keys(changes).length) await recordAuditAfterCommit({ tenantId: session.user.tenantId, actorId: session.user.id, entityType: 'order', entityId: id, action: 'updated', changes });

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
      const session = await validateSession('orders.edit');
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
      const session = await validateSession('orders.delete');
      if (!id) {
        throw new Error('Sipariş ID gerekli');
      }

      await orderService.deleteOrder(session.user.tenantId, id, session.user.id);

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
      const session = await validateSession('orders.edit');
      if (!id) {
        throw new Error('Sipariş ID gerekli');
      }

      const files = await getFilesFromFormData(formData, {tenantId:session.user.tenantId,userId:session.user.id});
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
