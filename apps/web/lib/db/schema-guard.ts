import * as database from '@/lib/db';

type CachedTableState = {
  exists: boolean;
  checkedAt: number;
};

// Schema checks let code ship before its migration. They run inside transactions, so they use their
// own one-connection client (never the pool the transaction is holding), share a single query when
// asked at once, keep "exists" for good (migrations only add) and recheck "missing" every 5 minutes.
// A failed check is not cached and is not turned into "missing": that would silently skip writes
// (ledger, tax rows) until the cache expired; the error goes up and the request can be retried.
const tableExistsCache = new Map<string, CachedTableState>();
const TABLE_EXISTS_TTL_MS = 5 * 60 * 1000;
const inFlight = new Map<string, Promise<boolean>>();

function metaSql() {
  return typeof database.getMetaSql === 'function' ? database.getMetaSql() : database.sql;
}

async function cachedCheck(cache: Map<string, CachedTableState>, key: string, query: () => Promise<boolean>): Promise<boolean> {
  const cached = cache.get(key);
  if (cached && (cached.exists || Date.now() - cached.checkedAt < TABLE_EXISTS_TTL_MS)) return cached.exists;
  let pending = inFlight.get(key);
  if (!pending) {
    pending = query().then((exists) => {
      cache.set(key, { exists, checkedAt: Date.now() });
      return exists;
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

export async function tableExists(tableName: string): Promise<boolean> {
  const normalized = tableName.trim().toLowerCase();
  return cachedCheck(tableExistsCache, 'table:' + normalized, async () => {
    const [row] = await metaSql()`SELECT to_regclass(${`public.${normalized}`}) AS regclass`;
    return Boolean(row?.regclass);
  });
}

export function isMissingRelationError(error: unknown, relationNames: string[] = []): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === '42P01' || code === '42703') {
    return true;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  if (!message) {
    return false;
  }

  if (
    message.includes('does not exist') ||
    message.includes('undefined table') ||
    message.includes('undefined column')
  ) {
    if (relationNames.length === 0) {
      return true;
    }
    const normalizedNames = relationNames.map((name) => name.toLowerCase());
    return normalizedNames.some((name) => message.includes(name));
  }

  return false;
}

const columnExistsCache = new Map<string, CachedTableState>();

/** Whether a column exists yet (a release adds it with a migration that may run after the code). */
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName.trim().toLowerCase()}.${columnName.trim().toLowerCase()}`;
  return cachedCheck(columnExistsCache, 'column:' + key, async () => {
    const [row] = await metaSql()`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name = ${columnName}) AS ok`;
    return Boolean(row?.ok);
  });
}
