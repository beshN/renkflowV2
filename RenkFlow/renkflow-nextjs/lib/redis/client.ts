/**
 * Redis Client Configuration
 * 
 * Provides a singleton Redis connection for:
 * - Rate limiting
 * - Session management
 * - Cache operations
 */

import { Redis } from 'ioredis';

// Singleton instance
let redisClient: Redis | null = null;

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  retryDelayMs?: number;
}

function getRedisConfig(): RedisConfig {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'renkflow:',
    maxRetriesPerRequest: 3,
    retryDelayMs: 100,
  };
}

/**
 * Get or create Redis client singleton
 */
export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const config = getRedisConfig();

  // Check if Redis is configured
  if (!process.env.REDIS_HOST && process.env.NODE_ENV === 'production') {
    console.warn('[Redis] REDIS_HOST not configured, using localhost');
  }

  redisClient = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: config.keyPrefix,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('[Redis] Max retries exceeded, giving up');
        return null;
      }
      return Math.min(times * config.retryDelayMs!, 3000);
    },
    lazyConnect: true,
  });

  redisClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  redisClient.on('ready', () => {
    console.log('[Redis] Ready to accept commands');
  });

  return redisClient;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Connection closed');
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
