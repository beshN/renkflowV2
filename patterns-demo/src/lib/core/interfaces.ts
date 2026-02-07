// ============================================
// CORE INTERFACES & DEPENDENCY INJECTION
// Enables testability through interface injection
// ============================================

/**
 * @module core/interfaces
 * @description Core interfaces for dependency injection pattern.
 * All services should depend on abstractions (interfaces) not concretions.
 */

// ============================================
// HTTP CLIENT INTERFACE
// ============================================

/**
 * HTTP request configuration
 */
export interface IHttpRequestConfig {
  /** Request URL (relative or absolute) */
  url: string;
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON serialized) */
  body?: unknown;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retry?: number;
}

/**
 * HTTP response structure
 */
export interface IHttpResponse<T = unknown> {
  /** Response data */
  data: T;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
}

/**
 * HTTP client interface for API communication
 * @example
 * ```typescript
 * class MyService {
 *   constructor(private http: IHttpClient) {}
 *   
 *   async getUsers() {
 *     return this.http.get<User[]>('/users');
 *   }
 * }
 * ```
 */
export interface IHttpClient {
  /** Perform GET request */
  get<T>(url: string, config?: Omit<IHttpRequestConfig, 'url' | 'method'>): Promise<T>;
  /** Perform POST request */
  post<T>(url: string, data?: unknown, config?: Omit<IHttpRequestConfig, 'url' | 'method' | 'body'>): Promise<T>;
  /** Perform PUT request */
  put<T>(url: string, data?: unknown, config?: Omit<IHttpRequestConfig, 'url' | 'method' | 'body'>): Promise<T>;
  /** Perform PATCH request */
  patch<T>(url: string, data?: unknown, config?: Omit<IHttpRequestConfig, 'url' | 'method' | 'body'>): Promise<T>;
  /** Perform DELETE request */
  delete<T>(url: string, config?: Omit<IHttpRequestConfig, 'url' | 'method'>): Promise<T>;
}

// ============================================
// STORAGE INTERFACE
// ============================================

/**
 * Storage interface for data persistence
 * Abstracts localStorage, sessionStorage, or any custom storage
 */
export interface IStorage {
  /**
   * Get item from storage
   * @param key - Storage key
   * @returns Parsed value or null if not found
   */
  get<T>(key: string): T | null;
  
  /**
   * Set item in storage
   * @param key - Storage key
   * @param value - Value to store (will be serialized)
   */
  set<T>(key: string, value: T): void;
  
  /**
   * Remove item from storage
   * @param key - Storage key
   */
  remove(key: string): void;
  
  /**
   * Clear all items from storage
   */
  clear(): void;
  
  /**
   * Check if key exists in storage
   * @param key - Storage key
   */
  has(key: string): boolean;
}

// ============================================
// AUTHENTICATION INTERFACE
// ============================================

/**
 * User information structure
 */
export interface IUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  avatar?: string;
}

/**
 * Token pair structure
 */
export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication service interface
 */
export interface IAuthService {
  /**
   * Authenticate user with credentials
   * @returns Token pair on success
   */
  login(email: string, password: string): Promise<ITokenPair>;
  
  /**
   * End user session
   */
  logout(): Promise<void>;
  
  /**
   * Refresh access token using refresh token
   * @returns New token pair
   */
  refreshToken(): Promise<ITokenPair>;
  
  /**
   * Get current authenticated user
   * @returns User or null if not authenticated
   */
  getCurrentUser(): Promise<IUser | null>;
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean;
}

// ============================================
// EVENT EMITTER INTERFACE
// ============================================

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (data: T) => void;

/**
 * Unsubscribe function returned by event subscriptions
 */
export type Unsubscribe = () => void;

/**
 * Event emitter interface for pub/sub pattern
 */
export interface IEventEmitter {
  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe;
  
  /**
   * Subscribe to event once (auto-unsubscribe after first emit)
   * @param event - Event name
   * @param handler - Event handler function
   */
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe;
  
  /**
   * Emit an event with data
   * @param event - Event name
   * @param data - Event data
   */
  emit<T>(event: string, data: T): void;
  
  /**
   * Remove all handlers for an event
   * @param event - Event name (optional, removes all if not provided)
   */
  off(event?: string): void;
}

