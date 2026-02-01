/**
 * useOrders Hook - Enterprise Grade
 * 
 * Features:
 * - Request caching with deduplication (SWR-like pattern)
 * - Optimistic updates with automatic rollback
 * - Zustand store synchronization
 * - Document upload support
 * - TypeScript strict mode compatible
 */

'use client';

import React from 'react';
import { useCachedQuery, useMutation, requestCache } from '@/lib/api/request-layer';
import {
  createOrderAction,
  deleteOrderAction,
  getOrdersAction,
  updateOrderAction,
  updateOrderStatusAction,
  uploadOrderDocumentsAction,
} from '@/app/actions/order.actions';
import { Order, NewOrderFormData } from '@/lib/types';
import { useOrdersStore } from '@/lib/stores/orders.store';
import { devLog } from '@/lib/utils/logger';

const ORDERS_CACHE_KEY = 'orders';

export interface UseOrdersResult {
  orders: Order[];
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  addOrder: (data: NewOrderFormData | FormData) => Promise<Order>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<Order>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<Order>;
  deleteOrder: (id: string) => Promise<void>;
  uploadDocuments: (id: string, formData: FormData) => Promise<void>;
  getOrderById: (id: string) => Order | undefined;
}

/**
 * Convert NewOrderFormData to FormData for server action compatibility
 */
function objectToFormData(data: NewOrderFormData): FormData {
  const formData = new FormData();
  formData.append('customerName', data.customerName);
  if (data.email) formData.append('email', data.email);
  if (data.phone) formData.append('phone', data.phone);
  formData.append('productName', data.productName);
  formData.append('quantity', String(data.quantity));
  formData.append('totalAmount', String(data.totalAmount));
  formData.append('currency', data.currency || '₺');
  if (data.deliveryDate) formData.append('deliveryDate', data.deliveryDate);
  if (data.notes) formData.append('notes', data.notes);
  return formData;
}

