// ============================================
// 2. API ERROR HANDLING PATTERN
// Centralized Fetch Wrapper with Interceptors
// ============================================

/**
 * @module api/client
 * @description Centralized HTTP client with interceptor pattern.
 * 
 * Features:
 * - Request/Response/Error interceptors
 * - Automatic retry with exponential backoff
 * - Request timeout handling
 * - Type-safe API endpoints
 * - Token injection via interceptor
 * 
 * @example
 * ```typescript
 * import { api, endpoints } from '@/lib/api/client';
 * 
 * // Using typed endpoints
 * const user = await endpoints.users.get('user-123');
 * 
 * // Using raw client
 * const data = await api.get<MyType>('/custom-endpoint');
 * ```
 */

import type { IHttpClient } from '../core/interfaces';

// ============================================
// TYPES
// ============================================

/**
 * Standardized API error structure
 */
export interface ApiError {
  /** Unique error code (e.g., 'VALIDATION_ERROR') */
  code: string;
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  statusCode: number;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** ISO timestamp when error occurred */
  timestamp: string;
  /** API endpoint path that caused error */
  path?: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;
type ErrorInterceptor = (error: ApiError) => ApiError | Promise<never>;

interface RequestConfig extends RequestInit {
  url: string;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  retry?: number;
  retryDelay?: number;
}

// ============================================
// ERROR CLASSES
// ============================================

/**
 * Exception thrown for API errors.
 * Contains full error details and helper methods.
 * 
 * @example
 * ```typescript
 * try {
 *   await api.get('/users');
 * } catch (error) {
 *   if (error instanceof ApiException) {
 *     if (error.isUnauthorized()) {
 *       // Handle 401
 *     }
 *   }
 * }
 * ```
 */
export class ApiException extends Error {
  constructor(
    /** Structured API error */
    public readonly error: ApiError,
    /** Original fetch Response object */
    public readonly response?: Response
  ) {
    super(error.message);
    this.name = 'ApiException';
  }

  get statusCode() {
    return this.error.statusCode;
  }

  get code() {
    return this.error.code;
  }

  isUnauthorized() {
    return this.statusCode === 401;
  }

  isForbidden() {
    return this.statusCode === 403;
  }

  isNotFound() {
    return this.statusCode === 404;
  }

  isValidationError() {
    return this.statusCode === 422;
  }

  isServerError() {
    return this.statusCode >= 500;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

// ============================================
// API CLIENT
// ============================================

/**
 * HTTP API Client with interceptor support.
 * Implements IHttpClient interface for testability.
 */
class ApiClient implements IHttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private defaultTimeout: number;
  private defaultRetry: number;
  private defaultRetryDelay: number;

  /**
   * Create a new API client instance.
   * @param config - Client configuration
   */
  constructor(config: {
    baseUrl: string;
    headers?: Record<string, string>;
    timeout?: number;
    retry?: number;
    retryDelay?: number;
  }) {
    this.baseUrl = config.baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    this.defaultTimeout = config.timeout ?? 30000;
    this.defaultRetry = config.retry ?? 0;
    this.defaultRetryDelay = config.retryDelay ?? 1000;
  }

  // ============================================
  // INTERCEPTORS
  // ============================================

  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) this.requestInterceptors.splice(index, 1);
    };
  }

  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) this.responseInterceptors.splice(index, 1);
    };
  }

  addErrorInterceptor(interceptor: ErrorInterceptor) {
    this.errorInterceptors.push(interceptor);
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor);
      if (index > -1) this.errorInterceptors.splice(index, 1);
    };
  }

  // ============================================
  // CORE REQUEST METHOD
  // ============================================

  private async request<T>(config: RequestConfig): Promise<T> {
    // Apply request interceptors
    let processedConfig = { ...config };
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }

    // Build URL with params
    const url = this.buildUrl(processedConfig.url, processedConfig.params);
    
    // Setup timeout
    const timeout = processedConfig.timeout ?? this.defaultTimeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Retry logic
    const maxRetries = processedConfig.retry ?? this.defaultRetry;
    const retryDelay = processedConfig.retryDelay ?? this.defaultRetryDelay;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...processedConfig,
          headers: {
            ...this.defaultHeaders,
            ...processedConfig.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Apply response interceptors
        let processedResponse = response;
        for (const interceptor of this.responseInterceptors) {
          processedResponse = await interceptor(processedResponse);
        }

        // Handle errors
        if (!processedResponse.ok) {
          const error = await this.handleErrorResponse(processedResponse);
          throw error;
        }

        // Parse response
        const contentType = processedResponse.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await processedResponse.json();
        }
        
        return processedResponse.text() as unknown as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new TimeoutError(timeout);
        }

        if (error instanceof TypeError) {
          throw new NetworkError(error.message);
        }

        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (error instanceof ApiException && error.statusCode < 500) {
          throw error;
        }

        // Retry on server errors
        if (attempt < maxRetries) {
          await this.delay(retryDelay * Math.pow(2, attempt));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let error: ApiError;

    try {
      const body = await response.json();
      error = {
        code: body.code ?? 'UNKNOWN_ERROR',
        message: body.message ?? response.statusText,
        statusCode: response.status,
        details: body.details,
        timestamp: new Date().toISOString(),
        path: response.url,
      };
    } catch {
      error = {
        code: 'PARSE_ERROR',
        message: response.statusText || 'Unknown error',
        statusCode: response.status,
        timestamp: new Date().toISOString(),
        path: response.url,
      };
    }

    // Apply error interceptors
    for (const interceptor of this.errorInterceptors) {
      error = await interceptor(error);
    }

    throw new ApiException(error, response);
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, this.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // HTTP METHODS
  // ============================================

  async get<T>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<T> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  async post<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<T> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const api = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api',
  timeout: 30000,
  retry: 2,
  retryDelay: 1000,
});

// ============================================
// DEFAULT INTERCEPTORS
// ============================================

// Auth token interceptor
api.addRequestInterceptor(async (config) => {
  // Get token from cookie or storage
  if (typeof window !== 'undefined') {
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1];

    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return config;
});

// Error logging interceptor
api.addErrorInterceptor(async (error) => {
  console.error(`[API Error] ${error.code}: ${error.message}`, {
    statusCode: error.statusCode,
    path: error.path,
    details: error.details,
  });
  return error;
});

// 401 handler - refresh token
api.addErrorInterceptor(async (error) => {
  if (error.statusCode === 401) {
    // Trigger refresh token flow
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  }
  return error;
});

export { api, ApiClient };

// ============================================
// TYPED API ENDPOINTS
// ============================================

export const endpoints = {
  auth: {
    login: (data: { email: string; password: string }) => 
      api.post<{ accessToken: string; refreshToken: string }>('/auth/login', data),
    logout: () => 
      api.post<void>('/auth/logout'),
    refresh: () => 
      api.post<{ accessToken: string }>('/auth/refresh'),
    me: () => 
      api.get<{ id: string; email: string; name: string }>('/auth/me'),
  },
  users: {
    list: (params?: { page?: number; limit?: number }) => 
      api.get<ApiResponse<{ id: string; name: string; email: string }[]>>('/users', { params }),
    get: (id: string) => 
      api.get<{ id: string; name: string; email: string }>(`/users/${id}`),
    create: (data: { name: string; email: string }) => 
      api.post<{ id: string }>('/users', data),
    update: (id: string, data: Partial<{ name: string; email: string }>) => 
      api.patch<void>(`/users/${id}`, data),
    delete: (id: string) => 
      api.delete<void>(`/users/${id}`),
  },
} as const;
