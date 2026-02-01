'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { Order } from '@/lib/types';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
  }
}

interface SocketEvents {
  'order:updated': (data: {
    orderId: string;
    status: Order['status'];
    updates: Partial<Order>;
    updatedBy: string;
    timestamp: string;
  }) => void;
  'order:created': (data: {
    order: Order;
    createdBy: string;
    timestamp: string;
  }) => void;
  'order:deleted': (data: {
    orderId: string;
    deletedBy: string;
    timestamp: string;
  }) => void;
  'order:statusChanged': (data: {
    orderId: string;
    oldStatus: Order['status'];
    newStatus: Order['status'];
    changedBy: string;
    timestamp: string;
  }) => void;
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'connect_error': (error: Error) => void;
}

interface UseSocketOptions {
  onOrderUpdated?: (data: SocketEvents['order:updated']) => void;
  onOrderCreated?: (data: SocketEvents['order:created']) => void;
  onOrderDeleted?: (data: SocketEvents['order:deleted']) => void;
  onOrderStatusChanged?: (data: SocketEvents['order:statusChanged']) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  const {
    onOrderUpdated,
    onOrderCreated,
    onOrderDeleted,
    onOrderStatusChanged,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  // Initialize socket connection
  useEffect(() => {
    if (!session?.accessToken) return;

    const socket = io(process.env.NEXT_PUBLIC_APP_URL || '', {
      path: '/api/socket',
      auth: {
        token: session.accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
      setConnectionError(null);
      onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
      onDisconnect?.(reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      setConnectionError(error);
      onError?.(error);
    });

    // Order events
    socket.on('order:updated', (data) => {
      console.log('[Socket] Order updated:', data);
      onOrderUpdated?.(data);
    });

    socket.on('order:created', (data) => {
      console.log('[Socket] Order created:', data);
      onOrderCreated?.(data);
    });

    socket.on('order:deleted', (data) => {
      console.log('[Socket] Order deleted:', data);
      onOrderDeleted?.(data);
    });

    socket.on('order:statusChanged', (data) => {
      console.log('[Socket] Order status changed:', data);
      onOrderStatusChanged?.(data);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.accessToken, onOrderUpdated, onOrderCreated, onOrderDeleted, onOrderStatusChanged, onConnect, onDisconnect, onError]);

  // Emit functions
  const emitOrderUpdate = useCallback((orderId: string, status: Order['status'], updates: Partial<Order>) => {
    socketRef.current?.emit('order:update', { orderId, status, updates });
  }, []);

  const emitOrderCreate = useCallback((order: Order) => {
    socketRef.current?.emit('order:create', order);
  }, []);

  const emitOrderDelete = useCallback((orderId: string) => {
    socketRef.current?.emit('order:delete', { orderId });
  }, []);

  const emitStatusChange = useCallback((orderId: string, oldStatus: Order['status'], newStatus: Order['status']) => {
    socketRef.current?.emit('order:statusChange', { orderId, oldStatus, newStatus });
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    emitOrderUpdate,
    emitOrderCreate,
    emitOrderDelete,
    emitStatusChange,
  };
}
