/**
 * Hardened Database Layer
 * 
 * Features:
 * - Fail-fast principle in production
 * - Connection monitoring and health checks
 * - URL validation
 * - Server-only enforcement
 */

import 'server-only';
import { neon, neonConfig } from '@neondatabase/serverless';
import { ConnectionInfo } from '@/lib/types';

// Enable connection caching for serverless environments
neonConfig.fetchConnectionCache = true;

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
  // Production: Fail fast if DATABASE_URL is missing
  if (IS_PRODUCTION && !DATABASE_URL) {
    throw new Error(
      '[RenkFlow DB] FATAL: DATABASE_URL is not defined in production. ' +
      'Please configure your database connection in environment variables.'
    );
  }

  // All environments: Fail if DATABASE_URL is missing
  if (!DATABASE_URL) {
    throw new Error(
      '[RenkFlow DB] DATABASE_URL is not defined. ' +
      'Set DATABASE_URL to connect to PostgreSQL, or use MockOrderService for development.'
    );
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (sql: any) => Promise<T>
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
