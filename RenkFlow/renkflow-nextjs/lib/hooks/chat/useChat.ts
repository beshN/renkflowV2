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

const SOCKET_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function useChat(): UseChatResult {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Initialize socket connection
  useEffect(() => {
    if (!user || !isOpen) return;

    const socketInstance = io(SOCKET_URL, {
      path: '/api/socket/io',
      addTrailingSlash: false,
    });

    socketInstance.on('connect', () => {
      devLog.info('[Chat] Connected');
      setIsConnected(true);
      
      // Join support room
      socketInstance.emit('join', {
        room: `support-${user.id}`,
        userId: user.id,
        userName: user.name,
      });
    });

    socketInstance.on('disconnect', () => {
      devLog.info('[Chat] Disconnected');
      setIsConnected(false);
    });

    socketInstance.on('event', (event: any) => {
      if (event.type === 'message') {
        setMessages((prev) => [...prev, event.payload]);
      }
    });

    socketInstance.on('typing', (data: any) => {
      if (data.userId !== user.id) {
        setIsTyping(data.isTyping);
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user, isOpen]);

  const sendMessage = useCallback((text: string) => {
    if (!socket || !user) return;

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

    socket.emit('event', {
      type: 'message',
      room: `support-${user.id}`,
      payload: message,
    });
  }, [socket, user]);

  return {
    messages,
    isConnected,
    sendMessage,
    isOpen,
    setIsOpen,
    isTyping,
  };
}
