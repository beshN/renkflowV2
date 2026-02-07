// ============================================
// SERVER-SENT EVENTS IMPLEMENTATION
// For Server-to-Client Notifications
// ============================================

// ============================================
// TYPES
// ============================================

export interface SSEMessage<T = unknown> {
  id: string;
  event: string;
  data: T;
  retry?: number;
}

export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  actionUrl?: string;
  timestamp: string;
}

type SSEHandler<T = unknown> = (data: T) => void;
type SSEErrorHandler = (error: Event) => void;

interface SSEClientOptions {
  url: string;
  withCredentials?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// ============================================
// SSE CLIENT CLASS
// ============================================

export class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private withCredentials: boolean;
  private reconnect: boolean;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastEventId: string | null = null;
  
  private handlers = new Map<string, Set<SSEHandler>>();
  private errorHandlers = new Set<SSEErrorHandler>();
  private openHandlers = new Set<() => void>();

  constructor(options: SSEClientOptions) {
    this.url = options.url;
    this.withCredentials = options.withCredentials ?? true;
    this.reconnect = options.reconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  }

  // ============================================
  // CONNECTION
  // ============================================

  connect(): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    // Add last event ID for resumption
    let url = this.url;
    if (this.lastEventId) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}lastEventId=${this.lastEventId}`;
    }

    this.eventSource = new EventSource(url, {
      withCredentials: this.withCredentials,
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    this.reconnect = false;
    this.clearReconnectTimer();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.eventSource) return;

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.openHandlers.forEach(handler => handler());
    };

    this.eventSource.onerror = (error) => {
      this.errorHandlers.forEach(handler => handler(error));
      
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.handleReconnect();
      }
    };

    // Default message handler
    this.eventSource.onmessage = (event) => {
      this.lastEventId = event.lastEventId;
      this.dispatchEvent('message', event.data);
    };

    // Re-register custom event handlers
    this.handlers.forEach((handlers, eventType) => {
      if (eventType !== 'message') {
        this.registerEventListener(eventType);
      }
    });
  }

  private registerEventListener(eventType: string): void {
    if (!this.eventSource) return;

    this.eventSource.addEventListener(eventType, (event: MessageEvent) => {
      this.lastEventId = event.lastEventId;
      this.dispatchEvent(eventType, event.data);
    });
  }

  private dispatchEvent(eventType: string, rawData: string): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;

    try {
      const data = JSON.parse(rawData);
      handlers.forEach(handler => handler(data));
    } catch {
      // If not JSON, pass raw string
      handlers.forEach(handler => handler(rawData));
    }
  }

  private handleReconnect(): void {
    if (!this.reconnect) return;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ============================================
  // EVENT SUBSCRIPTION
  // ============================================

  on<T>(eventType: string, handler: SSEHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
      
      // Register with EventSource if connected
      if (eventType !== 'message') {
        this.registerEventListener(eventType);
      }
    }

    this.handlers.get(eventType)!.add(handler as SSEHandler);

    return () => {
      this.handlers.get(eventType)?.delete(handler as SSEHandler);
    };
  }

  onError(handler: SSEErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onOpen(handler: () => void): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  // ============================================
  // UTILITIES
  // ============================================

  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  get readyState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED;
  }
}

// ============================================
// NOTIFICATION-SPECIFIC SSE CLIENT
// ============================================

/**
 * Notification SSE Client
 * SECURITY: No userId in URL - authentication via HttpOnly cookies
 */
export class NotificationSSEClient extends SSEClient {
  private notificationHandlers = new Set<SSEHandler<NotificationData>>();

  constructor() {
    super({
      // SECURITY: No userId in URL - server extracts from auth cookie
      url: `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream`,
      withCredentials: true, // Required for cookies to be sent
      reconnect: true,
    });

    // Setup notification event listener
    this.on<NotificationData>('notification', (data) => {
      this.notificationHandlers.forEach(handler => handler(data));
    });
  }

  onNotification(handler: SSEHandler<NotificationData>): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }
}

// ============================================
// SERVER-SIDE SSE HANDLER (for API routes)
// ============================================

export interface SSEConnection {
  id: string;
  userId: string;
  send: (event: string, data: unknown) => void;
  close: () => void;
}

export class SSEConnectionManager {
  private connections = new Map<string, SSEConnection>();
  private userConnections = new Map<string, Set<string>>();

  addConnection(
    connectionId: string,
    userId: string,
    writer: WritableStreamDefaultWriter<Uint8Array>
  ): SSEConnection {
    const encoder = new TextEncoder();

    const connection: SSEConnection = {
      id: connectionId,
      userId,
      send: (event, data) => {
        const message = this.formatSSEMessage(event, data);
        writer.write(encoder.encode(message)).catch(() => {
          this.removeConnection(connectionId);
        });
      },
      close: () => {
        writer.close().catch(() => {});
        this.removeConnection(connectionId);
      },
    };

    this.connections.set(connectionId, connection);

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    return connection;
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.connections.delete(connectionId);
    this.userConnections.get(connection.userId)?.delete(connectionId);
  }

  sendToUser(userId: string, event: string, data: unknown): void {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) return;

    connectionIds.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      connection?.send(event, data);
    });
  }

  broadcast(event: string, data: unknown): void {
    this.connections.forEach(connection => {
      connection.send(event, data);
    });
  }

  private formatSSEMessage(event: string, data: unknown): string {
    const id = crypto.randomUUID();
    const jsonData = JSON.stringify(data);
    return `id: ${id}\nevent: ${event}\ndata: ${jsonData}\n\n`;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size ?? 0;
  }
}

// Singleton for server-side use
export const sseConnectionManager = new SSEConnectionManager();
