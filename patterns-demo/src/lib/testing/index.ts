// ============================================
// TESTING UTILITIES & MOCK HELPERS
// Enables comprehensive unit and integration testing
// ============================================

/**
 * @module testing
 * @description Testing utilities, mock factories, and test helpers.
 * Import these in your test files for consistent testing patterns.
 */

import type {
  IHttpClient,
  IStorage,
  IAuthService,
  IEventEmitter,
  ILogger,
  ICache,
  INotificationService,
  IUser,
  ITokenPair,
  INotification,
  EventHandler,
  Unsubscribe,
} from '../core/interfaces';

// ============================================
// MOCK HTTP CLIENT
// ============================================

/**
 * Mock response configuration
 */
interface MockResponse<T = unknown> {
  data: T;
  status?: number;
  delay?: number;
}

/**
 * Creates a mock HTTP client for testing
 * @example
 * ```typescript
 * const mockHttp = createMockHttpClient();
 * mockHttp.mockGet('/users', { data: [{ id: '1', name: 'Test' }] });
 * 
 * const users = await mockHttp.get('/users');
 * expect(users).toEqual([{ id: '1', name: 'Test' }]);
 * expect(mockHttp.getCallHistory('GET', '/users')).toHaveLength(1);
 * ```
 */
export function createMockHttpClient(): IHttpClient & {
  mockGet: <T>(url: string, response: MockResponse<T>) => void;
  mockPost: <T>(url: string, response: MockResponse<T>) => void;
  mockPut: <T>(url: string, response: MockResponse<T>) => void;
  mockPatch: <T>(url: string, response: MockResponse<T>) => void;
  mockDelete: <T>(url: string, response: MockResponse<T>) => void;
  mockError: (url: string, error: Error) => void;
  getCallHistory: (method: string, url: string) => unknown[];
  clearMocks: () => void;
} {
  const mocks = new Map<string, MockResponse | Error>();
  const callHistory = new Map<string, unknown[]>();

  const createKey = (method: string, url: string) => `${method}:${url}`;

  const recordCall = (method: string, url: string, data?: unknown) => {
    const key = createKey(method, url);
    if (!callHistory.has(key)) {
      callHistory.set(key, []);
    }
    callHistory.get(key)!.push({ method, url, data, timestamp: Date.now() });
  };

  const handleRequest = async <T>(method: string, url: string, data?: unknown): Promise<T> => {
    recordCall(method, url, data);
    
    const key = createKey(method, url);
    const mock = mocks.get(key);
    
    if (!mock) {
      throw new Error(`No mock found for ${method} ${url}`);
    }
    
    if (mock instanceof Error) {
      throw mock;
    }
    
    if (mock.delay) {
      await new Promise(resolve => setTimeout(resolve, mock.delay));
    }
    
    return mock.data as T;
  };

  return {
    get: <T>(url: string) => handleRequest<T>('GET', url),
    post: <T>(url: string, data?: unknown) => handleRequest<T>('POST', url, data),
    put: <T>(url: string, data?: unknown) => handleRequest<T>('PUT', url, data),
    patch: <T>(url: string, data?: unknown) => handleRequest<T>('PATCH', url, data),
    delete: <T>(url: string) => handleRequest<T>('DELETE', url),
    
    mockGet: <T>(url: string, response: MockResponse<T>) => {
      mocks.set(createKey('GET', url), response);
    },
    mockPost: <T>(url: string, response: MockResponse<T>) => {
      mocks.set(createKey('POST', url), response);
    },
    mockPut: <T>(url: string, response: MockResponse<T>) => {
      mocks.set(createKey('PUT', url), response);
    },
    mockPatch: <T>(url: string, response: MockResponse<T>) => {
      mocks.set(createKey('PATCH', url), response);
    },
    mockDelete: <T>(url: string, response: MockResponse<T>) => {
      mocks.set(createKey('DELETE', url), response);
    },
    mockError: (url: string, error: Error) => {
      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].forEach(method => {
        mocks.set(createKey(method, url), error);
      });
    },
    getCallHistory: (method: string, url: string) => {
      return callHistory.get(createKey(method, url)) ?? [];
    },
    clearMocks: () => {
      mocks.clear();
      callHistory.clear();
    },
  };
}

// ============================================
// MOCK STORAGE
// ============================================

