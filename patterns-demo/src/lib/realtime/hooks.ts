// ============================================
// REAL-TIME REACT HOOKS
// WebSocket + SSE Integration for React
// ============================================

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getWebSocketClient, createChannel, type WebSocketMessage } from './websocket';
import { SSEClient, NotificationSSEClient, type NotificationData } from './sse';
import { useAppStore } from '../store';

// ============================================
// USE WEBSOCKET HOOK
// ============================================

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true, onOpen, onClose, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef(getWebSocketClient());

  useEffect(() => {
    const client = clientRef.current;

    const unsubOpen = client.onOpen(() => {
      setIsConnected(true);
      onOpen?.();
    });

    const unsubClose = client.onClose(() => {
      setIsConnected(false);
      onClose?.();
    });

    const unsubError = onError ? client.onError(onError) : undefined;

    if (autoConnect && !client.isConnected) {
      client.connect();
    }

    return () => {
      unsubOpen();
      unsubClose();
      unsubError?.();
    };
  }, [autoConnect, onOpen, onClose, onError]);

  const send = useCallback(<T,>(type: string, payload: T) => {
    clientRef.current.send({ type, payload });
  }, []);

  const subscribe = useCallback(<T,>(type: string, handler: (msg: WebSocketMessage<T>) => void) => {
    return clientRef.current.on(type, handler);
  }, []);

  return {
    isConnected,
    send,
    subscribe,
    connect: () => clientRef.current.connect(),
    disconnect: () => clientRef.current.disconnect(),
  };
}

// ============================================
// USE CHANNEL HOOK
// ============================================

export function useChannel(channelName: string) {
  const channelRef = useRef<ReturnType<typeof createChannel> | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Create new channel when channelName changes
  if (!channelRef.current || channelRef.current.name !== channelName) {
    channelRef.current = createChannel(channelName);
  }

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    
    channel.subscribe();
    setIsSubscribed(true);

    return () => {
      channel.unsubscribe();
      setIsSubscribed(false);
    };
  }, [channelName]);

  const emit = useCallback(<T,>(event: string, payload: T) => {
    channelRef.current?.emit(event, payload);
  }, []);

  const on = useCallback(<T,>(event: string, handler: (msg: WebSocketMessage<T>) => void) => {
    return channelRef.current?.on(event, handler) ?? (() => {});
  }, []);

  return { isSubscribed, emit, on };
}

// ============================================
// USE SSE HOOK
// ============================================

interface UseSSEOptions {
  url: string;
  withCredentials?: boolean;
  autoConnect?: boolean;
  onOpen?: () => void;
  onError?: (error: Event) => void;
}

export function useSSE<T = unknown>(eventType: string, options: UseSSEOptions) {
  const { url, withCredentials = true, autoConnect = true, onOpen, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<SSEClient | null>(null);

  useEffect(() => {
    const client = new SSEClient({
      url,
      withCredentials,
      reconnect: true,
    });

    clientRef.current = client;

    const unsubOpen = client.onOpen(() => {
      setIsConnected(true);
      onOpen?.();
    });

    const unsubError = onError ? client.onError(onError) : undefined;

    const unsubEvent = client.on<T>(eventType, (eventData) => {
      setData(eventData);
    });

    if (autoConnect) {
      client.connect();
    }

    return () => {
      unsubOpen();
      unsubError?.();
      unsubEvent();
      client.disconnect();
    };
  }, [url, eventType, withCredentials, autoConnect, onOpen, onError]);

  return {
    data,
    isConnected,
    connect: () => clientRef.current?.connect(),
    disconnect: () => clientRef.current?.disconnect(),
  };
}

// ============================================
// USE NOTIFICATIONS HOOK
// ============================================

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<NotificationSSEClient | null>(null);
  const addStoreNotification = useAppStore((s) => s.addNotification);

  useEffect(() => {
    if (!userId) return;

    const client = new NotificationSSEClient(userId);
    clientRef.current = client;

    client.onOpen(() => setIsConnected(true));

    client.onNotification((notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Also add to global store for toast display
      addStoreNotification({
        type: notification.type,
        message: notification.title,
      });
    });

    client.connect();

    return () => {
      client.disconnect();
    };
  }, [userId, addStoreNotification]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
}

// ============================================
// USE PRESENCE HOOK
// ============================================

interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy';
  lastSeen: number;
}

