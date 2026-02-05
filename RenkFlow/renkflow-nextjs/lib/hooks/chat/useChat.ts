'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/lib/context/AuthContext';
import { devLog } from '@/lib/utils/logger';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  isAdmin: boolean;
}

interface UseChatResult {
  messages: Message[];
  isConnected: boolean;
  sendMessage: (text: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isTyping: boolean;
}

type ChatTransportMode = 'ai' | 'socket';

const SUPPORT_SOCKET_URL =
  process.env.NEXT_PUBLIC_SUPPORT_SOCKET_URL ||
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  '';

const SUPPORT_SOCKET_PATH =
  process.env.NEXT_PUBLIC_SUPPORT_SOCKET_PATH ||
  // Express Socket.IO default path
  '/socket.io';

export function useChat(): UseChatResult {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState<ChatTransportMode>('ai');
  const socketFallbackTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Initialize socket connection
  useEffect(() => {
    if (!user || !isOpen) return;

    const cleanupTimers = () => {
      if (socketFallbackTimerRef.current) {
        clearTimeout(socketFallbackTimerRef.current);
        socketFallbackTimerRef.current = undefined;
      }
    };

    // If no socket server is configured, use AI (HTTP) mode immediately.
    // This prevents the UI from being stuck at "Bağlanıyor..." forever.
    if (!SUPPORT_SOCKET_URL) {
      setMode('ai');
      setIsConnected(true);
      cleanupTimers();
      setSocket(null);
      return () => cleanupTimers();
    }

    setMode('socket');
    setIsConnected(false);

    const socketInstance = io(SUPPORT_SOCKET_URL, {
      path: SUPPORT_SOCKET_PATH,
      addTrailingSlash: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 2,
      timeout: 5000,
    });

    const fallbackToAI = (reason: string) => {
      devLog.warn(`[Chat] Falling back to AI mode: ${reason}`);
      cleanupTimers();
      try {
        socketInstance.removeAllListeners();
        socketInstance.disconnect();
      } catch {
        // ignore
      }
      setSocket(null);
      setMode('ai');
      setIsConnected(true);
    };

    socketInstance.on('connect', () => {
      cleanupTimers();
      devLog.info('[Chat] Connected (socket)');
      setIsConnected(true);

      // Join support room
      socketInstance.emit('join', {
        room: `support-${user.id}`,
        userId: user.id,
        userName: user.name,
      });
    });

    socketInstance.on('connect_error', (err) => {
      fallbackToAI(`connect_error: ${(err as Error)?.message || 'unknown error'}`);
    });

    socketInstance.on('disconnect', () => {
      devLog.info('[Chat] Disconnected (socket)');
      // Keep the chat usable even if the realtime socket drops.
      // `sendMessage` will automatically use AI mode when the socket isn't connected.
      setIsConnected(true);
      // If the socket drops, keep chat usable by falling back to AI unless it reconnects quickly.
      if (!socketFallbackTimerRef.current) {
        socketFallbackTimerRef.current = setTimeout(() => {
          if (!socketInstance.connected) {
            fallbackToAI('disconnected');
          }
        }, 2000);
      }
    });

    socketInstance.on('event', (event: any) => {
      if (event?.type === 'message' && event.payload) {
        setMessages((prev) => [...prev, event.payload]);
      }
    });

    socketInstance.on('typing', (data: any) => {
      if (data?.userId && data.userId !== user.id) {
        setIsTyping(!!data.isTyping);
      }
    });

    setSocket(socketInstance);

    // Hard timeout: if we can't connect quickly, switch to AI mode to keep chat usable.
    socketFallbackTimerRef.current = setTimeout(() => {
      if (!socketInstance.connected) {
        fallbackToAI('connection timeout');
      }
    }, 3500);

    return () => {
      cleanupTimers();
      socketInstance.disconnect();
    };
  }, [user, isOpen]);

  const sendMessage = useCallback((text: string) => {
    if (!user) return;

    const message: Message = {
      id: Date.now().toString(),
      text,
      senderId: user.id,
      senderName: user.name || 'User',
      timestamp: Date.now(),
      isAdmin: user.role === 'admin', // Assuming role exists
    };

    // Optimistic update
    setMessages((prev) => [...prev, message]);

    // Socket mode: publish to the configured server.
    if (mode === 'socket' && socket?.connected) {
      socket.emit('event', {
        type: 'message',
        room: `support-${user.id}`,
        payload: message,
      });
      return;
    }

    // AI mode (or socket unavailable): call the AI chat API.
    setIsTyping(true);
    fetch('/api/ai/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        const replyText = data?.response || 'Şu anda yanıt üretemiyorum.';
        const aiMessage: Message = {
          id: `${Date.now()}_ai`,
          text: replyText,
          senderId: 'ai',
          senderName: 'AI Destek',
          timestamp: Date.now(),
          isAdmin: true,
        };
        setMessages((prev) => [...prev, aiMessage]);
      })
      .catch((err) => {
        devLog.error('[Chat] AI request failed', err);
        const errorMessage: Message = {
          id: `${Date.now()}_ai_error`,
          text: 'Şu anda bağlantı/AI servisine ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.',
          senderId: 'ai',
          senderName: 'AI Destek',
          timestamp: Date.now(),
          isAdmin: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      })
      .finally(() => {
        setIsTyping(false);
      });
  }, [mode, socket, user]);

  return {
    messages,
    isConnected,
    sendMessage,
    isOpen,
    setIsOpen,
    isTyping,
  };
}