// ============================================
// LOGGER INTERFACE
// ============================================

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface for application logging
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  
  /**
   * Create child logger with preset context
   * @param context - Context to include in all logs
   */
  child(context: Record<string, unknown>): ILogger;
}

// ============================================
// CACHE INTERFACE
// ============================================

/**
 * Cache options
 */
export interface ICacheOptions {
  /** Time to live in milliseconds */
  ttl?: number;
  /** Tags for cache invalidation */
  tags?: string[];
}

/**
 * Cache interface for data caching
 */
export interface ICache {
  /**
   * Get cached value
   * @param key - Cache key
   * @returns Cached value or null
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set cached value
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options
   */
  set<T>(key: string, value: T, options?: ICacheOptions): Promise<void>;
  
  /**
   * Delete cached value
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;
  
  /**
   * Invalidate cache by tag
   * @param tag - Tag to invalidate
   */
  invalidateByTag(tag: string): Promise<void>;
  
  /**
   * Clear all cache
   */
  clear(): Promise<void>;
}

// ============================================
// NOTIFICATION INTERFACE
// ============================================

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Notification structure
 */
export interface INotification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Notification service interface
 */
export interface INotificationService {
  /**
   * Show a notification
   * @param notification - Notification to show
   */
  show(notification: Omit<INotification, 'id'>): string;
  
  /**
   * Hide a notification
   * @param id - Notification ID
   */
  hide(id: string): void;
  
  /**
   * Hide all notifications
   */
  hideAll(): void;
  
  // Convenience methods
  success(message: string, options?: Partial<INotification>): string;
  error(message: string, options?: Partial<INotification>): string;
  warning(message: string, options?: Partial<INotification>): string;
  info(message: string, options?: Partial<INotification>): string;
}

// ============================================
// REPOSITORY INTERFACE (Data Layer)
// ============================================

/**
 * Pagination parameters
 */
export interface IPaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface IPaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Base repository interface for CRUD operations
 * @typeParam T - Entity type
 * @typeParam CreateDTO - Data transfer object for creation
 * @typeParam UpdateDTO - Data transfer object for updates
 */
export interface IRepository<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
  /**
   * Find entity by ID
   * @param id - Entity ID
   */
  findById(id: string): Promise<T | null>;
  
  /**
   * Find all entities with pagination
   * @param params - Pagination parameters
   */
  findAll(params?: IPaginationParams): Promise<IPaginatedResult<T>>;
  
  /**
   * Create new entity
   * @param data - Entity data
   */
  create(data: CreateDTO): Promise<T>;
  
  /**
   * Update existing entity
   * @param id - Entity ID
   * @param data - Update data
   */
  update(id: string, data: UpdateDTO): Promise<T>;
  
  /**
   * Delete entity
   * @param id - Entity ID
   */
  delete(id: string): Promise<void>;
}

// ============================================
// SERVICE CONTAINER (Simple DI Container)
// ============================================

/**
 * Service identifier type
 */
export type ServiceIdentifier<T> = symbol | string | (new (...args: unknown[]) => T);

/**
 * Simple dependency injection container
 */
export class Container {
  private services = new Map<symbol | string, unknown>();
  private factories = new Map<symbol | string, () => unknown>();

  /**
   * Register a service instance
   */
  register<T>(id: ServiceIdentifier<T>, instance: T): void {
    const key = typeof id === 'function' ? id.name : id;
    this.services.set(key, instance);
  }

  /**
   * Register a factory function
   */
  registerFactory<T>(id: ServiceIdentifier<T>, factory: () => T): void {
    const key = typeof id === 'function' ? id.name : id;
    this.factories.set(key, factory);
  }

  /**
   * Resolve a service
   */
  resolve<T>(id: ServiceIdentifier<T>): T {
    const key = typeof id === 'function' ? id.name : id;
    
    // Check for registered instance
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }
    
    // Check for factory
    if (this.factories.has(key)) {
      const factory = this.factories.get(key)!;
      const instance = factory() as T;
      this.services.set(key, instance); // Cache the instance
      return instance;
    }
    
    throw new Error(`Service not found: ${String(key)}`);
  }

  /**
   * Check if service is registered
   */
  has<T>(id: ServiceIdentifier<T>): boolean {
    const key = typeof id === 'function' ? id.name : id;
    return this.services.has(key) || this.factories.has(key);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}

/**
 * Global container instance
 */
export const container = new Container();
