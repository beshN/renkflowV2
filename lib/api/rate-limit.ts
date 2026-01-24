import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

// In-memory store (will reset on server restart - use Redis for production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiter for API routes
 * Note: For production, use Redis or similar persistent store
 */
export function rateLimit(config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }) {
  return {
    check: (request: NextRequest): { allowed: boolean; remaining: number; resetIn: number } => {
      const identifier = getIdentifier(request);
      const now = Date.now();
      
      const record = requestCounts.get(identifier);
      
      if (!record || now > record.resetTime) {
        // New window
        requestCounts.set(identifier, {
          count: 1,
          resetTime: now + config.windowMs,
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
      }
      
      if (record.count >= config.maxRequests) {
        return { 
          allowed: false, 
          remaining: 0, 
          resetIn: record.resetTime - now 
        };
      }
      
      record.count++;
      return { 
        allowed: true, 
        remaining: config.maxRequests - record.count, 
        resetIn: record.resetTime - now 
      };
    },
  };
}

/**
 * Get identifier for rate limiting (IP or user ID)
 */
function getIdentifier(request: NextRequest): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const cf = request.headers.get('cf-connecting-ip');
  
  // Also include path to allow different limits per endpoint
  const path = new URL(request.url).pathname;
  
  return `${cf || forwarded?.split(',')[0] || real || 'unknown'}:${path}`;
}

/**
 * Rate limit response helper
 */
export function rateLimitResponse(remaining: number, resetIn: number): NextResponse {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.',
      retryAfter: Math.ceil(resetIn / 1000),
    },
    { 
      status: 429,
      headers: {
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(resetIn / 1000).toString(),
        'Retry-After': Math.ceil(resetIn / 1000).toString(),
      },
    }
  );
}

// Pre-configured limiters for different endpoints
export const authLimiter = rateLimit({ windowMs: 60000, maxRequests: 10 }); // 10 requests per minute for auth
export const apiLimiter = rateLimit({ windowMs: 60000, maxRequests: 60 });  // 60 requests per minute for API
export const uploadLimiter = rateLimit({ windowMs: 60000, maxRequests: 10 }); // 10 uploads per minute
