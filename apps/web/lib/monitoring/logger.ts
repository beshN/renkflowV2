/**
 * Centralized Logger with Sentry Integration
 * 
 * Features:
 * - Structured logging with levels
 * - Automatic Sentry error reporting
 * - Admin notification for critical errors
 * - Console output in development
 * - JSON output for production log aggregation
 */

import { captureError, captureMessage, addBreadcrumb, ErrorContext, ErrorSeverity } from './sentry';

// ============================================
// Types
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: ErrorContext;
  error?: Error;
  data?: Record<string, unknown>;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableSentry: boolean;
  enableAdminNotifications: boolean;
  adminEmail?: string;
}

// ============================================
// Constants
// ============================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const LEVEL_TO_SEVERITY: Record<LogLevel, ErrorSeverity> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
  fatal: 'fatal',
};

// ============================================
// Configuration
// ============================================

function getLoggerConfig(): LoggerConfig {
  const isDev = process.env.NODE_ENV === 'development';
  
  return {
    minLevel: (process.env.LOG_LEVEL as LogLevel) || (isDev ? 'debug' : 'info'),
    enableConsole: isDev || process.env.ENABLE_CONSOLE_LOGS === 'true',
    enableSentry: !isDev && !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableAdminNotifications: !isDev && process.env.ENABLE_ADMIN_NOTIFICATIONS === 'true',
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL,
  };
}

// ============================================
// Admin Notification Queue
// ============================================

interface NotificationQueueItem {
  entry: LogEntry;
  timestamp: number;
}

const notificationQueue: NotificationQueueItem[] = [];
let notificationTimeout: NodeJS.Timeout | null = null;
const BATCH_DELAY_MS = 5 * 60 * 1000; // 5 minutes for normal errors
const IMMEDIATE_THRESHOLD = 3; // Send immediately if 3+ fatal errors

async function sendAdminNotification(entries: LogEntry[], isImmediate: boolean = false): Promise<void> {
  const config = getLoggerConfig();
  
  if (!config.adminEmail || entries.length === 0) return;

  try {
    // Group errors by type
    const errorSummary = entries.reduce((acc, entry) => {
      const key = entry.error?.name || entry.message.slice(0, 50);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const subject = `[RenkFlow] ${entries.length} kritik hata${entries.length > 1 ? 'lar' : ''} tespit edildi`;
    
    const body = `
      <h2>Kritik Hata Bildirimi</h2>
      <p>Son 5 dakika içinde ${entries.length} kritik hata tespit edildi.</p>
      
      <h3>Hata Özeti:</h3>
      <ul>
        ${Object.entries(errorSummary).map(([error, count]) => 
          `<li><strong>${error}</strong>: ${count} kez</li>`
        ).join('')}
      </ul>
      
      <h3>Son Hatalar:</h3>
      ${entries.slice(0, 5).map(entry => `
        <div style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px;">
          <p><strong>Seviye:</strong> ${entry.level.toUpperCase()}</p>
          <p><strong>Mesaj:</strong> ${entry.message}</p>
          <p><strong>Zaman:</strong> ${entry.timestamp}</p>
          ${entry.error ? `<p><strong>Stack:</strong><pre>${entry.error.stack}</pre></p>` : ''}
          ${entry.context?.userId ? `<p><strong>Kullanıcı:</strong> ${entry.context.userId}</p>` : ''}
        </div>
      `).join('')}
      
      <p style="color: #666; font-size: 12px;">
        Bu otomatik bir bildirimdir. Detaylar için Sentry dashboard'u kontrol edin.
      </p>
    `;

    // Send email via API route
    await fetch('/api/internal/admin-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: config.adminEmail,
        subject,
        html: body,
      }),
    });
  } catch (error) {
    console.error('[Logger] Failed to send admin notification:', error);
  }
}

function queueAdminNotification(entry: LogEntry): void {
  const config = getLoggerConfig();
  
  if (!config.enableAdminNotifications) return;

  notificationQueue.push({ entry, timestamp: Date.now() });

  // FATAL errors: send immediately
  if (entry.level === 'fatal') {
    sendImmediateNotification(entry);
    return;
  }

  // Count fatal errors in queue
  const fatalCount = notificationQueue.filter(item => item.entry.level === 'fatal').length;
  
  // If we have multiple fatal errors, send immediately
  if (fatalCount >= IMMEDIATE_THRESHOLD) {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }
    const entries = notificationQueue.map(item => item.entry);
    notificationQueue.length = 0;
    sendAdminNotification(entries, true);
    return;
  }

  // Debounce: batch notifications every 5 minutes for normal errors
  if (!notificationTimeout) {
    notificationTimeout = setTimeout(() => {
      const entries = notificationQueue.map(item => item.entry);
      notificationQueue.length = 0;
      notificationTimeout = null;
      sendAdminNotification(entries);
    }, BATCH_DELAY_MS);
  }
}

/**
 * Send immediate notification for fatal errors
 */
