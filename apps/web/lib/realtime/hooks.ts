'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { Order } from '@/lib/types';
import { realtime } from './client';
import { conflictResolver } from './conflict-resolver';
import type {
  ConnectionInfo,
  ConflictInfo,
  ConflictResolution,
  ConflictResolutionStrategy,
  PresenceUser,
  RealtimeEvent,
  RealtimeEventType,
} from './types';

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

interface UseRealtimeOptions {
  room?: string;
  autoConnect?: boolean;
  userId?: string;
  userName?: string;
  onEvent?: (event: RealtimeEvent) => void;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
  onConnectionChange?: (connection: ConnectionInfo) => void;
}

function getConnectionInfoSnapshot(): ConnectionInfo {
  const status = realtime.connectionStatus;
  return {
    state: status.state,
    latency: status.latency,
    lastConnected: status.state === 'connected' ? Date.now() : null,
    reconnectAttempts: status.reconnectAttempts,
    socketId: status.socketId,
  };
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    room,
    autoConnect = true,
    userId,
    userName,
    onEvent,
    onPresenceUpdate,
    onConnectionChange,
  } = options;

  const [connection, setConnection] = useState<ConnectionInfo>(() => getConnectionInfoSnapshot());
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!autoConnect) return;
    realtime.connect(undefined, userId, userName);
  }, [autoConnect, userId, userName]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    const handleConnection = (nextConnection: ConnectionInfo) => {
      setConnection(nextConnection);
      onConnectionChange?.(nextConnection);
    };

    const handlePresence = (nextUsers: PresenceUser[]) => {
      setUsers(nextUsers);
      onPresenceUpdate?.(nextUsers);
    };

    if (room) {
      const unsubscribeRoom = realtime.subscribe({
        room,
        onEvent,
        onPresenceChange: handlePresence,
        onConnectionChange: (_state) => {
          handleConnection(getConnectionInfoSnapshot());
        },
      });
      unsubs.push(unsubscribeRoom);
    } else {
      unsubs.push(
        realtime.onConnectionChange((info: ConnectionInfo) => {
          handleConnection(info);
        })
      );
      unsubs.push(
        realtime.onPresenceUpdate((nextUsers) => {
          handlePresence(nextUsers);
        })
      );
    }

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [room, onEvent, onPresenceUpdate, onConnectionChange]);

  const connect = useCallback(() => {
    realtime.connect(undefined, userId, userName);
  }, [userId, userName]);

  const disconnect = useCallback(() => {
    realtime.disconnect();
  }, []);

  const publish = useCallback((type: RealtimeEventType, payload: unknown, version?: number) => {
    realtime.publish(type, payload, version);
  }, []);

  const setPresence = useCallback((updates: Partial<PresenceUser>) => {
    realtime.updatePresence(updates);
  }, []);

  const setTyping = useCallback((isTyping: boolean, entityType: string, entityId: string) => {
    realtime.setTyping(isTyping, entityType, entityId);
  }, []);

  const setCursor = useCallback((x: number, y: number, elementId?: string) => {
    realtime.setCursor(x, y, elementId);
  }, []);

  return {
    connection,
    users,
    isConnected: connection.state === 'connected',
    connect,
    disconnect,
    publish,
    setPresence,
    setTyping,
    setCursor,
  };
}

export function useChannel(room: string, options: Omit<UseRealtimeOptions, 'room'> = {}) {
  return useRealtime({ ...options, room });
}

export function useOrderRealtime(
  tenantId: string,
  onEvent?: (event: RealtimeEvent) => void
) {
  const room = useMemo(() => (tenantId ? `tenant:${tenantId}:orders` : ''), [tenantId]);
  return useRealtime({
    room: room || undefined,
    onEvent,
    autoConnect: Boolean(room),
  });
}

export function usePresence(room?: string) {
  const realtimeState = useRealtime({ room });
  return {
    users: realtimeState.users,
    isConnected: realtimeState.isConnected,
    setPresence: realtimeState.setPresence,
  };
}

export function useConflictResolution<T = unknown>() {
  const [pendingConflicts, setPendingConflicts] = useState<ConflictInfo<T>[]>([]);
  const [resolvedConflicts, setResolvedConflicts] = useState<ConflictResolution<T>[]>([]);

  const refresh = useCallback(() => {
    setPendingConflicts(conflictResolver.getPendingConflicts() as ConflictInfo<T>[]);
    setResolvedConflicts(conflictResolver.getResolvedConflicts() as ConflictResolution<T>[]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resolveConflict = useCallback(
    async (
      conflict: ConflictInfo<T>,
      strategy?: ConflictResolutionStrategy
    ): Promise<ConflictResolution<T>> => {
      const resolution = await conflictResolver.resolve(conflict, strategy);
      refresh();
      return resolution as ConflictResolution<T>;
    },
    [refresh]
  );

  const setDefaultStrategy = useCallback((strategy: ConflictResolutionStrategy) => {
    conflictResolver.setDefaultStrategy(strategy);
  }, []);

  const createConflict = useCallback(
    (
      resourceType: 'order' | 'document',
      resourceId: string,
      localData: T,
      serverData: T,
      localVersion: number,
      serverVersion: number,
      localUserId: string,
      serverUserId: string
    ): ConflictInfo<T> => {
      return conflictResolver.createConflict(
        resourceType,
        resourceId,
        localData,
        serverData,
        localVersion,
        serverVersion,
        localUserId,
        serverUserId
      );
    },
    []
  );

  return {
    pendingConflicts,
    resolvedConflicts,
    refresh,
    resolveConflict,
    setDefaultStrategy,
    createConflict,
  };
}

export function useOptimisticRealtime<T>(
  initialValue: T,
  applyEvent: (previous: T, event: RealtimeEvent) => T
) {
  const [value, setValue] = useState<T>(initialValue);

  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      setValue((previous) => applyEvent(previous, event));
    },
    [applyEvent]
  );

  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue]);

  return {
    value,
    setValue,
    handleRealtimeEvent,
    reset,
  };
}

interface TypingIndicatorEntry {
  userId: string;
  userName: string;
  startedAt: number;
}

export function useTypingIndicator(entityType: string, entityId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingIndicatorEntry[]>([]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      realtime.setTyping(isTyping, entityType, entityId);
      if (!isTyping) {
        setTypingUsers([]);
      }
    },
    [entityType, entityId]
  );

  return {
    typingUsers,
    setTyping,
  };
}

interface LiveCursor {
  userId: string;
  x: number;
  y: number;
  elementId?: string;
  updatedAt: number;
}

export function useLiveCursors() {
  const [cursors, setCursors] = useState<Record<string, LiveCursor>>({});

  const setCursor = useCallback((x: number, y: number, elementId?: string) => {
    realtime.setCursor(x, y, elementId);
    setCursors((previous) => ({
      ...previous,
      self: {
        userId: 'self',
        x,
        y,
        elementId,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  return {
    cursors: Object.values(cursors),
    setCursor,
  };
}
