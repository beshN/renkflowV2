/**
 * Rate Limiting for Financial Actions
 * Prevents abuse of sensitive financial endpoints
 */

import 'server-only';

// ============================================
// Types
// ============================================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// ============================================
// Rate Limit Configurations
// ============================================

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Finance actions
  'finance.payment.create': { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
  'finance.payment.delete': { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per minute
  'finance.document.upload': { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
  'finance.export': { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
  'finance.batch': { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
  
  // Auth actions
  'auth.login': { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 mins
  'auth.signup': { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  'auth.password_reset': { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  
  // Default
  'default': { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
};

// ============================================
// Rate Limiter Class
// ============================================

export class RateLimiter {
  /**
   * Check if request is rate limited
   * Returns { limited: boolean, remaining: number, resetIn: number }
   */
  static check(
    identifier: string,
    action: string
  ): { limited: boolean; remaining: number; resetIn: number } {
    const config = RATE_LIMITS[action] || RATE_LIMITS['default'];
    const key = `${action}:${identifier}`;
    const now = Date.now();

    // Get or create entry
    let entry = rateLimitStore.get(key);

    if (!entry || now >= entry.resetAt) {
      // Reset window
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
    }

    // Check if limited
    if (entry.count >= config.maxRequests) {
      return {
        limited: true,
        remaining: 0,
        resetIn: Math.ceil((entry.resetAt - now) / 1000),
      };
    }

    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);

    return {
      limited: false,
      remaining: config.maxRequests - entry.count,
      resetIn: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  /**
   * Clear rate limit for an identifier/action
   */
  static clear(identifier: string, action: string): void {
    const key = `${action}:${identifier}`;
    rateLimitStore.delete(key);
  }

  /**
   * Clear all rate limits (for testing)
   */
  static clearAll(): void {
    rateLimitStore.clear();
  }

  /**
   * Get current limit status
   */
  static getStatus(
    identifier: string,
    action: string
  ): { count: number; maxRequests: number; resetAt: number } | null {
    const config = RATE_LIMITS[action] || RATE_LIMITS['default'];
    const key = `${action}:${identifier}`;
    const entry = rateLimitStore.get(key);

    if (!entry) {
      return null;
    }

    return {
      count: entry.count,
      maxRequests: config.maxRequests,
      resetAt: entry.resetAt,
    };
  }
}

// ============================================
// Rate Limit Error
// ============================================

export class RateLimitError extends Error {
  public readonly statusCode = 429;
  public readonly code = 'RATE_LIMITED';
  public readonly resetIn: number;

  constructor(resetIn: number) {
    super(`İstek limiti aşıldı. ${resetIn} saniye sonra tekrar deneyin.`);
    this.name = 'RateLimitError';
    this.resetIn = resetIn;
  }
}

// ============================================
// Rate Limit Middleware Helper
// ============================================

/**
 * Require rate limit check - throws RateLimitError if limited
 */
export function requireRateLimit(
  identifier: string,
  action: string
): void {
  const result = RateLimiter.check(identifier, action);
  
  if (result.limited) {
    throw new RateLimitError(result.resetIn);
  }
}

/**
 * Higher-order function to wrap actions with rate limiting
 */
export async function withRateLimit<T>(
  identifier: string,
  action: string,
  callback: () => Promise<T>
): Promise<T> {
  requireRateLimit(identifier, action);
  return callback();
}

// ============================================
// Cleanup Expired Entries (run periodically)
// ============================================

export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Run cleanup every 5 minutes in server environment
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}
