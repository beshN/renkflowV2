// ============================================
// GLOBAL ERROR HANDLING SYSTEM
// Centralized error management with logging
// ============================================

/**
 * Base application error class
 * All custom errors should extend this class
 */
export abstract class AppError extends Error {
  /** Unique error code for identification */
  abstract readonly code: string;
  /** HTTP status code for API responses */
  abstract readonly statusCode: number;
  /** Whether this error should be reported to monitoring */
  abstract readonly isOperational: boolean;
  /** Original error that caused this error */
  readonly cause?: Error;
  /** Timestamp when error occurred */
  readonly timestamp: Date;
  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  constructor(message: string, options?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message);
    this.name = this.constructor.name;
    this.cause = options?.cause;
    this.context = options?.context;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Serializes error to JSON-safe object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

// ============================================
// SPECIFIC ERROR CLASSES
// ============================================

/**
 * Validation errors (400)
 * Use when input data fails validation
 */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly isOperational = true;
  readonly fields?: Record<string, string[]>;

  constructor(
    message: string,
    fields?: Record<string, string[]>,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, options);
    this.fields = fields;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      fields: this.fields,
    };
  }
}

/**
 * Authentication errors (401)
 * Use when user is not authenticated
 */
export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly statusCode = 401;
  readonly isOperational = true;
}

/**
 * Authorization errors (403)
 * Use when user lacks permission
 */
export class AuthorizationError extends AppError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly statusCode = 403;
  readonly isOperational = true;
  readonly requiredPermission?: string;

  constructor(
    message: string = 'Bu işlem için yetkiniz bulunmuyor',
    requiredPermission?: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, options);
    this.requiredPermission = requiredPermission;
  }
}

/**
 * Not found errors (404)
 * Use when resource doesn't exist
 */
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
  readonly isOperational = true;
  readonly resourceType?: string;
  readonly resourceId?: string;

  constructor(
    resourceType?: string,
    resourceId?: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    const message = resourceType
      ? `${resourceType}${resourceId ? ` (${resourceId})` : ''} bulunamadı`
      : 'Kaynak bulunamadı';
    super(message, options);
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Conflict errors (409)
 * Use when resource already exists or state conflict
 */
export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
  readonly isOperational = true;
}

/**
 * Rate limit errors (429)
 * Use when rate limit exceeded
 */
export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
  readonly isOperational = true;
  readonly retryAfter: number;

  constructor(
    retryAfter: number,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(`Çok fazla istek. ${retryAfter} saniye sonra tekrar deneyin.`, options);
    this.retryAfter = retryAfter;
  }
}

/**
 * Internal server errors (500)
 * Use for unexpected errors - these should be logged and monitored
 */
export class InternalError extends AppError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(
    message: string = 'Beklenmeyen bir hata oluştu',
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, options);
  }
}

/**
 * External service errors (502)
 * Use when third-party service fails
 */
export class ExternalServiceError extends AppError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  readonly isOperational = true;
  readonly serviceName: string;

  constructor(
    serviceName: string,
    message?: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message ?? `${serviceName} servisi yanıt vermiyor`, options);
    this.serviceName = serviceName;
  }
}

// ============================================
// ERROR LOGGER INTERFACE (DI Pattern)
// ============================================

/**
 * Logger interface for dependency injection
 * Implement this interface for custom logging solutions
 */
export interface IErrorLogger {
  /** Log error with full context */
  error(error: AppError | Error, context?: Record<string, unknown>): void;
  /** Log warning level */
  warn(message: string, context?: Record<string, unknown>): void;
  /** Log info level */
  info(message: string, context?: Record<string, unknown>): void;
}

/**
 * Default console logger implementation
 */
export class ConsoleErrorLogger implements IErrorLogger {
  error(error: AppError | Error, context?: Record<string, unknown>): void {
    console.error('[ERROR]', {
      name: error.name,
      message: error.message,
      ...(error instanceof AppError ? error.toJSON() : {}),
      context,
      stack: error.stack,
    });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn('[WARN]', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info('[INFO]', message, context);
  }
}

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

/**
 * Configuration for global error handler
 */
interface ErrorHandlerConfig {
  logger: IErrorLogger;
  onError?: (error: AppError | Error) => void;
  reportToMonitoring?: (error: AppError | Error) => Promise<void>;
}

/**
 * Global error handler singleton
 * Provides centralized error handling across the application
 */
class GlobalErrorHandler {
  private config: ErrorHandlerConfig;
  private static instance: GlobalErrorHandler | null = null;

  private constructor(config: ErrorHandlerConfig) {
    this.config = config;
  }

  /**
   * Initialize the global error handler
   * Call this once at application startup
   */
  static initialize(config: Partial<ErrorHandlerConfig> = {}): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler({
        logger: config.logger ?? new ConsoleErrorLogger(),
        onError: config.onError,
        reportToMonitoring: config.reportToMonitoring,
      });
    }
    return GlobalErrorHandler.instance;
  }

  /**
   * Get the singleton instance
   * @throws Error if not initialized
   */
  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      return GlobalErrorHandler.initialize();
    }
    return GlobalErrorHandler.instance;
  }

  /**
   * Handle an error with full logging and reporting
   * @param error - The error to handle
   * @param context - Additional context for debugging
   * @returns Sanitized error safe for client response
   */
  async handle(
    error: unknown,
    context?: Record<string, unknown>
  ): Promise<AppError> {
    const appError = this.normalizeError(error);
    
    // Log the error
    this.config.logger.error(appError, context);
    
    // Call custom error handler
    this.config.onError?.(appError);
    
    // Report non-operational errors to monitoring
    if (!appError.isOperational && this.config.reportToMonitoring) {
      try {
        await this.config.reportToMonitoring(appError);
      } catch (reportError) {
        this.config.logger.warn('Failed to report error to monitoring', {
          originalError: appError.message,
          reportError: reportError instanceof Error ? reportError.message : 'Unknown',
        });
      }
    }
    
    return appError;
  }

  /**
   * Normalize any error to AppError
   */
  private normalizeError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new InternalError(error.message, { cause: error });
    }
    
    return new InternalError(String(error));
  }

  /**
   * Create a safe error response for clients
   * Hides internal details in production
   */
  toClientResponse(error: AppError): {
    error: {
      code: string;
      message: string;
      statusCode: number;
      details?: Record<string, unknown>;
    };
  } {
    const isDev = process.env.NODE_ENV === 'development';
    
    return {
      error: {
        code: error.code,
        message: error.isOperational ? error.message : 'Beklenmeyen bir hata oluştu',
        statusCode: error.statusCode,
        details: isDev ? error.context : undefined,
      },
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export const errorHandler = GlobalErrorHandler;

/**
 * Convenience function to handle errors
 */
export async function handleError(
  error: unknown,
  context?: Record<string, unknown>
): Promise<AppError> {
  return GlobalErrorHandler.getInstance().handle(error, context);
}

/**
 * Type guard to check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw await handleError(error, { ...context, args });
    }
  }) as T;
}
