/**
 * Enterprise Error Handling System
 * Custom error classes with type safety and user-friendly messages
 */

// ============================================
// Base Error Class
// ============================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date();
    
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
      },
    };
  }
}

// ============================================
// Specific Error Classes
// ============================================

/**
 * Validation Error - Invalid input data
 */
export class ValidationError extends AppError {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(
    message: string = 'Doğrulama hatası',
    fieldErrors: Record<string, string[]> = {}
  ) {
    super(message, 400, 'VALIDATION_ERROR', true, { fieldErrors });
    this.fieldErrors = fieldErrors;
  }

  static fromZodError(zodError: { errors: Array<{ path: (string | number)[]; message: string }> }): ValidationError {
    const fieldErrors: Record<string, string[]> = {};
    
    for (const error of zodError.errors) {
      const path = error.path.join('.');
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(error.message);
    }

    return new ValidationError('Girilen veriler geçersiz', fieldErrors);
  }
}

/**
 * Not Found Error - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  public readonly resourceType: string;
  public readonly resourceId?: string;

  constructor(
    resourceType: string,
    resourceId?: string,
    message?: string
  ) {
    const defaultMessage = resourceId 
      ? `${resourceType} bulunamadı (ID: ${resourceId})`
      : `${resourceType} bulunamadı`;
    
    super(message || defaultMessage, 404, 'NOT_FOUND', true, { 
      resourceType, 
      resourceId 
    });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Unauthorized Error - Not authenticated
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Oturum açmanız gerekiyor') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

/**
 * Forbidden Error - Not authorized for this action
 */
export class ForbiddenError extends AppError {
  public readonly requiredPermission?: string;

  constructor(
    message: string = 'Bu işlem için yetkiniz bulunmuyor',
    requiredPermission?: string
  ) {
    super(message, 403, 'FORBIDDEN', true, { requiredPermission });
    this.requiredPermission = requiredPermission;
  }
}

/**
 * Conflict Error - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  constructor(
    message: string = 'Kaynak zaten mevcut veya çakışma var',
    details?: Record<string, unknown>
  ) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

/**
 * Rate Limit Error - Too many requests
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(
    retryAfter: number = 60,
    message: string = 'Çok fazla istek gönderdiniz. Lütfen bekleyin.'
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

/**
 * Database Error - Database operation failed
 */
export class DatabaseError extends AppError {
  public readonly dbErrorCode?: string;

  constructor(
    message: string = 'Veritabanı işlemi başarısız',
    dbErrorCode?: string,
    originalError?: Error
  ) {
    super(message, 500, 'DATABASE_ERROR', true, { 
      dbErrorCode,
      originalMessage: originalError?.message 
    });
    this.dbErrorCode = dbErrorCode;
  }

  static fromPostgresError(error: any): DatabaseError {
    // PostgreSQL error codes
    const errorMap: Record<string, string> = {
      '23505': 'Bu kayıt zaten mevcut (tekil kısıtlama ihlali)',
      '23503': 'İlişkili kayıt bulunamadı (yabancı anahtar ihlali)',
      '23502': 'Zorunlu alan eksik (null değer ihlali)',
      '22P02': 'Geçersiz veri formatı',
      '42P01': 'Tablo bulunamadı',
      '42703': 'Sütun bulunamadı',
      '28P01': 'Veritabanı kimlik doğrulama hatası',
      '57014': 'Sorgu zaman aşımına uğradı',
    };

    const code = error.code || 'UNKNOWN';
    const message = errorMap[code] || 'Veritabanı işlemi başarısız oldu';
    
    return new DatabaseError(message, code, error);
  }
}

/**
 * External Service Error - Third party service failed
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string;

  constructor(
    serviceName: string,
    message: string = 'Harici servis hatası',
    details?: Record<string, unknown>
  ) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', true, { 
      serviceName, 
      ...details 
    });
    this.serviceName = serviceName;
  }
}

/**
 * File Error - File operation failed
 */
export class FileError extends AppError {
  public readonly fileName?: string;
  public readonly maxSize?: number;
  public readonly allowedTypes?: string[];

  constructor(
    message: string,
    details?: {
      fileName?: string;
      maxSize?: number;
      allowedTypes?: string[];
    }
  ) {
    super(message, 400, 'FILE_ERROR', true, details);
    this.fileName = details?.fileName;
    this.maxSize = details?.maxSize;
    this.allowedTypes = details?.allowedTypes;
  }

  static fileTooLarge(maxSizeMB: number): FileError {
    return new FileError(
      `Dosya boyutu çok büyük. Maksimum ${maxSizeMB}MB yükleyebilirsiniz.`,
      { maxSize: maxSizeMB * 1024 * 1024 }
    );
  }

  static invalidType(fileName: string, allowedTypes: string[]): FileError {
    return new FileError(
      `Geçersiz dosya türü. İzin verilen türler: ${allowedTypes.join(', ')}`,
      { fileName, allowedTypes }
    );
  }
}

// ============================================
// Error Handler Utilities
// ============================================

/**
 * Check if error is an operational (expected) error
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('fetch failed')) {
      return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
    }
    if (error.message.includes('timeout')) {
      return 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.';
    }
  }
  
  return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
}

/**
 * Handle error and return standardized response
 */
export function handleError(error: unknown): {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
} {
  console.error('[ErrorHandler]', error);

  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }

  // Handle Postgres errors
  if ((error as any)?.code && typeof (error as any).code === 'string' && (error as any).code.length === 5) {
    const dbError = DatabaseError.fromPostgresError(error);
    return {
      success: false,
      error: {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
      },
    };
  }

  // Generic error
  return {
    success: false,
    error: {
      message: getUserFriendlyMessage(error),
      code: 'INTERNAL_ERROR',
    },
  };
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | ReturnType<typeof handleError>> {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: unknown,
  ErrorClass: new (...args: any[]) => AppError = AppError,
  ...args: any[]
): asserts condition {
  if (!condition) {
    throw new ErrorClass(...args);
  }
}

/**
 * Assert not null/undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  resourceType: string,
  resourceId?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resourceType, resourceId);
  }
}
