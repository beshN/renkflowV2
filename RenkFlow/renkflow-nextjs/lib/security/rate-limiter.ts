/**
 * Rate Limiter for Multi-Tenant API
 * - Per-tenant rate limiting
 * - Per-user rate limiting
 * - IP-based rate limiting
 * - Sliding window algorithm
 */

// ============================================
// Types
// ============================================

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Prefix for storage keys
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number | null;
  limit: number;
}

export interface RateLimitInfo {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// ============================================
// In-Memory Store (for development)
// ============================================

class InMemoryStore {
  private store: Map<string, RateLimitInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): RateLimitInfo | null {
    const info = this.store.get(key);
    if (!info) return null;

    // Check if expired
    if (Date.now() > info.resetTime) {
      this.store.delete(key);
      return null;
    }

    return info;
  }

  set(key: string, info: RateLimitInfo): void {
    this.store.set(key, info);
  }

  increment(key: string, windowMs: number): RateLimitInfo {
    const now = Date.now();
    const existing = this.get(key);

    if (existing) {
      existing.count++;
      this.store.set(key, existing);
      return existing;
    }

    const newInfo: RateLimitInfo = {
      count: 1,
      resetTime: now + windowMs,
      firstRequest: now,
    };
    this.store.set(key, newInfo);
    return newInfo;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, info] of this.store.entries()) {
      if (now > info.resetTime) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// ============================================
// Rate Limiter Class
// ============================================

class RateLimiter {
  private static instance: RateLimiter;
  private store: InMemoryStore;
  private configs: Map<string, RateLimitConfig> = new Map();

  // Default configurations
  private readonly DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
    // Global API rate limit
    global: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyPrefix: 'rl:global',
    },
    // Per-tenant rate limit
    tenant: {
      windowMs: 60 * 1000,
      maxRequests: 500,
      keyPrefix: 'rl:tenant',
    },
    // Per-user rate limit
    user: {
      windowMs: 60 * 1000,
      maxRequests: 60,
      keyPrefix: 'rl:user',
    },
    // Authentication endpoints
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      keyPrefix: 'rl:auth',
    },
    // Password reset
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      keyPrefix: 'rl:pwd',
    },
    // API key operations
    apiKey: {
      windowMs: 60 * 1000,
      maxRequests: 1000,
      keyPrefix: 'rl:api',
    },
    // File uploads
    upload: {
      windowMs: 60 * 1000,
      maxRequests: 10,
      keyPrefix: 'rl:upload',
    },
    // Export operations
    export: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10,
      keyPrefix: 'rl:export',
    },
  };

  private constructor() {
    this.store = new InMemoryStore();
    
    // Initialize default configs
    for (const [name, config] of Object.entries(this.DEFAULT_CONFIGS)) {
      this.configs.set(name, config);
    }
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Configure a rate limit
   */
  configure(name: string, config: RateLimitConfig): void {
    this.configs.set(name, config);
  }

  /**
   * Check rate limit and return result
   */
  check(limitName: string, identifier: string): RateLimitResult {
    const config = this.configs.get(limitName);
    if (!config) {
      // No config found, allow request
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: 0,
        retryAfter: null,
        limit: Infinity,
      };
    }

    const key = `${config.keyPrefix}:${identifier}`;
    const info = this.store.increment(key, config.windowMs);

    const remaining = Math.max(0, config.maxRequests - info.count);
    const allowed = info.count <= config.maxRequests;
    const retryAfter = allowed ? null : Math.ceil((info.resetTime - Date.now()) / 1000);

    return {
      allowed,
      remaining,
      resetTime: info.resetTime,
      retryAfter,
      limit: config.maxRequests,
    };
  }

  /**
   * Check multiple rate limits at once
   */
  checkMultiple(checks: { limitName: string; identifier: string }[]): RateLimitResult {
    let mostRestrictive: RateLimitResult = {
      allowed: true,
      remaining: Infinity,
      resetTime: 0,
      retryAfter: null,
      limit: Infinity,
    };

    for (const { limitName, identifier } of checks) {
      const result = this.check(limitName, identifier);
      
      if (!result.allowed || result.remaining < mostRestrictive.remaining) {
        mostRestrictive = result;
      }

      if (!result.allowed) {
        break;
      }
    }

    return mostRestrictive;
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(limitName: string, identifier: string): void {
    const config = this.configs.get(limitName);
    if (config) {
      const key = `${config.keyPrefix}:${identifier}`;
      this.store.delete(key);
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(limitName: string, identifier: string): RateLimitInfo | null {
    const config = this.configs.get(limitName);
    if (!config) return null;

    const key = `${config.keyPrefix}:${identifier}`;
    return this.store.get(key);
  }

  /**
   * Create rate limit headers for response
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toString(),
    };

    if (result.retryAfter !== null) {
      headers['Retry-After'] = result.retryAfter.toString();
    }

    return headers;
  }
}

export const rateLimiter = RateLimiter.getInstance();
export { RateLimiter };

// ============================================
// Middleware Helper
// ============================================

export interface RateLimitMiddlewareOptions {
  limitName?: string;
  getIdentifier?: (req: Request) => string;
  onRateLimited?: (result: RateLimitResult) => Response;
}

/**
 * Create rate limit check for API routes
 */
export function createRateLimitCheck(options: RateLimitMiddlewareOptions = {}) {
  const {
    limitName = 'global',
    getIdentifier = getDefaultIdentifier,
    onRateLimited = defaultRateLimitedResponse,
  } = options;

  return async function checkRateLimit(request: Request): Promise<Response | null> {
    const identifier = getIdentifier(request);
    const result = rateLimiter.check(limitName, identifier);

    if (!result.allowed) {
      return onRateLimited(result);
    }

    return null; // Request is allowed
  };
}

function getDefaultIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a hash of user agent
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `ua:${simpleHash(userAgent)}`;
}

function defaultRateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      retryAfter: result.retryAfter,
      message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimiter.getHeaders(result),
      },
    }
  );
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================
// Tenant-Aware Rate Limiting
// ============================================

export interface TenantRateLimitOptions {
  tenantId: string;
  userId?: string;
  ip?: string;
}

/**
 * Check rate limits for a tenant request
 */
export function checkTenantRateLimit(options: TenantRateLimitOptions): RateLimitResult {
  const checks: { limitName: string; identifier: string }[] = [];

  // Tenant-level limit
  checks.push({ limitName: 'tenant', identifier: options.tenantId });

  // User-level limit
  if (options.userId) {
    checks.push({ limitName: 'user', identifier: options.userId });
  }

  // IP-level limit
  if (options.ip) {
    checks.push({ limitName: 'global', identifier: options.ip });
  }

  return rateLimiter.checkMultiple(checks);
}
