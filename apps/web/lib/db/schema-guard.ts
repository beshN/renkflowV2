import { sql } from '@/lib/db';

type CachedTableState = {
  exists: boolean;
  checkedAt: number;
};

const tableExistsCache = new Map<string, CachedTableState>();
const TABLE_EXISTS_TTL_MS = 5 * 60 * 1000;

export async function tableExists(tableName: string): Promise<boolean> {
  const normalized = tableName.trim().toLowerCase();
  const cached = tableExistsCache.get(normalized);

  if (cached && Date.now() - cached.checkedAt < TABLE_EXISTS_TTL_MS) {
    return cached.exists;
  }

  try {
    const result = await sql`
      SELECT to_regclass(${`public.${normalized}`}) as regclass
    `;
    const rows = result as Array<{ regclass: string | null }>;
    const exists = Boolean(rows[0]?.regclass);
    tableExistsCache.set(normalized, { exists, checkedAt: Date.now() });
    return exists;
  } catch {
    tableExistsCache.set(normalized, { exists: false, checkedAt: Date.now() });
    return false;
  }
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