/**
 * Creates a mock storage for testing
 */
export function createMockStorage(): IStorage & {
  getStore: () => Map<string, unknown>;
  setStore: (data: Record<string, unknown>) => void;
} {
  const store = new Map<string, unknown>();

  return {
    get: <T>(key: string): T | null => {
      return (store.get(key) as T) ?? null;
    },
    set: <T>(key: string, value: T): void => {
      store.set(key, value);
    },
    remove: (key: string): void => {
      store.delete(key);
    },
    clear: (): void => {
      store.clear();
    },
    has: (key: string): boolean => {
      return store.has(key);
    },
    getStore: () => store,
    setStore: (data: Record<string, unknown>) => {
      store.clear();
      Object.entries(data).forEach(([key, value]) => store.set(key, value));
    },
  };
}

// ============================================
// MOCK AUTH SERVICE
// ============================================

/**
 * Creates a mock auth service for testing
 */
export function createMockAuthService(
  initialUser?: IUser
): IAuthService & {
  setUser: (user: IUser | null) => void;
  simulateExpiredToken: () => void;
} {
  let currentUser: IUser | null = initialUser ?? null;
  let tokenExpired = false;

  return {
    login: async (email: string, password: string): Promise<ITokenPair> => {
      if (email === 'invalid@test.com') {
        throw new Error('Invalid credentials');
      }
      currentUser = {
        id: 'test-user-id',
        email,
        name: 'Test User',
        role: 'user',
      };
      return {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };
    },
    logout: async (): Promise<void> => {
      currentUser = null;
    },
    refreshToken: async (): Promise<ITokenPair> => {
      if (tokenExpired) {
        throw new Error('Token expired');
      }
      return {
        accessToken: 'mock-new-access-token',
        refreshToken: 'mock-new-refresh-token',
      };
    },
    getCurrentUser: async (): Promise<IUser | null> => {
      return currentUser;
    },
    isAuthenticated: (): boolean => {
      return currentUser !== null && !tokenExpired;
    },
    setUser: (user: IUser | null): void => {
      currentUser = user;
    },
    simulateExpiredToken: (): void => {
      tokenExpired = true;
    },
  };
}

// ============================================
// MOCK EVENT EMITTER
// ============================================

/**
 * Creates a mock event emitter for testing
 */
export function createMockEventEmitter(): IEventEmitter & {
  getEmittedEvents: (event: string) => unknown[];
  getHandlerCount: (event: string) => number;
} {
  const handlers = new Map<string, Set<EventHandler>>();
  const emittedEvents = new Map<string, unknown[]>();

  return {
    on: <T>(event: string, handler: EventHandler<T>): Unsubscribe => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler as EventHandler);
      return () => {
        handlers.get(event)?.delete(handler as EventHandler);
      };
    },
    once: <T>(event: string, handler: EventHandler<T>): Unsubscribe => {
      const wrappedHandler: EventHandler<T> = (data) => {
        handler(data);
        handlers.get(event)?.delete(wrappedHandler as EventHandler);
      };
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(wrappedHandler as EventHandler);
      return () => {
        handlers.get(event)?.delete(wrappedHandler as EventHandler);
      };
    },
    emit: <T>(event: string, data: T): void => {
      if (!emittedEvents.has(event)) {
        emittedEvents.set(event, []);
      }
      emittedEvents.get(event)!.push(data);
      handlers.get(event)?.forEach(handler => handler(data));
    },
    off: (event?: string): void => {
      if (event) {
        handlers.delete(event);
      } else {
        handlers.clear();
      }
    },
    getEmittedEvents: (event: string): unknown[] => {
      return emittedEvents.get(event) ?? [];
    },
    getHandlerCount: (event: string): number => {
      return handlers.get(event)?.size ?? 0;
    },
  };
}

// ============================================
// MOCK LOGGER
// ============================================

/**
 * Log entry structure
 */
interface LogEntry {
  level: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  timestamp: Date;
}

/**
 * Creates a mock logger for testing
 */
