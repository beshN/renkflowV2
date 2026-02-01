/**
 * Query Optimization Utilities
 * 
 * Features:
 * - N+1 query prevention with data loader pattern
 * - Query batching and caching
 * - Automatic relationship loading
 * - Performance monitoring
 */

import { sql } from '@/lib/db/neon';

// ============================================
// DataLoader Pattern Implementation
// ============================================

export class DataLoader<K, V> {
  private cache = new Map<string, V>();
  private pending = new Map<string, Promise<V>>();
  private resolvers = new Map<string, { resolve: (value: V) => void; reject: (error: Error) => void }>();
  private batchFn: (keys: K[]) => Promise<Map<K, V>>;
  private keyFn: (key: K) => string;
  private batchSchedule: NodeJS.Timeout | null = null;
  private batchKeys: K[] = [];

  constructor(
    batchFn: (keys: K[]) => Promise<Map<K, V>>,
    keyFn: (key: K) => string = (k) => String(k)
  ) {
    this.batchFn = batchFn;
    this.keyFn = keyFn;
  }

  async load(key: K): Promise<V | undefined> {
    const keyStr = this.keyFn(key);

    // Check cache first
    if (this.cache.has(keyStr)) {
      return this.cache.get(keyStr);
    }

    // Check if there's a pending request
    if (this.pending.has(keyStr)) {
      return this.pending.get(keyStr);
    }

    // Schedule batch
    this.batchKeys.push(key);
    
    if (!this.batchSchedule) {
      this.batchSchedule = setTimeout(() => this.executeBatch(), 0);
    }

    // Create pending promise
    const promise = new Promise<V>((resolve, reject) => {
      this.resolvers.set(keyStr, { resolve, reject });
    });

    this.pending.set(keyStr, promise);
    return promise;
  }

  async loadMany(keys: K[]): Promise<(V | undefined)[]> {
    return Promise.all(keys.map(key => this.load(key)));
  }

  private async executeBatch(): Promise<void> {
    const keys = [...this.batchKeys];
    this.batchKeys = [];
    this.batchSchedule = null;

    try {
      const results = await this.batchFn(keys);
      
      for (const [key, value] of results) {
        const keyStr = this.keyFn(key);
        this.cache.set(keyStr, value);
        const resolver = this.resolvers.get(keyStr);
        if (resolver) {
          resolver.resolve(value);
          this.resolvers.delete(keyStr);
        }
      }

      // Resolve undefined for missing keys
      for (const key of keys) {
        const keyStr = this.keyFn(key);
        if (!this.cache.has(keyStr)) {
          this.cache.set(keyStr, undefined as V);
          const resolver = this.resolvers.get(keyStr);
          if (resolver) {
            resolver.resolve(undefined as V);
            this.resolvers.delete(keyStr);
          }
        }
      }
    } catch (error) {
      console.error('DataLoader batch error:', error);
      for (const key of keys) {
        const keyStr = this.keyFn(key);
        const resolver = this.resolvers.get(keyStr);
        if (resolver) {
          resolver.reject(error as Error);
          this.resolvers.delete(keyStr);
        }
      }
    }
  }

  clear(key?: K): void {
    if (key !== undefined) {
      this.cache.delete(this.keyFn(key));
    } else {
      this.cache.clear();
    }
  }

  prime(key: K, value: V): void {
    this.cache.set(this.keyFn(key), value);
  }
}

// ============================================
// Optimized Order Queries
// ============================================

export const orderLoader = new DataLoader<string, any>(
  async (orderIds) => {
    const orders = await sql`
      SELECT * FROM orders
      WHERE id = ANY(${orderIds})
    `;
    
    const map = new Map();
    for (const order of orders) {
      map.set(order.id, order);
    }
    return map;
  },
  (id) => id
);

export const customerLoader = new DataLoader<string, any>(
  async (emails) => {
    const customers = await sql`
      SELECT 
        email,
        customer_name as name,
        COUNT(*) as order_count,
        SUM(total_amount) as total_spent,
        MAX(created_at) as last_order_date
      FROM orders
      WHERE email = ANY(${emails})
      GROUP BY email, customer_name
    `;
    
    const map = new Map();
    for (const customer of customers) {
      map.set(customer.email, customer);
    }
    return map;
  },
  (email) => email
);

// ============================================
// Query Builders with Join Optimization
// ============================================

