<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
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

=======
'use client';

>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
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
<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  refetch: () => Promise<void>;
=======
  refresh: () => Promise<void>;
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  addOrder: (data: NewOrderFormData | FormData) => Promise<Order>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<Order>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<Order>;
  deleteOrder: (id: string) => Promise<void>;
  uploadDocuments: (id: string, formData: FormData) => Promise<void>;
  getOrderById: (id: string) => Order | undefined;
}

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
/**
 * Convert NewOrderFormData to FormData for server action compatibility
 */
=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
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
<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
    refetch: cacheRefetch,
=======
    refetch,
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
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

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  // Sync loading state with Zustand store
=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  React.useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  // Sync fetched orders with Zustand store
=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  React.useEffect(() => {
    if (!fetchedOrders) return;
    setOrders(fetchedOrders);
    setTotalCount(fetchedOrders.length);
  }, [fetchedOrders, setOrders, setTotalCount]);

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  // Add Order Mutation
=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
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

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  // Update Order Mutation with Optimistic Update
=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
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

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  // Update Status Mutation with Optimistic Update
=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
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

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  // Delete Order Mutation with Optimistic Update
=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
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

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  // Upload Documents Mutation
=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  const uploadDocumentsMutation = useMutation<void, { id: string; formData: FormData }>(
    async ({ id, formData }) => {
      await uploadOrderDocumentsAction(id, formData);
    },
    {
      onSuccess: async () => {
        requestCache.invalidate(ORDERS_CACHE_KEY);
<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
        await cacheRefetch();
=======
        await refetch();
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
      },
      onError: (err) => {
        devLog.error('[useOrders] Failed to upload documents:', err);
      },
    }
  );

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  // Exposed Methods
  const refetch = React.useCallback(async () => {
    await cacheRefetch();
  }, [cacheRefetch]);
=======
  const refresh = React.useCallback(async () => {
    await refetch();
  }, [refetch]);
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts

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

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  const getOrderById = React.useCallback(
    (id: string) => store.orders.find((o) => o.id === id),
    [store.orders]
  );

=======
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  return {
    orders,
    isLoading,
    isValidating,
    error,
<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
    refetch,
=======
    refresh,
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
    addOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    uploadDocuments,
<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
    getOrderById,
=======
    getOrderById: (id: string) => store.orders.find((o) => o.id === id),
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-fe52b22f/RenkFlow/renkflow-nextjs/lib/hooks/useOrders.ts
  };
}