export function createMockLogger(): ILogger & {
  getLogs: () => LogEntry[];
  getLogsByLevel: (level: string) => LogEntry[];
  clearLogs: () => void;
} {
  const logs: LogEntry[] = [];

  const log = (level: string, message: string, error?: Error, context?: Record<string, unknown>) => {
    logs.push({ level, message, error, context, timestamp: new Date() });
  };

  const logger: ILogger = {
    debug: (message, context) => log('debug', message, undefined, context),
    info: (message, context) => log('info', message, undefined, context),
    warn: (message, context) => log('warn', message, undefined, context),
    error: (message, error, context) => log('error', message, error, context),
    child: (context) => {
      return {
        ...logger,
        debug: (message, ctx) => log('debug', message, undefined, { ...context, ...ctx }),
        info: (message, ctx) => log('info', message, undefined, { ...context, ...ctx }),
        warn: (message, ctx) => log('warn', message, undefined, { ...context, ...ctx }),
        error: (message, error, ctx) => log('error', message, error, { ...context, ...ctx }),
        child: logger.child,
      };
    },
  };

  return {
    ...logger,
    getLogs: () => [...logs],
    getLogsByLevel: (level: string) => logs.filter(l => l.level === level),
    clearLogs: () => logs.length = 0,
  };
}

// ============================================
// MOCK NOTIFICATION SERVICE
// ============================================

/**
 * Creates a mock notification service for testing
 */
export function createMockNotificationService(): INotificationService & {
  getNotifications: () => INotification[];
  getShownCount: () => number;
} {
  const notifications: INotification[] = [];
  let counter = 0;

  const show = (notification: Omit<INotification, 'id'>): string => {
    const id = `notification-${++counter}`;
    notifications.push({ ...notification, id });
    return id;
  };

  return {
    show,
    hide: (id: string): void => {
      const index = notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        notifications.splice(index, 1);
      }
    },
    hideAll: (): void => {
      notifications.length = 0;
    },
    success: (message, options) => show({ type: 'success', message, ...options }),
    error: (message, options) => show({ type: 'error', message, ...options }),
    warning: (message, options) => show({ type: 'warning', message, ...options }),
    info: (message, options) => show({ type: 'info', message, ...options }),
    getNotifications: () => [...notifications],
    getShownCount: () => counter,
  };
}

// ============================================
// MOCK CACHE
// ============================================

/**
 * Creates a mock cache for testing
 */
export function createMockCache(): ICache & {
  getStats: () => { hits: number; misses: number };
} {
  const cache = new Map<string, { value: unknown; tags: string[]; expiresAt?: number }>();
  let hits = 0;
  let misses = 0;

  return {
    get: async <T>(key: string): Promise<T | null> => {
      const entry = cache.get(key);
      if (!entry) {
        misses++;
        return null;
      }
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        cache.delete(key);
        misses++;
        return null;
      }
      hits++;
      return entry.value as T;
    },
    set: async <T>(key: string, value: T, options?): Promise<void> => {
      cache.set(key, {
        value,
        tags: options?.tags ?? [],
        expiresAt: options?.ttl ? Date.now() + options.ttl : undefined,
      });
    },
    delete: async (key: string): Promise<void> => {
      cache.delete(key);
    },
    invalidateByTag: async (tag: string): Promise<void> => {
      for (const [key, entry] of cache) {
        if (entry.tags.includes(tag)) {
          cache.delete(key);
        }
      }
    },
    clear: async (): Promise<void> => {
      cache.clear();
    },
    getStats: () => ({ hits, misses }),
  };
}

// ============================================
// TEST DATA FACTORIES
// ============================================

/**
 * Creates a test user with default values
 */
export function createTestUser(overrides: Partial<IUser> = {}): IUser {
  return {
    id: `user-${Math.random().toString(36).substring(7)}`,
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    ...overrides,
  };
}

/**
 * Creates multiple test users
 */
export function createTestUsers(count: number, overrides: Partial<IUser> = {}): IUser[] {
  return Array.from({ length: count }, (_, i) => createTestUser({
    id: `user-${i + 1}`,
    email: `user${i + 1}@example.com`,
    name: `User ${i + 1}`,
    ...overrides,
  }));
}

// ============================================
// ASYNC TEST HELPERS
// ============================================

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Wait for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

// ============================================
// REACT TESTING HELPERS
// ============================================

/**
 * Creates a wrapper component for testing hooks
 */
export function createTestWrapper(providers: React.ComponentType<{ children: React.ReactNode }>[]) {
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    ) as React.ReactElement;
  };
}