async function sendImmediateNotification(entry: LogEntry): Promise<void> {
  const config = getLoggerConfig();
  
  if (!config.adminEmail) return;

  try {
    const subject = `🚨 [RenkFlow] FATAL ERROR - Immediate Attention Required`;
    
    const body = `
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px;">
        <h2 style="margin: 0;">⚠️ Fatal Error Detected</h2>
      </div>
      
      <div style="padding: 20px; background: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; margin-top: 10px;">
        <p><strong>Timestamp:</strong> ${entry.timestamp}</p>
        <p><strong>Message:</strong> ${entry.message}</p>
        ${entry.error ? `
          <p><strong>Error:</strong> ${entry.error.name}: ${entry.error.message}</p>
          <pre style="background: #1f2937; color: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto;">${entry.error.stack}</pre>
        ` : ''}
        ${entry.context?.userId ? `<p><strong>User ID:</strong> ${entry.context.userId}</p>` : ''}
        ${entry.context?.tenantId ? `<p><strong>Tenant ID:</strong> ${entry.context.tenantId}</p>` : ''}
        ${entry.context?.component ? `<p><strong>Component:</strong> ${entry.context.component}</p>` : ''}
      </div>
      
      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        This is an immediate notification for a fatal error. Check Sentry dashboard for more details.
      </p>
    `;

    // Use absolute URL for server-side calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    await fetch(`${baseUrl}/api/internal/admin-notification`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        to: config.adminEmail,
        subject,
        html: body,
        priority: 'high',
      }),
    });
  } catch (error) {
    console.error('[Logger] Failed to send immediate notification:', error);
  }
}

// ============================================
// Logger Class
// ============================================

class Logger {
  private config: LoggerConfig;

  constructor() {
    this.config = getLoggerConfig();
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatForConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const message = entry.message;

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, message, entry.data || '');
        break;
      case 'info':
        console.info(prefix, message, entry.data || '');
        break;
      case 'warn':
        console.warn(prefix, message, entry.data || '');
        break;
      case 'error':
      case 'fatal':
        console.error(prefix, message, entry.error || entry.data || '');
        break;
    }
  }

  private formatForJSON(entry: LogEntry): string {
    return JSON.stringify({
      ...entry,
      error: entry.error ? {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      } : undefined,
    });
  }

  private log(
    level: LogLevel,
    message: string,
    options?: {
      error?: Error;
      context?: ErrorContext;
      data?: Record<string, unknown>;
    }
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: options?.context,
      error: options?.error,
      data: options?.data,
    };

    // Console output
    if (this.config.enableConsole) {
      this.formatForConsole(entry);
    }

    // Sentry integration
    if (this.config.enableSentry) {
      if (options?.error) {
        captureError(options.error, options.context, LEVEL_TO_SEVERITY[level]);
      } else if (level === 'error' || level === 'fatal') {
        captureMessage(message, options?.context, LEVEL_TO_SEVERITY[level]);
      } else {
        addBreadcrumb(message, 'log', options?.data);
      }
    }

    // Admin notification for critical errors
    if ((level === 'error' || level === 'fatal') && this.config.enableAdminNotifications) {
      queueAdminNotification(entry);
    }
  }

  // ============================================
  // Public API
  // ============================================

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, { data });
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, { data });
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, { data });
  }

  error(message: string, error?: Error, context?: ErrorContext): void {
    this.log('error', message, { error, context });
  }

  fatal(message: string, error?: Error, context?: ErrorContext): void {
    this.log('fatal', message, { error, context });
  }

  /**
   * Log with custom context
   */
  withContext(context: ErrorContext) {
    return {
      debug: (message: string, data?: Record<string, unknown>) => 
        this.log('debug', message, { data, context }),
      info: (message: string, data?: Record<string, unknown>) => 
        this.log('info', message, { data, context }),
      warn: (message: string, data?: Record<string, unknown>) => 
        this.log('warn', message, { data, context }),
      error: (message: string, error?: Error) => 
        this.log('error', message, { error, context }),
      fatal: (message: string, error?: Error) => 
        this.log('fatal', message, { error, context }),
    };
  }

  /**
   * Create a child logger for a specific component
   */
  child(component: string) {
    return this.withContext({ component });
  }
}

// ============================================
// Singleton Export
// ============================================

export const logger = new Logger();

// ============================================
// Global Error Handler Override
// ============================================

/**
 * Override console.error to capture all errors
 */
export function installGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return;

  const originalConsoleError = console.error;
  
  console.error = (...args: unknown[]) => {
    // Call original
    originalConsoleError.apply(console, args);

    // Capture to Sentry if it looks like an error
    const firstArg = args[0];
    if (firstArg instanceof Error) {
      captureError(firstArg);
    } else if (typeof firstArg === 'string' && args.length === 1) {
      captureMessage(firstArg, undefined, 'error');
    }
  };

  // Global error handler
  window.onerror = (message, source, lineno, colno, error) => {
    logger.error('Uncaught error', error || new Error(String(message)), {
      metadata: { source, lineno, colno },
    });
    return false;
  };

  // Unhandled promise rejection handler
  window.onunhandledrejection = (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    logger.error('Unhandled promise rejection', error);
  };
}

// ============================================
// Convenience Exports
// ============================================

export { captureError, captureMessage, setUser, clearUser } from './sentry';
