/**
 * Advanced Rate Limiter with Redis Backend
 * 
 * Features:
 * - IP-based rate limiting
 * - Sliding window algorithm
 * - Configurable block duration after exceeded attempts
 * - Graceful fallback to in-memory when Redis unavailable
 * - User-friendly error messages
 */

import { NextRequest } from 'next/server';
import { getRedisClient, isRedisAvailable } from './redis/client';
import { logger } from './monitoring/logger';

// ============================================
// Types
// ============================================

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  blocked: boolean;
  blockedUntil?: number;
  message: string;
}

export interface RateLimitInfo {
  attempts: number;
  firstAttempt: number;
  blocked: boolean;
  blockedUntil: number;
}

// ============================================
// In-Memory Fallback Store
// ============================================

const memoryStore = new Map<string, RateLimitInfo>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, info] of memoryStore.entries()) {
      if (now > info.blockedUntil && now > info.firstAttempt + 300000) {
        memoryStore.delete(key);
      }
    }
  }, 300000);
}

// ============================================
// Rate Limiter Class
// ============================================

export class RateLimiter {
  private config: RateLimitConfig;
  private useRedis: boolean = true;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs ?? 60000,
      maxAttempts: config.maxAttempts ?? 5,
      blockDurationMs: config.blockDurationMs ?? 60000,
      keyPrefix: config.keyPrefix ?? 'ratelimit:',
    };
  }

  /**
   * Get client identifier from request
   * Priority: Cloudflare > Vercel > x-real-ip > x-forwarded-for > unknown
   * 
   * NOTE: Fingerprinting disabled - causes false positives in shared IP environments
   * (offices, universities, mobile carriers using CGNAT)
   */
  private getIdentifier(request: NextRequest): string {
    // Cloudflare's connecting IP (most reliable when using CF)
    const cfIp = request.headers.get('cf-connecting-ip');
    
    // Vercel's real IP header
    const vercelIp = request.headers.get('x-vercel-forwarded-for');
    
    // Standard reverse proxy headers
    const realIp = request.headers.get('x-real-ip');
    const forwardedFor = request.headers.get('x-forwarded-for');
    
    // NextRequest.ip (available in edge runtime)
    const nextIp = (request as any).ip;
    
    // Determine the most reliable IP
    const ip = cfIp || 
               vercelIp?.split(',')[0]?.trim() || 
               nextIp ||
               realIp || 
               forwardedFor?.split(',')[0]?.trim() || 
               'unknown';
    
    // Return IP only - no fingerprinting
    // Fingerprinting causes issues in shared IP environments:
    // - Office networks (100+ users behind 1 IP)
    // - Mobile carriers with CGNAT
    // - Universities, libraries
    return ip;
  }

  /**
   * Build Redis key
   */
  private getKey(identifier: string, endpoint: string): string {
    return `${this.config.keyPrefix}${endpoint}:${identifier}`;
  }

  /**
   * Check rate limit using Redis
   */
  private async checkRedis(key: string): Promise<RateLimitResult> {
    const redis = getRedisClient();
    const now = Date.now();

    if (!redis) {
      return this.checkMemory(key);
    }

    try {
      // Check if blocked
      const blockKey = `${key}:blocked`;
      const blockedUntil = await redis.get(blockKey);

      if (blockedUntil && parseInt(blockedUntil) > now) {
        const remaining = parseInt(blockedUntil) - now;
        return {
          allowed: false,
          remaining: 0,
          resetIn: remaining,
          blocked: true,
          blockedUntil: parseInt(blockedUntil),
          message: `Çok fazla başarısız deneme. ${Math.ceil(remaining / 1000)} saniye sonra tekrar deneyin.`,
        };
      }

      // Get current window data
      const windowStart = now - this.config.windowMs;
      const attempts = await redis.zcount(key, windowStart, now);

      if (attempts >= this.config.maxAttempts) {
        // Block the IP
        const blockUntil = now + this.config.blockDurationMs;
        await redis.set(blockKey, blockUntil.toString(), 'PX', this.config.blockDurationMs);

        return {
          allowed: false,
          remaining: 0,
          resetIn: this.config.blockDurationMs,
          blocked: true,
          blockedUntil: blockUntil,
          message: `Çok fazla başarısız deneme. ${Math.ceil(this.config.blockDurationMs / 1000)} saniye engellendi.`,
        };
      }

      // Add new attempt
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.expire(key, Math.ceil(this.config.windowMs / 1000) + 60);

      // Clean old entries
      await redis.zremrangebyscore(key, 0, windowStart);

      const remaining = this.config.maxAttempts - attempts - 1;

      return {
        allowed: true,
        remaining,
        resetIn: this.config.windowMs,
        blocked: false,
        message: remaining <= 2 
          ? `Dikkat: ${remaining} deneme hakkınız kaldı.`
          : '',
      };
    } catch (error) {
      logger.warn('[RateLimiter] Redis unavailable, using in-memory fallback', {
        error: error instanceof Error ? error.message : String(error),
        key,
        fallbackActive: true,
      });
      this.useRedis = false;
      return this.checkMemory(key);
    }
  }

  /**
   * Check rate limit using in-memory store (fallback)
   */
  private checkMemory(key: string): RateLimitResult {
    const now = Date.now();
    let info = memoryStore.get(key);

    // Check if blocked
    if (info?.blocked && info.blockedUntil > now) {
      const remaining = info.blockedUntil - now;
      return {
        allowed: false,
        remaining: 0,
        resetIn: remaining,
        blocked: true,
        blockedUntil: info.blockedUntil,
        message: `Çok fazla başarısız deneme. ${Math.ceil(remaining / 1000)} saniye sonra tekrar deneyin.`,
      };
    }

    // Reset if window expired or unblocked
    if (!info || now - info.firstAttempt > this.config.windowMs || (info.blocked && info.blockedUntil <= now)) {
      info = {
        attempts: 0,
        firstAttempt: now,
        blocked: false,
        blockedUntil: 0,
      };
    }

    info.attempts++;

    if (info.attempts > this.config.maxAttempts) {
      // Block
      info.blocked = true;
      info.blockedUntil = now + this.config.blockDurationMs;
      memoryStore.set(key, info);

      return {
        allowed: false,
        remaining: 0,
        resetIn: this.config.blockDurationMs,
        blocked: true,
        blockedUntil: info.blockedUntil,
        message: `Çok fazla başarısız deneme. ${Math.ceil(this.config.blockDurationMs / 1000)} saniye engellendi.`,
      };
    }

    memoryStore.set(key, info);
    const remaining = this.config.maxAttempts - info.attempts;

    return {
      allowed: true,
      remaining,
      resetIn: this.config.windowMs - (now - info.firstAttempt),
      blocked: false,
      message: remaining <= 2 
        ? `Dikkat: ${remaining} deneme hakkınız kaldı.`
        : '',
    };
  }

  /**
   * Check if request is rate limited
   */
  async check(request: NextRequest, endpoint: string = 'default'): Promise<RateLimitResult> {
    const identifier = this.getIdentifier(request);
    const key = this.getKey(identifier, endpoint);

    if (this.useRedis && await isRedisAvailable()) {
      return this.checkRedis(key);
    }

    return this.checkMemory(key);
  }

  /**
   * Record a failed attempt (for auth failures)
   */
  async recordFailure(request: NextRequest, endpoint: string = 'auth'): Promise<RateLimitResult> {
    return this.check(request, endpoint);
  }

  /**
   * Clear rate limit for an IP (on successful login)
   */
  async clearLimit(request: NextRequest, endpoint: string = 'auth'): Promise<void> {
    const identifier = this.getIdentifier(request);
    const key = this.getKey(identifier, endpoint);

    if (this.useRedis && await isRedisAvailable()) {
      const redis = getRedisClient();
      if (redis) {
        await redis.del(key);
        await redis.del(`${key}:blocked`);
      }
    } else {
      memoryStore.delete(key);
    }
  }
}