export function useOrders(): UseOrdersResult {
  const store = useOrdersStore();
  const orders = useOrdersStore((s) => s.orders);
  const setOrders = useOrdersStore((s) => s.setOrders);
  const setLoading = useOrdersStore((s) => s.setLoading);
  const setTotalCount = useOrdersStore((s) => s.setTotalCount);

  const {
    data: fetchedOrders,
    isLoading,
    isValidating,
    error,
    refetch,
    mutate,
  } = useCachedQuery<Order[]>(
    ORDERS_CACHE_KEY,
    async () => {
      return await getOrdersAction();
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      onError: (err) => {
        devLog.error('[useOrders] Failed to fetch orders:', err);
      },
    }
  );

  // Sync loading state with Zustand store
  React.useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Sync fetched orders with Zustand store
  React.useEffect(() => {
    if (!fetchedOrders) return;
    setOrders(fetchedOrders);
    setTotalCount(fetchedOrders.length);
  }, [fetchedOrders, setOrders, setTotalCount]);

  // Add Order Mutation
  const addOrderMutation = useMutation<Order, NewOrderFormData | FormData>(
    async (data) => {
      const formData = data instanceof FormData ? data : objectToFormData(data);
      return await createOrderAction(formData);
    },
    {
      onSuccess: (newOrder) => {
        const previous = useOrdersStore.getState().orders;
        const next = [...previous, newOrder];
        setOrders(next);
        setTotalCount(next.length);
        requestCache.invalidate(ORDERS_CACHE_KEY);
      },
      onError: (err) => {
        devLog.error('[useOrders] Failed to create order:', err);
      },
    }
  );

  // Update Order Mutation with Optimistic Update
  const updateOrderMutation = useMutation<Order, { id: string; updates: Partial<Order> }, { previous: Order[] }>(
    async ({ id, updates }) => {
      return await updateOrderAction(id, updates);
    },
    {
      onMutate: async ({ id, updates }) => {
        const previous = useOrdersStore.getState().orders;
        const optimistic = previous.map((o) => (o.id === id ? { ...o, ...updates } : o));
        setOrders(optimistic);
        mutate(optimistic);
        return { previous };
      },
      onSuccess: (updated) => {
        const next = useOrdersStore.getState().orders.map((o) => (o.id === updated.id ? updated : o));
        setOrders(next);
        mutate(next);
      },
      onError: (err, _vars, ctx) => {
        devLog.error('[useOrders] Failed to update order:', err);
        if (ctx?.previous) {
          setOrders(ctx.previous);
          mutate(ctx.previous);
        }
      },
    }
  );

  // Update Status Mutation with Optimistic Update
  const updateStatusMutation = useMutation<Order, { id: string; status: Order['status'] }, { previous: Order[] }>(
    async ({ id, status }) => {
      return await updateOrderStatusAction(id, status);
    },
    {
      onMutate: async ({ id, status }) => {
        const previous = useOrdersStore.getState().orders;
        const optimistic = previous.map((o) => (o.id === id ? { ...o, status } : o));
        setOrders(optimistic);
        mutate(optimistic);
        return { previous };
      },
      onSuccess: (updated) => {
        const next = useOrdersStore.getState().orders.map((o) => (o.id === updated.id ? updated : o));
        setOrders(next);
        mutate(next);
      },
      onError: (err, _vars, ctx) => {
        devLog.error('[useOrders] Failed to update order status:', err);
        if (ctx?.previous) {
          setOrders(ctx.previous);
          mutate(ctx.previous);
        }
      },
    }
  );

  // Delete Order Mutation with Optimistic Update
  const deleteOrderMutation = useMutation<void, string, { previous: Order[] }>(
    async (id) => {
      await deleteOrderAction(id);
    },
    {
      onMutate: async (id) => {
        const previous = useOrdersStore.getState().orders;
        const optimistic = previous.filter((o) => o.id !== id);
        setOrders(optimistic);
        setTotalCount(optimistic.length);
        mutate(optimistic);
        return { previous };
      },
      onError: (err, _id, ctx) => {
        devLog.error('[useOrders] Failed to delete order:', err);
        if (ctx?.previous) {
          setOrders(ctx.previous);
          setTotalCount(ctx.previous.length);
          mutate(ctx.previous);
        }
      },
    }
  );

  // Upload Documents Mutation
  const uploadDocumentsMutation = useMutation<void, { id: string; formData: FormData }>(
    async ({ id, formData }) => {
      await uploadOrderDocumentsAction(id, formData);
    },
    {
      onSuccess: async () => {
        requestCache.invalidate(ORDERS_CACHE_KEY);
        await refetch();
      },
      onError: (err) => {
        devLog.error('[useOrders] Failed to upload documents:', err);
      },
    }
  );

  // Exposed Methods
  const refresh = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  const addOrder = React.useCallback(
    async (data: NewOrderFormData | FormData) => {
      return await addOrderMutation.mutateAsync(data);
    },
    [addOrderMutation]
  );

  const updateOrder = React.useCallback(
    async (id: string, updates: Partial<Order>) => {
      return await updateOrderMutation.mutateAsync({ id, updates });
    },
    [updateOrderMutation]
  );

  const updateOrderStatus = React.useCallback(
    async (id: string, status: Order['status']) => {
      return await updateStatusMutation.mutateAsync({ id, status });
    },
    [updateStatusMutation]
  );

  const deleteOrder = React.useCallback(
    async (id: string) => {
      await deleteOrderMutation.mutateAsync(id);
    },
    [deleteOrderMutation]
  );

  const uploadDocuments = React.useCallback(
    async (id: string, formData: FormData) => {
      await uploadDocumentsMutation.mutateAsync({ id, formData });
    },
    [uploadDocumentsMutation]
  );

  const getOrderById = React.useCallback(
    (id: string) => store.orders.find((o) => o.id === id),
    [store.orders]
  );

  return {
    orders,
    isLoading,
    isValidating,
    error,
    refresh,
    addOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    uploadDocuments,
    getOrderById,
  };
}
