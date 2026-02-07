'use client';

/**
 * Real-Time WebSocket Client
 * Manages WebSocket connections for real-time features
 */

import { io, Socket } from 'socket.io-client';
import {
  ConnectionState,
  RealtimeEvent,
  PresenceUser,
  RealtimeEventType,
} from './types';

// Local type for client connection info
interface ClientConnectionInfo {
  state: ConnectionState;
  latency: number;
  reconnectAttempts: number;
  socketId: string | null;
}

type EventCallback = (event: RealtimeEvent) => void;
type PresenceCallback = (users: PresenceUser[]) => void;
type ConnectionCallback = (state: ConnectionState) => void;

interface ClientSubscriptionOptions {
  room: string;
  events?: RealtimeEventType[];
  onEvent?: EventCallback;
  onPresenceChange?: PresenceCallback;
  onConnectionChange?: ConnectionCallback;
}

// Extended event type with room for internal use
interface InternalRealtimeEvent extends Omit<RealtimeEvent, 'id' | 'tenantId'> {
  id?: string;
  tenantId?: string;
  room: string;
}

class RealtimeClient {
  private static instance: RealtimeClient;
  private socket: Socket | null = null;
  private connectionInfo: ClientConnectionInfo = {
    state: 'disconnected',
    latency: 0,
    reconnectAttempts: 0,
    socketId: null,
  };
  
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private presenceListeners: Set<PresenceCallback> = new Set();
  private connectionListeners: Set<ConnectionCallback> = new Set();
  private presence: Map<string, PresenceUser> = new Map();
  private currentRoom: string | null = null;
  private userId: string | null = null;
  private userName: string | null = null;

  private constructor() {}

  static getInstance(): RealtimeClient {
    if (!RealtimeClient.instance) {
      RealtimeClient.instance = new RealtimeClient();
    }
    return RealtimeClient.instance;
  }

  // ============================================
  // Connection Management
  // ============================================

