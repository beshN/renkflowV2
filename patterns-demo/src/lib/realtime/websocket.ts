// ============================================
// 8. REAL-TIME UPDATES
// WebSocket Implementation
// ============================================

// ============================================
// TYPES
// ============================================

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
  id: string;
}

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

type MessageHandler<T = unknown> = (message: WebSocketMessage<T>) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Event) => void;

interface WebSocketClientOptions {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

// ============================================
// WEBSOCKET CLIENT CLASS
// ============================================

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private protocols?: string | string[];
  private reconnect: boolean;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private heartbeatInterval: number;
  private debug: boolean;
  
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private onOpenHandlers = new Set<ConnectionHandler>();
  private onCloseHandlers = new Set<ConnectionHandler>();
  private onErrorHandlers = new Set<ErrorHandler>();

  constructor(options: WebSocketClientOptions) {
    this.url = options.url;
    this.protocols = options.protocols;
    this.reconnect = options.reconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.heartbeatInterval = options.heartbeatInterval ?? 30000;
    this.debug = options.debug ?? false;
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.url, this.protocols);
      this.setupEventListeners();
    } catch (error) {
      this.log('Connection error:', error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    this.reconnect = false;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log('Connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.flushMessageQueue();
      this.onOpenHandlers.forEach(handler => handler());
    };

    this.ws.onclose = (event) => {
      this.log('Disconnected:', event.code, event.reason);
      this.clearTimers();
      this.onCloseHandlers.forEach(handler => handler());
      
      if (this.reconnect) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      this.log('Error:', error);
      this.onErrorHandlers.forEach(handler => handler(error));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.log('Received:', message.type);
        
        // Handle pong
        if (message.type === 'pong') {
          return;
        }

        // Dispatch to handlers
        const handlers = this.messageHandlers.get(message.type);
        handlers?.forEach(handler => handler(message));

        // Also dispatch to wildcard handlers
        const wildcardHandlers = this.messageHandlers.get('*');
        wildcardHandlers?.forEach(handler => handler(message));
      } catch (error) {
        this.log('Failed to parse message:', error);
      }
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // ============================================
  // HEARTBEAT
  // ============================================

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', payload: null });
    }, this.heartbeatInterval);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  send<T>(message: Omit<WebSocketMessage<T>, 'timestamp' | 'id'>): void {
    const fullMessage: WebSocketMessage<T> = {
      ...message,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    } as WebSocketMessage<T>;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
      this.log('Sent:', message.type);
    } else {
      this.messageQueue.push(fullMessage as WebSocketMessage);
      this.log('Queued:', message.type);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
        this.log('Flushed:', message.type);
      }
    }
  }

  // ============================================
  // EVENT SUBSCRIPTION
  // ============================================

  on<T>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler as MessageHandler);

    return () => {
      this.messageHandlers.get(type)?.delete(handler as MessageHandler);
    };
  }

  onOpen(handler: ConnectionHandler): () => void {
    this.onOpenHandlers.add(handler);
    return () => this.onOpenHandlers.delete(handler);
  }

  onClose(handler: ConnectionHandler): () => void {
    this.onCloseHandlers.add(handler);
    return () => this.onCloseHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.onErrorHandlers.add(handler);
    return () => this.onErrorHandlers.delete(handler);
  }

  // ============================================
  // UTILITIES
  // ============================================

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    wsClient = new WebSocketClient({
      url: process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001',
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      debug: process.env.NODE_ENV === 'development',
    });
  }
  return wsClient;
}

// ============================================
// CHANNEL SUBSCRIPTION PATTERN
// ============================================

export class Channel {
  private client: WebSocketClient;
  readonly name: string;
  private subscribed = false;

  constructor(client: WebSocketClient, name: string) {
    this.client = client;
    this.name = name;
  }

  subscribe(): void {
    if (this.subscribed) return;
    
    this.client.send({
      type: 'subscribe',
      payload: { channel: this.name },
    });
    this.subscribed = true;
  }

  unsubscribe(): void {
    if (!this.subscribed) return;
    
    this.client.send({
      type: 'unsubscribe',
      payload: { channel: this.name },
    });
    this.subscribed = false;
  }

  on<T>(event: string, handler: MessageHandler<T>): () => void {
    return this.client.on(`${this.name}:${event}`, handler);
  }

  emit<T>(event: string, payload: T): void {
    this.client.send({
      type: `${this.name}:${event}`,
      payload,
    });
  }
}

export function createChannel(name: string): Channel {
  return new Channel(getWebSocketClient(), name);
}