export function usePresence(channelName: string, currentUser: { id: string; name: string; avatar?: string }) {
  const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map());
  const { isSubscribed, emit, on } = useChannel(`presence:${channelName}`);
  
  // Stable references for currentUser properties
  const userIdRef = useRef(currentUser.id);
  const userNameRef = useRef(currentUser.name);
  const userAvatarRef = useRef(currentUser.avatar);
  
  // Update refs when props change
  useEffect(() => {
    userIdRef.current = currentUser.id;
    userNameRef.current = currentUser.name;
    userAvatarRef.current = currentUser.avatar;
  }, [currentUser.id, currentUser.name, currentUser.avatar]);

  useEffect(() => {
    if (!isSubscribed) return;

    // Announce presence
    emit('join', {
      id: userIdRef.current,
      name: userNameRef.current,
      avatar: userAvatarRef.current,
      status: 'online',
    });

    // Listen for presence updates
    const unsubJoin = on<PresenceUser>('join', (msg) => {
      setUsers((prev) => new Map(prev).set(msg.payload.id, {
        ...msg.payload,
        lastSeen: Date.now(),
      }));
    });

    const unsubLeave = on<{ id: string }>('leave', (msg) => {
      setUsers((prev) => {
        const next = new Map(prev);
        next.delete(msg.payload.id);
        return next;
      });
    });

    const unsubStatus = on<{ id: string; status: PresenceUser['status'] }>('status', (msg) => {
      setUsers((prev) => {
        const user = prev.get(msg.payload.id);
        if (!user) return prev;
        return new Map(prev).set(msg.payload.id, {
          ...user,
          status: msg.payload.status,
          lastSeen: Date.now(),
        });
      });
    });

    // Cleanup on unmount
    return () => {
      emit('leave', { id: userIdRef.current });
      unsubJoin();
      unsubLeave();
      unsubStatus();
    };
  }, [isSubscribed, emit, on]);

  const updateStatus = useCallback((status: PresenceUser['status']) => {
    emit('status', { id: currentUser.id, status });
  }, [currentUser.id, emit]);

  return {
    users: Array.from(users.values()),
    onlineCount: users.size,
    updateStatus,
  };
}

// ============================================
// USE LIVE UPDATES HOOK
// ============================================

interface LiveUpdateOptions<T> {
  channel: string;
  event: string;
  onUpdate?: (data: T) => void;
}

export function useLiveUpdates<T>(initialData: T, options: LiveUpdateOptions<T>) {
  const { channel, event, onUpdate } = options;
  const [data, setData] = useState<T>(initialData);
  const { on } = useChannel(channel);

  useEffect(() => {
    const unsub = on<T>(event, (msg) => {
      setData(msg.payload);
      onUpdate?.(msg.payload);
    });

    return unsub;
  }, [channel, event, on, onUpdate]);

  return data;
}

// ============================================
// USE TYPING INDICATOR HOOK
// ============================================

export function useTypingIndicator(channelName: string, userId: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const { emit, on } = useChannel(channelName);
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const unsubTyping = on<{ userId: string; isTyping: boolean }>('typing', (msg) => {
      const { userId: typingUserId, isTyping } = msg.payload;
      
      // Clear existing timeout
      const existingTimeout = typingTimeoutRef.current.get(typingUserId);
      if (existingTimeout) clearTimeout(existingTimeout);

      if (isTyping) {
        setTypingUsers((prev) => new Set(prev).add(typingUserId));
        
        // Auto-remove after 3 seconds
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(typingUserId);
            return next;
          });
        }, 3000);
        
        typingTimeoutRef.current.set(typingUserId, timeout);
      } else {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(typingUserId);
          return next;
        });
      }
    });

    return () => {
      unsubTyping();
      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, [on]);

  const startTyping = useCallback(() => {
    emit('typing', { userId, isTyping: true });
  }, [emit, userId]);

  const stopTyping = useCallback(() => {
    emit('typing', { userId, isTyping: false });
  }, [emit, userId]);

  return {
    typingUsers: Array.from(typingUsers).filter((id) => id !== userId),
    startTyping,
    stopTyping,
  };
}
