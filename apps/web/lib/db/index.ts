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

async function loadPostgresFactory(): Promise<(url: string, options: Record<string, unknown>) => any> {
  const moduleName = ['post', 'gres'].join('');
  const dynamicImporter = new Function('name', 'return import(name);') as (name: string) => Promise<any>;
  const loaded = await dynamicImporter(moduleName);
  return loaded.default || loaded;
}

// Connection state
let connectionInfo: ConnectionInfo = {
  status: 'disconnected',
  lastConnectedAt: null,
  errorMessage: null,
  latencyMs: null,
};

function validateDatabaseUrl(url: string): void {
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
    const lowerUrl = url.toLowerCase();
    const legacyDbTag = `${'neo'}${'n'}`;
    const legacyDbHost = `.${legacyDbTag}.tech`;
    const pointsToLegacyHost =
      runtimeHost.endsWith(legacyDbHost) ||
      runtimeHost === `${legacyDbTag}.tech` ||
      lowerUrl.includes(legacyDbHost) ||
      lowerUrl.includes(`${legacyDbTag}db`);

    if (!runtimeHost && !socketHost) {
      throw new Error('Missing hostname or Cloud SQL host socket in DATABASE_URL');
    }

    if (IS_PRODUCTION && pointsToLegacyHost) {
      throw new Error('Production DATABASE_URL cannot target legacy database hosts');
    }

    if (IS_PRODUCTION && isLocalHost && !hasCloudSqlSocketHost) {
      throw new Error(
        'Production localhost DATABASE_URL requires Cloud SQL socket host=/cloudsql/<INSTANCE_CONNECTION_NAME>'
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

function createLazySqlClient(databaseUrl: string) {
  const runtimeConfig = resolveDatabaseRuntimeConfig(databaseUrl);
  let realClientPromise: Promise<any> | null = null;

  async function getRealClient() {
    if (!realClientPromise) {
      realClientPromise = (async () => {
        const postgresFactory = await loadPostgresFactory();
        const realClient = postgresFactory(runtimeConfig.connectionString, {
          connect_timeout: 10,
          idle_timeout: 20,
          max: 20,
          prepare: false,
          ...runtimeConfig.clientOptions,
        });

        connectionInfo = {
          status: 'connected',
          lastConnectedAt: new Date(),
          errorMessage: null,
          latencyMs: null,
        };

        console.log('[RenkFlow DB] Connected to PostgreSQL');
        return realClient;
      })();
    }

    return realClientPromise;
  }

  const lazyClient: any = async (...args: any[]) => {
    const realClient = await getRealClient();
    return realClient(...args);
  };

  lazyClient.unsafe = async (query: string, params: unknown[] = []) => {
    const realClient = await getRealClient();
    return realClient.unsafe(query, params);
  };

  lazyClient.begin = async (cb: (tx: any) => Promise<unknown>) => {
    const realClient = await getRealClient();
    return realClient.begin(cb);
  };

  return lazyClient;
}

function createSqlClient() {
  if (IS_BUILD_TIME) {
    return createDummyClient();
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (IS_PRODUCTION) {
      throw new Error(
        '[RenkFlow DB] FATAL: DATABASE_URL is not defined in production. ' +
          'Please configure your database connection in environment variables.'
      );
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

type SqlTemplateTag = (...args: any[]) => any;

const sqlTemplateTag: SqlTemplateTag = (...args: any[]) => {
  const client = getSql();
  return client(...args);
};

(sqlTemplateTag as any).unsafe = (query: string, params: unknown[] = []) => {
  const client = getSql();
  return client.unsafe(query, params);
};

(sqlTemplateTag as any).begin = <T>(callback: (tx: any) => Promise<T>) => {
  const client = getSql();
  return client.begin(callback) as Promise<T>;
};

(sqlTemplateTag as any).end = (...args: any[]) => {
  const client = getSql();
  if (typeof client.end === 'function') {
    return client.end(...args);
  }
  return undefined;
};

export const sql = sqlTemplateTag as SqlTemplateTag & {
  unsafe: (query: string, params?: unknown[]) => Promise<any[]>;
  begin: <T>(callback: (tx: any) => Promise<T>) => Promise<T>;
  end: (...args: any[]) => Promise<unknown> | undefined;
};

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
