'use client';

import React from 'react';
import { realtime as wsClient } from './client';
import { conflictResolver } from './conflict-resolver';
import {
  ConnectionInfo,
  PresenceState,
  PresenceUser,
  RealtimeEvent,
  RealtimeEventType,
  ConflictInfo,
  ConflictResolution,
} from './types';

/**
 * React Hooks for Real-Time Features
 */

// ============================================
// Connection Hook
// ============================================

interface UseRealtimeConfig {
  url?: string;
  token: string;
  tenantId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}

interface UseRealtimeResult {
  isConnected: boolean;
  connectionInfo: ConnectionInfo;
  connect: () => void;
  disconnect: () => void;
}

export function useRealtime(config: UseRealtimeConfig): UseRealtimeResult {
  const [connectionInfo, setConnectionInfo] = React.useState<ConnectionInfo>({
    state: 'disconnected',
    latency: 0,
    lastConnected: null,
    reconnectAttempts: 0,
    socketId: null,
  });

  const connect = React.useCallback(() => {
    wsClient.connect(config.url, config.userId, config.userName);
  }, [config]);

  const disconnect = React.useCallback(() => {
    wsClient.disconnect();
  }, []);

  React.useEffect(() => {
    const unsubscribe = wsClient.onConnectionChange(setConnectionInfo);

    // Auto-connect on mount
    connect();

    return () => {
      unsubscribe();
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: connectionInfo.state === 'connected',
    connectionInfo,
    connect,
    disconnect,
  };
}

// ============================================
// Channel Subscription Hook
// ============================================

interface UseChannelOptions<T> {
  onEvent?: (event: RealtimeEvent<T>) => void;
  eventTypes?: RealtimeEventType[];
}

export function useChannel<T = unknown>(
  channel: string,
  options: UseChannelOptions<T> = {}
): void {
  const { onEvent, eventTypes } = options;

  React.useEffect(() => {
    const handleEvent = (event: RealtimeEvent) => {
      // Filter by event type if specified
      if (eventTypes && !eventTypes.includes(event.type)) {
        return;
      }

      onEvent?.(event as RealtimeEvent<T>);
    };

    const unsubscribe = wsClient.subscribe({ room: channel, onEvent: handleEvent });

    return () => {
      unsubscribe();
    };
  }, [channel, onEvent, eventTypes]);
}

// ============================================
// Order Realtime Hook
// ============================================

interface UseOrderRealtimeResult {
  publish: (eventType: RealtimeEventType, payload: unknown, version: number) => void;
  setViewing: (orderId: string | null) => void;
}

export function useOrderRealtime(
  tenantId: string,
  onOrderEvent?: (event: RealtimeEvent) => void
): UseOrderRealtimeResult {
  const channel = `tenant:${tenantId}:orders`;

  useChannel(channel, {
    onEvent: onOrderEvent,
    eventTypes: [
      'order:created',
      'order:updated',
      'order:deleted',
      'order:status_changed',
      'document:added',
      'document:removed',
    ],
  });

  const publish = React.useCallback(
    (eventType: RealtimeEventType, payload: unknown, version: number) => {
      wsClient.join(channel);
      wsClient.publish(eventType, payload, version);
    },
    [channel]
  );

  const setViewing = React.useCallback((orderId: string | null) => {
    wsClient.setViewingOrder(orderId);
  }, []);

  return { publish, setViewing };
}

// ============================================
// Presence Hook
// ============================================

interface UsePresenceResult {
  users: PresenceUser[];
  typingUsers: string[];
  viewingOrder: (orderId: string) => string[];
  setTyping: (isTyping: boolean) => void;
  updateStatus: (status: PresenceUser['status']) => void;
}

export function usePresence(): UsePresenceResult {
  const [presence, setPresence] = React.useState<PresenceState>({
    users: new Map(),
    typingUsers: new Set(),
    viewingOrders: new Map(),
  });

  React.useEffect(() => {
    const handlePresenceUpdate = (users: PresenceUser[]) => {
      setPresence(prev => ({
        ...prev,
        users: new Map(users.map(u => [u.id, u])),
      }));
    };
    const unsubscribe = wsClient.onPresenceUpdate(handlePresenceUpdate);
    return unsubscribe;
  }, []);

  const users = React.useMemo(() => {
    return Array.from(presence.users.values());
  }, [presence.users]);

  const typingUsers = React.useMemo(() => {
    return Array.from(presence.typingUsers);
  }, [presence.typingUsers]);

  const viewingOrder = React.useCallback(
    (orderId: string) => {
      return Array.from(presence.viewingOrders.get(orderId) || []);
    },
    [presence.viewingOrders]
  );

  const setTyping = React.useCallback((isTyping: boolean) => {
    wsClient.setTyping(isTyping, 'order', '');
  }, []);

  const updateStatus = React.useCallback((status: PresenceUser['status']) => {
    wsClient.updatePresence({ status });
  }, []);

  return {
    users,
    typingUsers,
    viewingOrder,
    setTyping,
    updateStatus,
  };
}

// ============================================
// Conflict Resolution Hook
// ============================================

interface UseConflictResolutionResult<T> {
  pendingConflicts: ConflictInfo<T>[];
  resolveConflict: (
    conflict: ConflictInfo<T>,
    strategy?: 'last-write-wins' | 'first-write-wins' | 'merge' | 'manual'
  ) => Promise<ConflictResolution<T>>;
  resolveWithData: (conflict: ConflictInfo<T>, data: T) => ConflictResolution<T>;
}

export function useConflictResolution<T>(): UseConflictResolutionResult<T> {
  const [pendingConflicts, setPendingConflicts] = React.useState<ConflictInfo<T>[]>([]);

  // Update pending conflicts
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPendingConflicts(conflictResolver.getPendingConflicts() as ConflictInfo<T>[]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const resolveConflict = React.useCallback(
    async (
      conflict: ConflictInfo<T>,
      strategy?: 'last-write-wins' | 'first-write-wins' | 'merge' | 'manual'
    ) => {
      return conflictResolver.resolve(conflict, strategy);
    },
    []
  );

  const resolveWithData = React.useCallback(
    (conflict: ConflictInfo<T>, data: T): ConflictResolution<T> => {
      return {
        conflictId: conflict.id,
        strategy: 'manual',
        resolvedData: data,
        resolvedBy: 'user',
        resolvedAt: Date.now(),
      };
    },
    []
  );

  return {
    pendingConflicts,
    resolveConflict,
    resolveWithData,
  };
}

// ============================================
// Optimistic Update with Conflict Detection
// ============================================

interface UseOptimisticRealtimeOptions<T> {
  resourceType: 'order' | 'document';
  resourceId: string;
  currentData: T;
  currentVersion: number;
  userId: string;
  onConflict?: (conflict: ConflictInfo<T>) => void;
}

interface UseOptimisticRealtimeResult<T> {
  optimisticData: T;
  version: number;
  update: (newData: Partial<T>) => void;
  hasConflict: boolean;
  conflict: ConflictInfo<T> | null;
}

export function useOptimisticRealtime<T extends { version?: number; updatedAt?: number; updatedBy?: string }>(
  options: UseOptimisticRealtimeOptions<T>
): UseOptimisticRealtimeResult<T> {
  const { resourceType, resourceId, currentData, currentVersion, userId, onConflict } = options;

  const [optimisticData, setOptimisticData] = React.useState<T>(currentData);
  const [version, setVersion] = React.useState(currentVersion);
  const [conflict, setConflict] = React.useState<ConflictInfo<T> | null>(null);

  // Sync with server data
  React.useEffect(() => {
    // Check for conflict
    if (currentVersion > version) {
      const hasConflict = conflictResolver.hasConflict(
        { ...optimisticData, version, updatedAt: Date.now(), updatedBy: userId },
        { ...currentData, version: currentVersion, updatedAt: Date.now(), updatedBy: 'server' }
      );

      if (hasConflict) {
        const conflictInfo = conflictResolver.createConflict(
          resourceType,
          resourceId,
          optimisticData,
          currentData,
          version,
          currentVersion,
          userId,
          'server'
        );
        setConflict(conflictInfo);
        onConflict?.(conflictInfo);
      } else {
        // No conflict, update to server version
        setOptimisticData(currentData);
        setVersion(currentVersion);
      }
    }
  }, [currentData, currentVersion, optimisticData, version, resourceType, resourceId, userId, onConflict]);

  const update = React.useCallback((newData: Partial<T>) => {
    setOptimisticData((prev) => ({ ...prev, ...newData }));
    setVersion((prev) => prev + 1);
  }, []);

  return {
    optimisticData,
    version,
    update,
    hasConflict: conflict !== null,
    conflict,
  };
}

// ============================================
// Typing Indicator Hook
// ============================================

interface UseTypingIndicatorResult {
  isTyping: boolean;
  startTyping: () => void;
  stopTyping: () => void;
}

export function useTypingIndicator(debounceMs: number = 2000): UseTypingIndicatorResult {
  const [isTyping, setIsTyping] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const startTyping = React.useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      wsClient.setTyping(true, 'order', '');
    }

    // Reset timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      wsClient.setTyping(false, 'order', '');
    }, debounceMs);
  }, [isTyping, debounceMs]);

  const stopTyping = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsTyping(false);
    wsClient.setTyping(false, 'order', '');
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isTyping, startTyping, stopTyping };
}

// ============================================
// Live Cursors Hook (for collaborative editing)
// ============================================

interface CursorPosition {
  x: number;
  y: number;
  userId: string;
  userName: string;
  color: string;
}

interface UseLiveCursorsResult {
  cursors: CursorPosition[];
  updateCursor: (x: number, y: number) => void;
}

export function useLiveCursors(channel: string): UseLiveCursorsResult {
  const [cursors, setCursors] = React.useState<CursorPosition[]>([]);

  useChannel<CursorPosition>(channel, {
    onEvent: (event) => {
      if (event.type === 'user:viewing') {
        const cursor = event.payload;
        setCursors((prev) => {
          const filtered = prev.filter((c) => c.userId !== cursor.userId);
          return [...filtered, cursor];
        });
      }
    },
  });

  const updateCursor = React.useCallback(
    (x: number, y: number) => {
      wsClient.join(channel);
      wsClient.publish('user:viewing' as any, { x, y }, 0);
    },
    [channel]
  );

  // Remove stale cursors
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCursors((prev) => prev.filter((c) => Date.now() - (c as any).timestamp < 5000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { cursors, updateCursor };
}
