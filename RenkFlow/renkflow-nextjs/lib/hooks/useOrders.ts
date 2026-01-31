/**
 * useOrders Hook - Zustand + Optimistic Updates
 * 
 * Features:
 * - Single source of truth: Zustand store
 * - Optimistic updates with rollback
 * - No Context dependency
 * - Server Actions integration
 */

'use client';

import { useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Order } from '@/lib/types';
import { useOrdersStore } from '@/lib/stores/orders.store';
import {
  getOrdersAction,
  createOrderAction,
  updateOrderAction,
  updateOrderStatusAction,
  deleteOrderAction,
} from '@/app/actions/order.actions';

export interface UseOrdersResult {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addOrder: (data: FormData) => Promise<Order>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<Order>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<Order>;
  deleteOrder: (id: string) => Promise<void>;
  getOrderById: (id: string) => Order | undefined;
}

export function useOrders(): UseOrdersResult {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  // Zustand store selectors
  const orders = useOrdersStore((state) => state.orders);
  const isLoading = useOrdersStore((state) => state.isLoading);
  const error = useOrdersStore((state) => state.error);
  const setOrders = useOrdersStore((state) => state.setOrders);
  const setLoading = useOrdersStore((state) => state.setLoading);
  const setError = useOrdersStore((state) => state.setError);
  const addOrderToStore = useOrdersStore((state) => state.addOrder);
  const updateOrderInStore = useOrdersStore((state) => state.updateOrder);
  const removeOrderFromStore = useOrdersStore((state) => state.removeOrder);

  // Fetch orders
  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const data = await getOrdersAction();
      setOrders(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(errorMessage);
      console.error('[useOrders] Fetch error:', err);
    }
  }, [isAuthenticated, setOrders, setLoading, setError]);

  // Initial fetch
  useEffect(() => {
    if (status !== 'loading') {
      refetch();
    }
  }, [refetch, status]);

  // Add order
  const addOrder = useCallback(async (formData: FormData): Promise<Order> => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      const order = await createOrderAction(formData);
      addOrderToStore(order);
      return order;
    } catch (err) {
      console.error('[useOrders] Create error:', err);
      throw err;
    }
  }, [isAuthenticated, addOrderToStore]);

  // Update order with optimistic update
  const updateOrder = useCallback(async (
    id: string, 
    updates: Partial<Order>
  ): Promise<Order> => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    // Store previous state for rollback
    const previousOrder = orders.find((o) => o.id === id);
    if (!previousOrder) {
      throw new Error('Order not found');
    }

    // Optimistic update
    updateOrderInStore(id, updates);

    try {
      const updatedOrder = await updateOrderAction(id, updates);
      return updatedOrder;
    } catch (err) {
      // Rollback on error
      updateOrderInStore(id, previousOrder);
      console.error('[useOrders] Update error:', err);
      throw err;
    }
  }, [isAuthenticated, orders, updateOrderInStore]);

  // Update order status with optimistic update
  const updateOrderStatus = useCallback(async (
    id: string, 
    status: Order['status']
  ): Promise<Order> => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    // Store previous state for rollback
    const previousOrder = orders.find((o) => o.id === id);
    if (!previousOrder) {
      throw new Error('Order not found');
    }

    // Optimistic update (no refresh() call - prevents UI flash)
    updateOrderInStore(id, { status });

    try {
      const updatedOrder = await updateOrderStatusAction(id, status);
      return updatedOrder;
    } catch (err) {
      // Rollback on error
      updateOrderInStore(id, { status: previousOrder.status });
      console.error('[useOrders] Status update error:', err);
      throw err;
    }
  }, [isAuthenticated, orders, updateOrderInStore]);

  // Delete order with optimistic update
  const deleteOrder = useCallback(async (id: string): Promise<void> => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    // Store previous state for rollback
    const previousOrder = orders.find((o) => o.id === id);
    if (!previousOrder) {
      throw new Error('Order not found');
    }

    // Optimistic update
    removeOrderFromStore(id);

    try {
      await deleteOrderAction(id);
    } catch (err) {
      // Rollback on error - restore the order
      addOrderToStore(previousOrder);
      console.error('[useOrders] Delete error:', err);
      throw err;
    }
  }, [isAuthenticated, orders, removeOrderFromStore, addOrderToStore]);

  // Get order by ID
  const getOrderById = useCallback((id: string) => {
    return orders.find((o) => o.id === id);
  }, [orders]);

  return {
    orders,
    isLoading,
    error,
    refetch,
    addOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    getOrderById,
  };
}
