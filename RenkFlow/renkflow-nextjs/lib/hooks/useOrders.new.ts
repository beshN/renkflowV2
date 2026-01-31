'use client';

import React from 'react';
import { useCachedQuery, useMutation, optimisticUpdate, requestCache } from '@/lib/api/request-layer';
import { Order, NewOrderFormData } from '@/lib/types';
import { orderService } from '@/lib/services';
import { devLog } from '@/lib/utils/logger';

/**
 * Production-Ready Orders Hook
 * - Cached data fetching with SWR pattern
 * - Optimistic updates with rollback
 * - Request deduplication
 * - Type-safe mutations
 */

const ORDERS_CACHE_KEY = 'orders';
const ORDER_CACHE_KEY = (id: string) => `order-${id}`;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface UseOrdersResult {
  orders: Order[];
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addOrder: (data: FormData) => Promise<Order>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<Order>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<Order>;
  deleteOrder: (id: string) => Promise<void>;
}

export function useOrders(): UseOrdersResult {
  // Cached query for orders list
  const {
    data: orders,
    isLoading,
    isValidating,
    error,
    refetch,
    mutate,
  } = useCachedQuery<Order[]>(
    ORDERS_CACHE_KEY,
    () => orderService.getOrders(),
    {
      cacheTTL: CACHE_TTL,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      onError: (err) => {
        devLog.error('[useOrders] Failed to fetch orders:', err);
      },
    }
  );

  // Add order mutation with optimistic update
  const addOrderMutation = useMutation<Order, FormData>(
    async (formData) => {
      const data: NewOrderFormData = {
        customerName: formData.get('customerName') as string,
        email: (formData.get('email') as string) || undefined,
        phone: (formData.get('phone') as string) || undefined,
        productName: formData.get('productName') as string,
        quantity: parseInt(formData.get('quantity') as string) || 1,
        totalAmount: parseFloat(formData.get('totalAmount') as string) || 0,
        currency: (formData.get('currency') as string) || '₺',
        deliveryDate: (formData.get('deliveryDate') as string) || undefined,
        notes: (formData.get('notes') as string) || undefined,
        documents: [],
      };

      const files = formData.getAll('files') as File[];
      return orderService.createOrder(data, files.length > 0 ? files : undefined);
    },
    {
      onSuccess: (newOrder) => {
        devLog.info('[useOrders] Order created:', newOrder.id);
        // Invalidate and refetch
        requestCache.invalidate(ORDERS_CACHE_KEY);
        refetch();
      },
      onError: (err) => {
        devLog.error('[useOrders] Failed to create order:', err);
      },
    }
  );

  // Update order mutation with optimistic update
  const updateOrderMutation = useMutation<Order, { id: string; updates: Partial<Order> }, { previousOrders: Order[] }>(
    async ({ id, updates }) => {
      return orderService.updateOrder(id, updates);
    },
    {
      onMutate: async ({ id, updates }) => {
        // Optimistic update
        const currentOrders = orders || [];
        const optimisticOrders = currentOrders.map((order) =>
          order.id === id ? { ...order, ...updates } : order
        );
        mutate(optimisticOrders);
        return { previousOrders: currentOrders };
      },
      onSuccess: (updatedOrder) => {
        devLog.info('[useOrders] Order updated:', updatedOrder.id);
        requestCache.invalidate(ORDER_CACHE_KEY(updatedOrder.id));
      },
      onError: (err, variables, context: { previousOrders?: Order[] } | undefined) => {
        devLog.error('[useOrders] Failed to update order:', err);
        // Rollback
        if (context?.previousOrders) {
          mutate(context.previousOrders);
        }
      },
    }
  );

  // Update status mutation
  const updateStatusMutation = useMutation<Order, { id: string; status: Order['status'] }, { previousOrders: Order[] }>(
    async ({ id, status }) => {
      return orderService.updateOrderStatus(id, status);
    },
    {
      onMutate: async ({ id, status }) => {
        const currentOrders = orders || [];
        const optimisticOrders = currentOrders.map((order) =>
          order.id === id ? { ...order, status } : order
        );
        mutate(optimisticOrders);
        return { previousOrders: currentOrders };
      },
      onSuccess: (updatedOrder) => {
        devLog.info('[useOrders] Order status updated:', updatedOrder.id, updatedOrder.status);
      },
      onError: (err, variables, context: { previousOrders?: Order[] } | undefined) => {
        devLog.error('[useOrders] Failed to update status:', err);
        if (context?.previousOrders) {
          mutate(context.previousOrders);
        }
      },
    }
  );

  // Delete order mutation with optimistic update
  const deleteOrderMutation = useMutation<void, string, { previousOrders: Order[] }>(
    async (id) => {
      return orderService.deleteOrder(id);
    },
    {
      onMutate: async (id) => {
        const currentOrders = orders || [];
        const optimisticOrders = currentOrders.filter((order) => order.id !== id);
        mutate(optimisticOrders);
        return { previousOrders: currentOrders };
      },
      onSuccess: () => {
        devLog.info('[useOrders] Order deleted');
      },
      onError: (err, id, context: { previousOrders?: Order[] } | undefined) => {
        devLog.error('[useOrders] Failed to delete order:', err);
        if (context?.previousOrders) {
          mutate(context.previousOrders);
        }
      },
    }
  );

  // Memoized action handlers
  const addOrder = React.useCallback(
    async (formData: FormData): Promise<Order> => {
      return addOrderMutation.mutateAsync(formData);
    },
    [addOrderMutation]
  );

  const updateOrder = React.useCallback(
    async (id: string, updates: Partial<Order>): Promise<Order> => {
      return updateOrderMutation.mutateAsync({ id, updates });
    },
    [updateOrderMutation]
  );

  const updateOrderStatus = React.useCallback(
    async (id: string, status: Order['status']): Promise<Order> => {
      return updateStatusMutation.mutateAsync({ id, status });
    },
    [updateStatusMutation]
  );

  const deleteOrder = React.useCallback(
    async (id: string): Promise<void> => {
      return deleteOrderMutation.mutateAsync(id);
    },
    [deleteOrderMutation]
  );

  return {
    orders: orders || [],
    isLoading,
    isValidating,
    error,
    refetch,
    addOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
  };
}

/**
 * Hook for fetching a single order by ID
 */
export function useOrder(id: string | null) {
  return useCachedQuery<Order | null>(
    id ? ORDER_CACHE_KEY(id) : null,
    () => (id ? orderService.getOrderById(id) : Promise.resolve(null)),
    {
      cacheTTL: CACHE_TTL,
      enabled: !!id,
    }
  );
}