// ============================================
// Pre-configured Limiters
// ============================================

/**
 * Auth rate limiter: 5 failed attempts -> 1 minute block
 */
export const authRateLimiter = new RateLimiter({
  windowMs: 60000,
  maxAttempts: 5,
  blockDurationMs: 60000,
  keyPrefix: 'auth:',
});

/**
 * API rate limiter: 100 requests per minute
 */
export const apiRateLimiter = new RateLimiter({
  windowMs: 60000,
  maxAttempts: 100,
  blockDurationMs: 60000,
  keyPrefix: 'api:',
});

/**
 * Password reset rate limiter: 3 attempts per 15 minutes
 */
export const passwordResetLimiter = new RateLimiter({
  windowMs: 900000,
  maxAttempts: 3,
  blockDurationMs: 900000,
  keyPrefix: 'pwreset:',
});

/**
 * Registration rate limiter: 5 registrations per hour
 */
export const registrationLimiter = new RateLimiter({
  windowMs: 3600000,
  maxAttempts: 5,
  blockDurationMs: 3600000,
  keyPrefix: 'register:',
});

// ============================================
// Middleware Helper
// ============================================

export interface RateLimitMiddlewareOptions {
  limiter?: RateLimiter;
  endpoint?: string;
  onBlocked?: (result: RateLimitResult) => void;
}

/**
 * Create rate limit check result for API response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: result.message,
      retryAfter: Math.ceil(result.resetIn / 1000),
      blocked: result.blocked,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetIn / 1000).toString(),
        'Retry-After': Math.ceil(result.resetIn / 1000).toString(),
      },
    }
  );
}
