/**
 * Production-Safe Logger
 * - Only logs in development mode
 * - Structured logging with levels
 * - Performance tracking utilities
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  context?: string;
}

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
};

const RESET_COLOR = '\x1b[0m';

class Logger {
  private static instance: Logger;
  private isDev: boolean;
  private context: string;

  private constructor(context: string = 'App') {
    this.isDev = process.env.NODE_ENV === 'development';
    this.context = context;
  }

  static getInstance(context?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    if (context && Logger.instance.context !== context) {
      return new Logger(context);
    }
    return Logger.instance;
  }

  static create(context: string): Logger {
    return new Logger(context);
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      context: this.context,
    };
  }

  private output(entry: LogEntry): void {
    if (!this.isDev) return;

    const color = LOG_COLORS[entry.level];
    const prefix = `${color}[${entry.level.toUpperCase()}]${RESET_COLOR}`;
    const contextStr = `[${entry.context}]`;
    const timeStr = `[${entry.timestamp.split('T')[1].split('.')[0]}]`;

    const consoleMethod = entry.level === 'error' 
      ? console.error 
      : entry.level === 'warn' 
        ? console.warn 
        : console.log;

    if (entry.data !== undefined) {
      consoleMethod(`${prefix} ${timeStr} ${contextStr} ${entry.message}`, entry.data);
    } else {
      consoleMethod(`${prefix} ${timeStr} ${contextStr} ${entry.message}`);
    }
  }

  debug(message: string, data?: unknown): void {
    this.output(this.formatMessage('debug', message, data));
  }

  info(message: string, data?: unknown): void {
    this.output(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: unknown): void {
    this.output(this.formatMessage('warn', message, data));
  }

  error(message: string, data?: unknown): void {
    // Always log errors, but with less detail in production
    const entry = this.formatMessage('error', message, data);
    
    if (this.isDev) {
      this.output(entry);
    } else {
      // In production, log minimal info (could be sent to error tracking service)
      console.error(`[ERROR] ${message}`);
    }
  }

  // Performance tracking
  time(label: string): () => void {
    if (!this.isDev) return () => {};

    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} took ${duration.toFixed(2)}ms`);
    };
  }

  // Group logging
  group(label: string, fn: () => void): void {
    if (!this.isDev) {
      fn();
      return;
    }

    console.group(`[${this.context}] ${label}`);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }

  // Table logging
  table(data: unknown[]): void {
    if (!this.isDev) return;
    console.table(data);
  }
}

// Default logger instance
export const logger = Logger.getInstance();

// Factory function for creating context-specific loggers
export function createLogger(context: string): Logger {
  return Logger.create(context);
}

// Development-only console wrapper
export const devLog = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    // Always log errors
    console.error(...args);
  },
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(...args);
    }
  },
  table: (data: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.table(data);
    }
  },
  time: (label: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.time(label);
    }
  },
  timeEnd: (label: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.timeEnd(label);
    }
  },
};

// Assert helper that only runs in development
export function devAssert(condition: boolean, message: string): asserts condition {
  if (process.env.NODE_ENV === 'development' && !condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Deprecation warning helper
export function deprecationWarning(oldName: string, newName: string, removeVersion?: string): void {
  if (process.env.NODE_ENV === 'development') {
    const versionStr = removeVersion ? ` and will be removed in version ${removeVersion}` : '';
    console.warn(
      `[DEPRECATION] "${oldName}" is deprecated${versionStr}. Use "${newName}" instead.`
    );
  }
}
