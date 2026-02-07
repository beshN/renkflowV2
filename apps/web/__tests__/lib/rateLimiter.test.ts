/**
 * Rate Limiter Tests
 */

import { RateLimiter } from '@/lib/rateLimiter';
import { NextRequest } from 'next/server';

// Mock Redis
jest.mock('@/lib/redis/client', () => ({
  getRedisClient: jest.fn(),
  isRedisAvailable: jest.fn().mockResolvedValue(false),
}));

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      windowMs: 60000,
      maxAttempts: 5,
      blockDurationMs: 60000,
      keyPrefix: 'test:',
    });
  });

  const createMockRequest = (ip: string = '127.0.0.1'): NextRequest => {
    return {
      headers: {
        get: (name: string) => {
          if (name === 'x-forwarded-for') return ip;
          return null;
        },
      },
    } as unknown as NextRequest;
  };

  describe('check', () => {
    it('should allow requests under the limit', async () => {
      const request = createMockRequest();
      const result = await limiter.check(request, 'test');

      expect(result.allowed).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should track remaining attempts', async () => {
      const request = createMockRequest();
      
      const result1 = await limiter.check(request, 'test1');
      expect(result1.remaining).toBe(4);

      const result2 = await limiter.check(request, 'test1');
      expect(result2.remaining).toBe(3);
    });

    it('should block after max attempts exceeded', async () => {
      const request = createMockRequest('192.168.1.100');
      
      // Exhaust all attempts
      for (let i = 0; i < 5; i++) {
        await limiter.check(request, 'block-test');
      }

      // Next attempt should be blocked
      const result = await limiter.check(request, 'block-test');
      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('should provide user-friendly message when blocked', async () => {
      const request = createMockRequest('192.168.1.101');
      
      for (let i = 0; i < 6; i++) {
        await limiter.check(request, 'message-test');
      }

      const result = await limiter.check(request, 'message-test');
      expect(result.message).toContain('saniye');
    });
  });

  describe('recordFailure', () => {
    it('should record failed attempts', async () => {
      const request = createMockRequest('192.168.1.102');
      
      const result = await limiter.recordFailure(request, 'failure-test');
      expect(result.remaining).toBeLessThan(5);
    });
  });

  describe('clearLimit', () => {
    it('should clear rate limit for IP', async () => {
      const request = createMockRequest('192.168.1.103');
      
      // Add some attempts
      await limiter.check(request, 'clear-test');
      await limiter.check(request, 'clear-test');
      
      // Clear
      await limiter.clearLimit(request, 'clear-test');
      
      // Should be reset
      const result = await limiter.check(request, 'clear-test');
      expect(result.remaining).toBe(4);
    });
  });
});
