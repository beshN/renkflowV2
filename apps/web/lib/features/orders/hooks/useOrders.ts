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
import { useOrderRealtime } from '@/lib/realtime/hooks';
import { useAuth } from '@/lib/context/AuthContext';
import { RealtimeEvent } from '@/lib/realtime/types';

const ordersCacheKey = (tenantId: string) => `orders:${tenantId || 'anonymous'}`;

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
  formData.append('currency', data.currency || 'TRY');
  if (data.deliveryDate) formData.append('deliveryDate', data.deliveryDate);
  if (data.notes) formData.append('notes', data.notes);
  if (data.customFields) formData.append('customFields', JSON.stringify(data.customFields));
  return formData;
}

export function useOrders(): UseOrdersResult {
  const store = useOrdersStore();
  const orders = useOrdersStore((s) => s.orders);
  const setOrders = useOrdersStore((s) => s.setOrders);
  const setLoading = useOrdersStore((s) => s.setLoading);
  const setTotalCount = useOrdersStore((s) => s.setTotalCount);
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';
  const cacheKey = React.useMemo(() => ordersCacheKey(tenantId), [tenantId]);

  // Real-time event handler for WebSocket updates
  const handleRealtimeEvent = React.useCallback((event: RealtimeEvent) => {
    devLog.info('[useOrders] Realtime event received:', event.type);
    const currentOrders = useOrdersStore.getState().orders;
    
    switch (event.type) {
      case 'order:created': {
        const newOrder = event.payload as Order;
        // Avoid duplicates
        if (!currentOrders.some((o) => o.id === newOrder.id)) {
          setOrders([newOrder, ...currentOrders]);
        }
        break;
      }
      case 'order:updated':
      case 'order:status_changed': {
        const updatedOrder = event.payload as Order;
        setOrders(
          currentOrders.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
        );
        break;
      }
      case 'order:deleted': {
        const { orderId } = event.payload as { orderId: string };
        setOrders(currentOrders.filter((o) => o.id !== orderId));
        break;
      }
      case 'document:added':
      case 'document:removed': {
        // Refetch to get updated documents
        requestCache.invalidate(cacheKey);
        break;
      }
    }
  }, [cacheKey, setOrders]);

  // Subscribe to real-time order events
  const { publish: publishRealtimeEvent } = useOrderRealtime(tenantId, handleRealtimeEvent);

  const {
    data: fetchedOrders,
    isLoading,
    isValidating,
    error,
    refetch,
    mutate,
  } = useCachedQuery<Order[]>(
    cacheKey,
    async () => {
      return await getOrdersAction();
    },
    {
      enabled: Boolean(tenantId),
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

  React.useEffect(() => {
    if (!tenantId) {
      setOrders([]);
      setTotalCount(0);
    }
  }, [tenantId, setOrders, setTotalCount]);

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
        const next = [newOrder, ...previous];
        setOrders(next);
        setTotalCount(next.length);
        requestCache.invalidate(cacheKey);
        // Broadcast to other clients
        publishRealtimeEvent('order:created', newOrder, 1);
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
        // Broadcast to other clients
        publishRealtimeEvent('order:updated', updated, 1);
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
        // Broadcast to other clients
        publishRealtimeEvent('order:status_changed', updated, 1);
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
  const deleteOrderMutation = useMutation<void, string, { previous: Order[]; deletedId: string }>(
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
        return { previous, deletedId: id };
      },
      onSuccess: (_result, _id, ctx) => {
        // Broadcast to other clients
        if (ctx?.deletedId) {
          publishRealtimeEvent('order:deleted', { orderId: ctx.deletedId }, 1);
        }
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
        requestCache.invalidate(cacheKey);
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