  connect(url?: string, userId?: string, userName?: string): void {
    if (this.socket?.connected) return;

    this.userId = userId || null;
    this.userName = userName || null;

    const socketUrl = url || process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!socketUrl) {
      this.updateConnectionState('disconnected');
      return;
    }

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      autoConnect: true,
    });

    this.setupEventHandlers();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.updateConnectionState('disconnected');
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.connectionInfo.socketId = this.socket?.id || null;
      this.updateConnectionState('connected');
      this.connectionInfo.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      this.updateConnectionState('disconnected');
    });

    this.socket.on('connect_error', () => {
      this.connectionInfo.reconnectAttempts++;
      this.updateConnectionState('reconnecting');
    });

    // Real-time events
    this.socket.on('event', (event: InternalRealtimeEvent) => {
      this.handleEvent(event);
    });

    // Presence updates
    this.socket.on('presence', (users: PresenceUser[]) => {
      this.handlePresenceUpdate(users);
    });

    // Ping/pong for latency
    this.socket.on('pong', (latency: number) => {
      this.connectionInfo.latency = latency;
    });
  }

  private updateConnectionState(state: ConnectionState): void {
    this.connectionInfo.state = state;
    this.connectionListeners.forEach((cb) => cb(state));
  }

  // ============================================
  // Room Management
  // ============================================

  join(room: string, meta?: Record<string, unknown>): void {
    if (!this.socket) return;

    this.currentRoom = room;
    this.socket.emit('join', {
      room,
      userId: this.userId,
      userName: this.userName,
      ...meta,
    });
  }

  leave(room?: string): void {
    if (!this.socket) return;

    const targetRoom = room || this.currentRoom;
    if (targetRoom) {
      this.socket.emit('leave', { room: targetRoom });
      if (targetRoom === this.currentRoom) {
        this.currentRoom = null;
      }
    }
  }

  // ============================================
  // Event Publishing
  // ============================================

  publish(type: RealtimeEventType, payload: unknown, version?: number): void {
    if (!this.socket || !this.currentRoom) return;

    const event: InternalRealtimeEvent = {
      type,
      room: this.currentRoom,
      userId: this.userId || 'anonymous',
      userName: this.userName || 'Anonymous',
      timestamp: Date.now(),
      version: version || 1,
      payload,
    };

    this.socket.emit('event', event);
  }

  // ============================================
  // Event Subscription
  // ============================================

  subscribe(options: ClientSubscriptionOptions): () => void {
    const { room, onEvent, onPresenceChange, onConnectionChange } = options;

    if (this.currentRoom !== room) {
      this.join(room);
    }

    if (onEvent) {
      const roomKey = `${room}:*`;
      if (!this.eventListeners.has(roomKey)) {
        this.eventListeners.set(roomKey, new Set());
      }
      this.eventListeners.get(roomKey)!.add(onEvent);
    }

    if (onPresenceChange) {
      this.presenceListeners.add(onPresenceChange);
    }

    if (onConnectionChange) {
      this.connectionListeners.add(onConnectionChange);
      // Immediately notify of current state
      onConnectionChange(this.connectionInfo.state);
    }

    return () => {
      if (onEvent) {
        this.eventListeners.get(`${room}:*`)?.delete(onEvent);
      }
      if (onPresenceChange) {
        this.presenceListeners.delete(onPresenceChange);
      }
      if (onConnectionChange) {
        this.connectionListeners.delete(onConnectionChange);
      }
    };
  }

  // ============================================
  // Event Handling
  // ============================================

  private handleEvent(event: InternalRealtimeEvent): void {
    // Notify room-specific listeners
    const roomListeners = this.eventListeners.get(`${event.room}:*`);
    roomListeners?.forEach((cb) => cb(event as unknown as RealtimeEvent));

    // Notify event-type-specific listeners
    const typeListeners = this.eventListeners.get(`*:${event.type}`);
    typeListeners?.forEach((cb) => cb(event as unknown as RealtimeEvent));
  }

  private handlePresenceUpdate(users: PresenceUser[]): void {
    this.presence.clear();
    users.forEach((user) => this.presence.set(user.id, user));
    this.presenceListeners.forEach((cb) => cb(users));
  }

  // ============================================
  // Presence
  // ============================================

  setPresence(updates: Partial<PresenceUser>): void {
    if (!this.socket) return;
    this.socket.emit('presence', {
      userId: this.userId,
      ...updates,
    });
  }

  setTyping(isTyping: boolean, entityType: string, entityId: string): void {
    if (!this.socket) return;
    this.socket.emit('typing', {
      userId: this.userId,
      userName: this.userName,
      isTyping,
      entityType,
      entityId,
    });
  }

  setCursor(x: number, y: number, elementId?: string): void {
    if (!this.socket) return;
    this.socket.emit('cursor', {
      userId: this.userId,
      x,
      y,
      elementId,
    });
  }

  // ============================================
  // Getters
  // ============================================

  get connectionStatus(): ClientConnectionInfo {
    return { ...this.connectionInfo };
  }

  get users(): PresenceUser[] {
    return Array.from(this.presence.values());
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // ============================================
  // Additional Methods for Hooks Compatibility
  // ============================================

  onConnectionChange(callback: (info: any) => void): () => void {
    const wrappedCallback = (state: ConnectionState) => {
      callback({
        state,
        latency: this.connectionInfo.latency,
        lastConnected: state === 'connected' ? Date.now() : null,
        reconnectAttempts: this.connectionInfo.reconnectAttempts,
        socketId: this.connectionInfo.socketId,
      });
    };
    this.connectionListeners.add(wrappedCallback as any);
    // Immediately notify
    wrappedCallback(this.connectionInfo.state);
    return () => this.connectionListeners.delete(wrappedCallback as any);
  }

  onPresenceUpdate(callback: PresenceCallback): () => void {
    this.presenceListeners.add(callback);
    return () => this.presenceListeners.delete(callback);
  }

  setViewingOrder(orderId: string | null): void {
    if (!this.socket) return;
    this.socket.emit('viewing', { userId: this.userId, orderId });
  }

  updatePresence(updates: Partial<PresenceUser>): void {
    this.setPresence(updates);
  }
}

export const realtime = RealtimeClient.getInstance();
export { RealtimeClient };
