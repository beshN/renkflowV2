/**
 * Sentry Configuration and Initialization
 * 
 * Provides centralized error tracking and monitoring for:
 * - Client-side errors
 * - Server-side errors
 * - API route errors
 * - Performance monitoring
 */

import * as Sentry from '@sentry/nextjs';

// ============================================
// Types
// ============================================

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface ErrorContext {
  userId?: string;
  tenantId?: string;
  email?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

// ============================================
// Configuration
// ============================================

function getSentryConfig(): SentryConfig {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  };
}

// ============================================
// Initialization
// ============================================

let isInitialized = false;

/**
 * Initialize Sentry for client-side
 */
export function initSentryClient(): void {
  if (isInitialized || typeof window === 'undefined') return;

  const config = getSentryConfig();
  
  if (!config.dsn) {
    console.warn('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate,
    replaysSessionSampleRate: config.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
    
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
    ],

    beforeSend(event, hint) {
      // Filter out non-critical errors in development
      if (config.environment === 'development') {
        const error = hint.originalException;
        if (error instanceof Error && error.message.includes('ResizeObserver')) {
          return null;
        }
      }
      return event;
    },

    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      /Loading chunk \d+ failed/,
      'Network request failed',
    ],
  });

  isInitialized = true;
  console.log('[Sentry] Client initialized');
}

/**
 * Initialize Sentry for server-side
 */
export function initSentryServer(): void {
  if (isInitialized || typeof window !== 'undefined') return;

  const config = getSentryConfig();
  
  if (!config.dsn) {
    console.warn('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate,
    
    beforeSend(event) {
      // Add server context
      event.contexts = {
        ...event.contexts,
        runtime: {
          name: 'node',
          version: process.version,
        },
      };
      return event;
    },
  });

  isInitialized = true;
  console.log('[Sentry] Server initialized');
}

// ============================================
// Error Capturing
// ============================================

/**
 * Capture an error with context
 */
export function captureError(
  error: Error | string,
  context?: ErrorContext,
  severity: ErrorSeverity = 'error'
): string {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  Sentry.withScope((scope) => {
    scope.setLevel(severity);

    if (context?.userId) {
      scope.setUser({ id: context.userId, email: context.email });
    }

    if (context?.tenantId) {
      scope.setTag('tenant_id', context.tenantId);
    }

    if (context?.component) {
      scope.setTag('component', context.component);
    }

    if (context?.action) {
      scope.setTag('action', context.action);
    }

    if (context?.metadata) {
      scope.setExtras(context.metadata);
    }

    Sentry.captureException(errorObj);
  });

  return Sentry.lastEventId() || '';
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  context?: ErrorContext,
  severity: ErrorSeverity = 'info'
): string {
  Sentry.withScope((scope) => {
    scope.setLevel(severity);

    if (context?.userId) {
      scope.setUser({ id: context.userId, email: context.email });
    }

    if (context?.metadata) {
      scope.setExtras(context.metadata);
    }

    Sentry.captureMessage(message);
  });

  return Sentry.lastEventId() || '';
}

/**
 * Set user context for all subsequent events
 */
export function setUser(user: { id: string; email?: string; tenantId?: string }): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
  
  if (user.tenantId) {
    Sentry.setTag('tenant_id', user.tenantId);
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

// ============================================
// Performance Monitoring
// ============================================

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string = 'custom'): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({ name, op });
}

/**
 * Measure async operation performance
 */
export async function measurePerformance<T>(
  name: string,
  operation: () => Promise<T>,
  op: string = 'function'
): Promise<T> {
  return Sentry.startSpan({ name, op }, async () => {
    return await operation();
  });
}