export interface QueryOptions {
  select?: string[];
  where?: Record<string, unknown>;
  orderBy?: { column: string; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
  include?: string[];
}

export async function getOrdersWithRelations(
  tenantId: string,
  options: QueryOptions = {}
) {
  const { limit = 50, offset = 0 } = options;

  // Single query with all relations
  const orders = await sql`
    SELECT 
      o.*,
      json_agg(
        json_build_object(
          'id', d.id,
          'fileName', d.file_name,
          'fileUrl', d.file_url,
          'fileType', d.file_type
        )
      ) FILTER (WHERE d.id IS NOT NULL) as documents,
      json_build_object(
        'id', u.id,
        'name', u.name,
        'email', u.email
      ) as creator
    FROM orders o
    LEFT JOIN documents d ON d.order_id = o.id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.tenant_id = ${tenantId}
    GROUP BY o.id, u.id
    ORDER BY o.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return orders.map(row => ({
    ...row,
    documents: row.documents || [],
    creator: row.creator,
  }));
}

export async function getOrderWithAllRelations(orderId: string) {
  const [order] = await sql`
    SELECT 
      o.*,
      json_agg(
        json_build_object(
          'id', d.id,
          'fileName', d.file_name,
          'fileUrl', d.file_url,
          'fileType', d.file_type,
          'createdAt', d.created_at
        )
      ) FILTER (WHERE d.id IS NOT NULL) as documents,
      json_agg(
        json_build_object(
          'id', h.id,
          'status', h.status,
          'note', h.note,
          'createdAt', h.created_at,
          'createdBy', json_build_object('name', u.name, 'email', u.email)
        )
      ) FILTER (WHERE h.id IS NOT NULL) as status_history,
      json_build_object(
        'id', u.id,
        'name', u.name,
        'email', u.email
      ) as creator
    FROM orders o
    LEFT JOIN documents d ON d.order_id = o.id
    LEFT JOIN order_status_history h ON h.order_id = o.id
    LEFT JOIN users u ON u.id = o.created_by OR u.id = h.created_by
    WHERE o.id = ${orderId}
    GROUP BY o.id, u.id
  `;

  return order;
}

// ============================================
// Batching Utilities
// ============================================

export async function batchUpdateStatus(
  orderIds: string[],
  newStatus: string,
  updatedBy: string
): Promise<number> {
  const result = await sql`
    UPDATE orders
    SET 
      status = ${newStatus},
      updated_at = NOW(),
      updated_by = ${updatedBy}
    WHERE id = ANY(${orderIds})
    RETURNING id
  `;

  return result.length;
}

export async function batchInsertDocuments(
  documents: Array<{
    orderId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
  }>
): Promise<void> {
  if (documents.length === 0) return;

  // Use individual inserts for safety (Neon http client doesn't support bulk insert with sql.unsafe)
  for (const d of documents) {
    await sql`
      INSERT INTO documents (order_id, file_name, file_url, file_type, created_at)
      VALUES (${d.orderId}, ${d.fileName}, ${d.fileUrl}, ${d.fileType}, NOW())
    `;
  }
}

// ============================================
// Query Performance Monitoring
// ============================================

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  rowsAffected?: number;
}

const queryLog: QueryMetrics[] = [];
const MAX_LOG_SIZE = 1000;

export async function measureQuery<T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await queryFn();
    const duration = performance.now() - start;
    
    // Log slow queries (> 500ms)
    if (duration > 500) {
      console.warn(`[Slow Query] ${name}: ${duration.toFixed(2)}ms`);
    }
    
    // Add to log
    queryLog.push({
      query: name,
      duration,
      timestamp: new Date(),
    });
    
    // Trim log if too large
    if (queryLog.length > MAX_LOG_SIZE) {
      queryLog.splice(0, queryLog.length - MAX_LOG_SIZE);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Query Error] ${name}: ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

export function getQueryStats(): {
  totalQueries: number;
  averageDuration: number;
  slowQueries: number;
  recentQueries: QueryMetrics[];
} {
  const recent = queryLog.slice(-100);
  const totalDuration = recent.reduce((sum, q) => sum + q.duration, 0);
  
  return {
    totalQueries: queryLog.length,
    averageDuration: recent.length > 0 ? totalDuration / recent.length : 0,
    slowQueries: recent.filter(q => q.duration > 500).length,
    recentQueries: recent.slice(-10),
  };
}

// ============================================
// Caching Layer
// ============================================

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class QueryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTL = 60000) { // 1 minute default
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttl || this.defaultTTL),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Cache-aside pattern
  async getOrSet(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    
    const value = await fetchFn();
    this.set(key, value, ttl);
    return value;
  }
}

// Global caches
export const orderCache = new QueryCache<any>(30000); // 30 seconds
export const dashboardCache = new QueryCache<any>(60000); // 1 minute
export const reportCache = new QueryCache<any>(300000); // 5 minutes
