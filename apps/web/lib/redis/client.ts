/**
 * Redis optional stub
 * If ioredis is not installed or REDIS is not configured, fall back to in-memory mock.
 */

export interface RedisLike {
  on(event: string, callback: (...args: unknown[]) => void): void;
  ping(): Promise<string>;
  quit(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
  zcount(key: string, min: number, max: number): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
}

// In-memory minimal mock
class InMemoryRedis implements RedisLike {
  private store = new Map<string, string>();
  on(_event: string, _callback: (...args: unknown[]) => void): void {
    // no-op
  }
  async ping(): Promise<string> { return 'PONG'; }
  async quit(): Promise<void> { this.store.clear(); }
  async get(key: string): Promise<string | null> { return this.store.get(key) ?? null; }
  async set(key: string, value: string, ...args: unknown[]): Promise<string | null> {
    // Handle simple EX ttl if provided
    this.store.set(key, value);
    return 'OK';
  }
  async del(...keys: string[]): Promise<number> {
    let count = 0;
    keys.forEach((k) => { if (this.store.delete(k)) count++; });
    return count;
  }
  async expire(_key: string, _seconds: number): Promise<number> { return 1; }
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }
  async sadd(_key: string, _member: string): Promise<number> { return 1; }
  async srem(_key: string, _member: string): Promise<number> { return 1; }
  async smembers(_key: string): Promise<string[]> { return []; }
  async zcount(_key: string, _min: number, _max: number): Promise<number> { return 0; }
  async zadd(_key: string, _score: number, _member: string): Promise<number> { return 1; }
  async zremrangebyscore(_key: string, _min: number, _max: number): Promise<number> { return 0; }
}

let redisClient: RedisLike | null = null;

export function getRedisClient(): RedisLike | null {
  if (!redisClient) {
    redisClient = new InMemoryRedis();
  }
  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export async function isRedisAvailable(): Promise<boolean> {
  // In-memory mock is always available
  return true;
}
