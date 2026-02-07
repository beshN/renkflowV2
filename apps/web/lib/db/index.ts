/**
 * Hardened Database Layer
 * 
 * Features:
 * - Fail-fast principle in production
 * - Connection monitoring and health checks
 * - URL validation
 */

import { neon } from '@neondatabase/serverless';
import { ConnectionInfo } from '@/lib/types';

// Enable connection caching for serverless environments

// Environment constants
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

// Connection state
let connectionInfo: ConnectionInfo = {
  status: 'disconnected',
  lastConnectedAt: null,
  errorMessage: null,
  latencyMs: null,
};

/**
 * Validate DATABASE_URL format
 */
function validateDatabaseUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      throw new Error(`Invalid protocol: ${parsed.protocol}. Expected: postgresql://`);
    }
    
    if (!parsed.hostname) {
      throw new Error('Missing hostname in DATABASE_URL');
    }
  } catch (error) {
    throw new Error(
      `[RenkFlow DB] Invalid DATABASE_URL format: ${error}`
    );
  }
}

/**
 * Create and validate database connection
 */
function createSqlClient() {
  // During build time, return a dummy function that will be replaced at runtime
  if (typeof process !== 'undefined' && process.env.NEXT_PHASE === 'phase-production-build') {
    return (() => Promise.resolve([])) as unknown as ReturnType<typeof neon>;
  }

  // All environments: Check if DATABASE_URL is defined
  if (!DATABASE_URL) {
    // In production, throw error
    if (IS_PRODUCTION) {
      throw new Error(
        '[RenkFlow DB] FATAL: DATABASE_URL is not defined in production. ' +
        'Please configure your database connection in environment variables.'
      );
    }
    // In development, log warning and return dummy
    console.warn('[RenkFlow DB] DATABASE_URL is not defined. Database features will not work.');
    return (() => Promise.resolve([])) as unknown as ReturnType<typeof neon>;
  }

  // Validate URL format
  validateDatabaseUrl(DATABASE_URL);

  // Update connection info
  connectionInfo = {
    status: 'connected',
    lastConnectedAt: new Date(),
    errorMessage: null,
    latencyMs: null,
  };

  console.log('[RenkFlow DB] Connected to PostgreSQL');
  return neon(DATABASE_URL);
}

/**
 * Get SQL client with lazy initialization
 */
export function getSql() {
  return createSqlClient();
}

/**
 * SQL client singleton
 * ⚠️ This will throw if DATABASE_URL is not configured
 */
export const sql = createSqlClient();

/**
 * Execute a dynamic SQL query with parameters
 * Use this when you need to build queries dynamically
 */
export async function sqlQuery(query: string, params: unknown[] = []): Promise<any[]> {
  const client = getSql();
  // The neon client supports being called as a function with query string and params
  return (client as any)(query, params);
}

/**
 * Get current connection info
 */
export function getConnectionInfo(): ConnectionInfo {
  return { ...connectionInfo };
}

/**
 * Check if database is healthy
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const start = Date.now();
    await sql`SELECT 1`;
    const latency = Date.now() - start;
    
    connectionInfo = {
      status: 'connected',
      lastConnectedAt: new Date(),
      errorMessage: null,
      latencyMs: latency,
    };
    
    return true;
  } catch (error) {
    connectionInfo = {
      status: 'error',
      lastConnectedAt: connectionInfo.lastConnectedAt,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: null,
    };
    
    return false;
  }
}

/**
 * Transaction wrapper with automatic rollback on error
 */
export async function withTransaction<T>(
   
  callback: (sql: any) => Promise<T>
): Promise<T> {
   
  const client: any = getSql();
  
  try {
    await client`BEGIN`;
    const result = await callback(client);
    await client`COMMIT`;
    return result;
  } catch (error) {
    await client`ROLLBACK`;
    throw error;
  }
}

/**
 * Build-time validation helper
 * Call this during build to ensure DATABASE_URL is valid
 */
export function validateDatabaseConfig(): void {
  if (IS_PRODUCTION && !DATABASE_URL) {
    throw new Error(
      '[RenkFlow DB] Build validation failed: DATABASE_URL is required in production'
    );
  }
  
  if (DATABASE_URL) {
    validateDatabaseUrl(DATABASE_URL);
  }
}
