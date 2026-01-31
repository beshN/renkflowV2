'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Order, NewOrderFormData } from '@/lib/types';
import { MockOrderService } from '@/lib/services/mock/order.mock';
import { 
  getOrdersAction, 
  createOrderAction, 
  updateOrderAction, 
  updateOrderStatusAction, 
  deleteOrderAction 
} from '@/app/actions/order.actions';

interface OrdersContextType {
  orders: Order[];
  addOrder: (order: NewOrderFormData | FormData) => Promise<void>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
  uploadDocuments: (id: string, formData: FormData) => Promise<void>;
  refresh: () => Promise<void>;
  isLoading: boolean;
  getOrderById: (id: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

// Determine if we should use the database (via Server Actions) or Mock (Client)
const USE_DATABASE = process.env.NEXT_PUBLIC_USE_DATABASE === 'true';
const mockService = new MockOrderService();

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  const refresh = useCallback(async () => {
    // Only fetch orders if user is authenticated
    if (!isAuthenticated) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      if (USE_DATABASE) {
        const data = await getOrdersAction().catch(err => {
          console.warn('Failed to fetch orders:', err);
          return null;
        });
        setOrders(data || []);
      } else {
        const data = await mockService.getOrders();
        setOrders(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Only fetch when authentication status is determined (not loading)
    if (status !== 'loading') {
      refresh();
    }
  }, [refresh, status]);

  const addOrder = async (data: NewOrderFormData | FormData) => {
    if (!isAuthenticated) {
      console.warn('Cannot add order: User not authenticated');
      return;
    }

    if (data instanceof FormData) {
      if (USE_DATABASE) {
        await createOrderAction(data);
      } else {
        // Convert FormData to NewOrderFormData for mock service
        const files = data.getAll('files') as File[];
        const formData: NewOrderFormData = {
          customerName: data.get('customerName') as string,
          email: data.get('email') as string || undefined,
          phone: data.get('phone') as string || undefined,
          productName: data.get('productName') as string,
          quantity: parseInt(data.get('quantity') as string),
          totalAmount: parseFloat(data.get('totalAmount') as string) || 0,
          currency: (data.get('currency') as string) || '₺',
          deliveryDate: data.get('deliveryDate') as string || undefined,
          notes: data.get('notes') as string || undefined,
          documents: files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            url: URL.createObjectURL(file),
            size: file.size,
            uploadedAt: new Date().toISOString(),
          })),
        };
        await mockService.createOrder(formData, files);
      }
    } else {
      // Legacy support for NewOrderFormData object
      if (USE_DATABASE) {
        // Convert object to FormData
        const formData = new FormData();
        formData.append('customerName', data.customerName);
        if (data.email) formData.append('email', data.email);
        if (data.phone) formData.append('phone', data.phone);
        formData.append('productName', data.productName);
        formData.append('quantity', data.quantity.toString());
        formData.append('totalAmount', data.totalAmount.toString());
        formData.append('currency', data.currency || '₺');
        if (data.deliveryDate) formData.append('deliveryDate', data.deliveryDate);
        if (data.notes) formData.append('notes', data.notes);
        // Cannot append files as we don't have File objects here
        await createOrderAction(formData);
      } else {
        await mockService.createOrder(data);
      }
    }
    await refresh();
  };

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    if (!isAuthenticated) {
      console.warn('Cannot update order: User not authenticated');
      return;
    }

    if (USE_DATABASE) {
      await updateOrderAction(id, updates);
    } else {
      await mockService.updateOrder(id, updates);
    }
    await refresh();
  };

  const deleteOrder = async (id: string) => {
    if (!isAuthenticated) {
      console.warn('Cannot delete order: User not authenticated');
      return;
    }

    if (USE_DATABASE) {
      await deleteOrderAction(id);
    } else {
      await mockService.deleteOrder(id);
    }
    await refresh();
  };

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    if (!isAuthenticated) {
      console.warn('Cannot update order status: User not authenticated');
      return;
    }

    // Optimistic Update: Update local state immediately
    const previousOrders = [...orders];
    setOrders(currentOrders => 
      currentOrders.map(order => 
        order.id === id ? { ...order, status } : order
      )
    );

    try {
      if (USE_DATABASE) {
        await updateOrderStatusAction(id, status);
      } else {
        await mockService.updateOrderStatus(id, status);
      }
      refresh();
    } catch (error) {
      console.error('Failed to update order status:', error);
      setOrders(previousOrders);
      throw error;
    }
  };

  const uploadDocuments = async (id: string, formData: FormData) => {
    if (!isAuthenticated) {
      console.warn('Cannot upload documents: User not authenticated');
      return;
    }

    if (USE_DATABASE) {
        // Dynamic import to avoid circular dependencies if any, or just import action
        const { uploadOrderDocumentsAction } = await import('@/app/actions/order.actions');
        await uploadOrderDocumentsAction(id, formData);
    } else {
        const files = formData.getAll('files') as File[];
        await mockService.addDocuments(id, files);
    }
    await refresh();
  };

  return (
    <OrdersContext.Provider value={{ 
      orders, 
      addOrder, 
      updateOrder, 
      deleteOrder, 
      updateOrderStatus,
      uploadDocuments,
      refresh,
      isLoading,
      getOrderById: (id: string) => orders.find(o => o.id === id)
    }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrdersContext() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrdersContext must be used within an OrdersProvider');
  }
  return context;
}
