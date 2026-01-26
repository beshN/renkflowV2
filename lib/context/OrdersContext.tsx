'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

// ... (existing code)

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
