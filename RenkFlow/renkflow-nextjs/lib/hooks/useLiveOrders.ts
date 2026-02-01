'use client';

/**
 * useLiveOrders - Real-time order synchronization hook
 * 
 * Features:
 * - SWR for data fetching with stale-while-revalidate
 * - WebSocket for real-time updates
 * - Optimistic updates for instant UI feedback
 * - Connection state management
 * - Auto-reconnection logic
 * - Offline support with queue
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { Order, OrderStatus } from '@/lib/types';
import { useSession } from 'next-auth/react';

// ============================================
// Types
// ============================================

interface LiveOrdersConfig {
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
  dedupingInterval?: number;
  onOrderCreated?: (order: Order) => void;
  onOrderUpdated?: (order: Order) => void;
  onOrderDeleted?: (orderId: string) => void;
  onStatusChanged?: (orderId: string, status: OrderStatus) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface WebSocketMessage {
  type: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_DELETED' | 'ORDER_STATUS_CHANGED' | 'PING' | 'PONG';
  payload?: any;
  timestamp?: number;
}

interface PendingUpdate {
  id: string;
  type: 'create' | 'update' | 'delete' | 'status';
  data: any;
  timestamp: number;
  retries: number;
}

// ============================================
// Fetcher
// ============================================

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Veri yüklenirken hata oluştu');
    throw error;
  }
  return res.json();
};

// ============================================
// Main Hook
// ============================================

export function useLiveOrders(config: LiveOrdersConfig = {}) {
  const {
    refreshInterval = 30000,
    revalidateOnFocus = true,
    dedupingInterval = 5000,
    onOrderCreated,
    onOrderUpdated,
    onOrderDeleted,
    onStatusChanged,
    onConnectionChange,
  } = config;

  const { data: session } = useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const pendingUpdatesRef = useRef<PendingUpdate[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // SWR for data fetching
  const {
    data: orders = [],
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<Order[]>(
    session ? '/api/orders' : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus,
      dedupingInterval,
      onSuccess: () => {
        setLastSyncAt(new Date());
        processPendingUpdates();
      },
      onError: (err) => {
        console.error('[useLiveOrders] Fetch error:', err);
      },
    }
  );

  // ============================================
  // WebSocket Connection
  // ============================================

  const connectWebSocket = useCallback(() => {
    if (!session?.user || wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 
      (typeof window !== 'undefined' 
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/socket`
        : '');

    if (!wsUrl) return;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[useLiveOrders] WebSocket connected');
        setIsConnected(true);
        setIsReconnecting(false);
        setConnectionError(null);
        onConnectionChange?.(true);

        // Send auth message
        wsRef.current?.send(JSON.stringify({
          type: 'AUTH',
          payload: { userId: session.user?.id },
        }));

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'PING' }));
          }
        }, 30000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (e) {
          console.error('[useLiveOrders] Failed to parse message:', e);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[useLiveOrders] WebSocket closed:', event.code);
        setIsConnected(false);
        onConnectionChange?.(false);
        clearInterval(pingIntervalRef.current);

        // Reconnect if not intentional close
        if (event.code !== 1000) {
          scheduleReconnect();
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('[useLiveOrders] WebSocket error:', event);
        setConnectionError('Bağlantı hatası');
      };
    } catch (e) {
      console.error('[useLiveOrders] Failed to connect:', e);
      setConnectionError('Bağlantı kurulamadı');
      scheduleReconnect();
    }
  }, [session, onConnectionChange]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    setIsReconnecting(true);
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = undefined;
      connectWebSocket();
    }, 5000);
  }, [connectWebSocket]);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'ORDER_CREATED':
        mutate((current) => current ? [...current, message.payload] : [message.payload], false);
        onOrderCreated?.(message.payload);
        break;

      case 'ORDER_UPDATED':
        mutate((current) => 
          current?.map(o => o.id === message.payload.id ? message.payload : o),
          false
        );
        onOrderUpdated?.(message.payload);
        break;

      case 'ORDER_DELETED':
        mutate((current) => current?.filter(o => o.id !== message.payload.id), false);
        onOrderDeleted?.(message.payload.id);
        break;

      case 'ORDER_STATUS_CHANGED':
        mutate((current) => 
          current?.map(o => o.id === message.payload.id 
            ? { ...o, status: message.payload.status } 
            : o
          ),
          false
        );
        onStatusChanged?.(message.payload.id, message.payload.status);
        break;

      case 'PONG':
        // Connection is alive
        break;
    }
  }, [mutate, onOrderCreated, onOrderUpdated, onOrderDeleted, onStatusChanged]);

  // ============================================
  // Optimistic Updates
  // ============================================

  const createOrder = useCallback(async (orderData: Partial<Order>) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticOrder = { ...orderData, id: tempId } as Order;

    // Optimistic update
    mutate((current) => current ? [...current, optimisticOrder] : [optimisticOrder], false);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) throw new Error('Failed to create order');

      const newOrder = await res.json();
      
      // Replace temp order with real one
      mutate((current) => 
        current?.map(o => o.id === tempId ? newOrder : o),
        false
      );

      return newOrder;
    } catch (e) {
      // Rollback on error
      mutate((current) => current?.filter(o => o.id !== tempId), false);
      
      // Queue for retry if offline
      if (!navigator.onLine) {
        pendingUpdatesRef.current.push({
          id: tempId,
          type: 'create',
          data: orderData,
          timestamp: Date.now(),
          retries: 0,
        });
      }
      
      throw e;
    }
  }, [mutate]);

  const updateOrder = useCallback(async (orderId: string, updates: Partial<Order>) => {
    const originalOrder = orders?.find(o => o.id === orderId);
    
    // Optimistic update
    mutate((current) => 
      current?.map(o => o.id === orderId ? { ...o, ...updates } : o),
      false
    );

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to update order');

      const updatedOrder = await res.json();
      mutate((current) => 
        current?.map(o => o.id === orderId ? updatedOrder : o),
        false
      );

      return updatedOrder;
    } catch (e) {
      // Rollback on error
      if (originalOrder) {
        mutate((current) => 
          current?.map(o => o.id === orderId ? originalOrder : o),
          false
        );
      }
      
      // Queue for retry if offline
      if (!navigator.onLine) {
        pendingUpdatesRef.current.push({
          id: orderId,
          type: 'update',
          data: updates,
          timestamp: Date.now(),
          retries: 0,
        });
      }
      
      throw e;
    }
  }, [orders, mutate]);

  const deleteOrder = useCallback(async (orderId: string) => {
    const originalOrder = orders?.find(o => o.id === orderId);
    
    // Optimistic update
    mutate((current) => current?.filter(o => o.id !== orderId), false);

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete order');
    } catch (e) {
      // Rollback on error
      if (originalOrder) {
        mutate((current) => current ? [...current, originalOrder] : [originalOrder], false);
      }
      throw e;
    }
  }, [orders, mutate]);

  const updateStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    return updateOrder(orderId, { status });
  }, [updateOrder]);

  // ============================================
  // Pending Updates Processing
  // ============================================

  const processPendingUpdates = useCallback(async () => {
    if (!navigator.onLine || pendingUpdatesRef.current.length === 0) return;

    const pending = [...pendingUpdatesRef.current];
    pendingUpdatesRef.current = [];

    for (const update of pending) {
      try {
        switch (update.type) {
          case 'create':
            await createOrder(update.data);
            break;
          case 'update':
            await updateOrder(update.id, update.data);
            break;
          case 'status':
            await updateStatus(update.id, update.data.status);
            break;
        }
      } catch (e) {
        if (update.retries < 3) {
          pendingUpdatesRef.current.push({ ...update, retries: update.retries + 1 });
        }
      }
    }
  }, [createOrder, updateOrder, updateStatus]);

  // ============================================
  // Effects
  // ============================================

  // Connect WebSocket on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      wsRef.current?.close(1000);
      clearInterval(pingIntervalRef.current);
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  // Online/offline handling
  useEffect(() => {
    const handleOnline = () => {
      connectWebSocket();
      mutate(); // Refresh data
      processPendingUpdates();
    };

    const handleOffline = () => {
      setIsConnected(false);
      onConnectionChange?.(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectWebSocket, mutate, processPendingUpdates, onConnectionChange]);

  // ============================================
  // Return
  // ============================================

  return {
    // Data
    orders,
    error,
    isLoading,
    isValidating,

    // Connection state
    isConnected,
    isReconnecting,
    lastSyncAt,
    connectionError,
    pendingUpdatesCount: pendingUpdatesRef.current.length,

    // Actions
    createOrder,
    updateOrder,
    deleteOrder,
    updateStatus,
    refresh: mutate,

    // Manual connection control
    reconnect: connectWebSocket,
    disconnect: () => wsRef.current?.close(1000),
  };
}

export default useLiveOrders;
