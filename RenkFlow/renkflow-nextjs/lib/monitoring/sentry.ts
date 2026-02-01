/**
 * Sentry optional stub
 * If @sentry/nextjs is not installed, all functions no-op.
 */

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

let isInitialized = false;

export async function initSentryClient(): Promise<void> {
  isInitialized = true;
}

export async function initSentryServer(): Promise<void> {
  isInitialized = true;
}

export async function captureError(_error: Error | string, _context?: ErrorContext, _severity?: ErrorSeverity): Promise<string> {
  return '';
}

export async function captureMessage(_message: string, _context?: ErrorContext, _severity?: ErrorSeverity): Promise<string> {
  return '';
}

export async function setUser(_user: { id: string; email?: string; tenantId?: string }): Promise<void> {
  return;
}

export async function clearUser(): Promise<void> {
  return;
}

export async function addBreadcrumb(_message: string, _category?: string, _data?: Record<string, unknown>): Promise<void> {
  return;
}

export function startTransaction(_name: string, _op: string = 'custom'): undefined {
  return undefined;
}

export async function measurePerformance<T>(_name: string, operation: () => Promise<T>, _op: string = 'function'): Promise<T> {
  return operation();
}
