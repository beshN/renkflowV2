/**
 * Hardened Database Layer
 *
 * Features:
 * - Fail-fast principle in production
 * - Connection monitoring and health checks
 * - URL validation
 * - Cloud SQL / standard PostgreSQL compatibility
 */

import { ConnectionInfo } from '@/lib/types';
import postgres from 'postgres';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';

let cachedClient: any = null;

function resolveDatabaseRuntimeConfig(databaseUrl: string): {
  connectionString: string;
  clientOptions: Record<string, unknown>;
} {
  try {
    const parsed = new URL(databaseUrl);
    const socketHost = parsed.searchParams.get('host');
    // Neon URLs can include this libpq option; postgres.js manages TLS itself.
    parsed.searchParams.delete('channel_binding');
    const clientOptions: Record<string, unknown> = {};

    // postgres.js does not honor `host` from query params as socket host.
    // Move it into explicit client options and remove it from startup params.
    if (socketHost && socketHost.startsWith('/')) {
      clientOptions.host = socketHost;
      parsed.searchParams.delete('host');
    }

    return {
      connectionString: parsed.toString(),
      clientOptions,
    };
  } catch {
    return {
      connectionString: databaseUrl,
      clientOptions: {},
    };
  }
}

// Connection state
let connectionInfo: ConnectionInfo = {
  status: 'disconnected',
  lastConnectedAt: null,
  errorMessage: null,
  latencyMs: null,
};

export function validateDatabaseUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      throw new Error(`Invalid protocol: ${parsed.protocol}. Expected: postgresql://`);
    }

    const runtimeHost = parsed.hostname?.trim().toLowerCase() || '';
    const socketHost = parsed.searchParams.get('host')?.trim() || '';
    const hasCloudSqlSocketHost = socketHost.startsWith('/cloudsql/');
    const isLocalHost =
      runtimeHost === 'localhost' ||
      runtimeHost === '127.0.0.1' ||
      runtimeHost === '::1';
    if (!runtimeHost && !socketHost) {
      throw new Error('Missing hostname or Cloud SQL host socket in DATABASE_URL');
    }

    if (IS_PRODUCTION && isLocalHost && !hasCloudSqlSocketHost && !(process.env.ALLOW_LOCAL_DATABASE === '1' && parsed.port)) {
      throw new Error(
        'Production DATABASE_URL cannot target localhost without an explicit local test flag'
      );
    }
  } catch (error) {
    throw new Error(`[RenkFlow DB] Invalid DATABASE_URL format: ${error}`);
  }
}

function createDummyClient() {
  const dummy: any = (async () => []) as any;
  dummy.unsafe = async () => [];
  dummy.begin = async (cb: (tx: any) => Promise<unknown>) => cb(dummy);
  return dummy;
}

function createUnavailableClient(message: string) {
  const fail = async (): Promise<never> => {
    throw new Error(message);
  };
  const unavailable: any = fail;
  unavailable.unsafe = fail;
  unavailable.begin = fail;
  return unavailable;
}

function createLazySqlClient(databaseUrl: string) {
  const runtimeConfig = resolveDatabaseRuntimeConfig(databaseUrl);
  // postgres.js opens the socket when a query executes, not when this factory runs.
  // Preserve its native tagged query objects so nested SQL fragments stay composable.
  return postgres(runtimeConfig.connectionString, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: process.env.VERCEL ? 3 : 10,
    max_lifetime: 300,
    prepare: false,
    ...runtimeConfig.clientOptions,
  });
}

function createSqlClient() {
  if (IS_BUILD_TIME) {
    return createDummyClient();
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (IS_PRODUCTION) {
      const message =
        '[RenkFlow DB] FATAL: DATABASE_URL is not defined in production. ' +
        'Please configure your database connection in environment variables.';
      console.error(message);
      return createUnavailableClient(message);
    }
    console.warn('[RenkFlow DB] DATABASE_URL is not defined. Database features will not work.');
    return createDummyClient();
  }

  validateDatabaseUrl(databaseUrl);
  return createLazySqlClient(databaseUrl);
}

export function getSql() {
  if (!cachedClient) {
    cachedClient = createSqlClient();
  }
  return cachedClient;
}

export const sql = getSql();

export async function sqlQuery(query: string, params: unknown[] = []): Promise<any[]> {
  const client = getSql();
  return client.unsafe(query, params);
}

export function getConnectionInfo(): ConnectionInfo {
  return { ...connectionInfo };
}

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

export async function withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
  const client = getSql();
  return client.begin(async (tx: any) => callback(tx));
}

export function validateDatabaseConfig(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (IS_PRODUCTION && !IS_BUILD_TIME && !databaseUrl) {
    throw new Error(
      '[RenkFlow DB] Build validation failed: DATABASE_URL is required in production'
    );
  }
  if (databaseUrl) {
    validateDatabaseUrl(databaseUrl);
  }
}
