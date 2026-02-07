/**
 * Multi-Tenant Security - Main Export
 */

// Audit Trail
export {
  auditTrail,
  AuditTrail,
  type AuditAction,
  type AuditResource,
  type AuditLogEntry,
  type AuditQueryOptions,
  type AuditQueryResult,
} from './audit-trail';

// Rate Limiter
export {
  rateLimiter,
  RateLimiter,
  createRateLimitCheck,
  checkTenantRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitInfo,
  type RateLimitMiddlewareOptions,
  type TenantRateLimitOptions,
} from './rate-limiter';

// Encryption
export {
  encryption,
  EncryptionManager,
  encryptField,
  decryptField,
  isEncryptedField,
  isSensitiveField,
  maskSensitiveData,
  hash,
  hashWithSalt,
  generateSalt,
  generateSecureToken,
  SENSITIVE_FIELDS,
  type EncryptedData,
  type EncryptionKey,
  type EncryptedField,
} from './encryption';
