import 'server-only';

/**
 * "Plan ve kullanım": this month's usage read from the firm's own rows. Read-only and tenant-scoped;
 * every metric runs on its own, so a missing table (migration not yet run) or a failing query shows
 * that one metric as "—" (null) instead of breaking the page.
 */

type Db = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Array<Record<string, unknown>>>;

export type FileSourceUsage = { source: string; count: number; bytes: number };

export type TenantUsage = {
  plan: { key: 'pilot'; label: string };
  firmName: string | null;
  firmCreatedAt: string | null;
  activeMembers: number | null;
  ordersThisMonth: number | null;
  ai: { monthSpendUsd: number | null; todaySpendUsd: number | null; monthCalls: number | null; dailyBudgetUsd: number | null };
  files: { count: number | null; bytes: number | null; partial: boolean; sources: FileSourceUsage[] };
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

async function metric<T>(label: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.warn(`[usage] ${label} okunamadı:`, error instanceof Error ? error.message : 'failed');
    return null;
  }
}

/** Sums the file sources that could be read; null when none could. */
export function sumFileSources(results: Array<FileSourceUsage | null>): TenantUsage['files'] {
  const ok = results.filter((r): r is FileSourceUsage => r !== null);
  if (!ok.length) return { count: null, bytes: null, partial: results.length > 0, sources: [] };
  return {
    count: ok.reduce((s, r) => s + r.count, 0),
    bytes: ok.reduce((s, r) => s + r.bytes, 0),
    partial: ok.length < results.length,
    sources: ok,
  };
}

const fileRow = (source: string) => (rows: Array<Record<string, unknown>>): FileSourceUsage => ({ source, count: num(rows[0]?.count), bytes: num(rows[0]?.bytes) });

export async function collectTenantUsage(db: Db, tenantId: string, options: { dailyBudgetUsd: number | null }): Promise<TenantUsage> {
  const [firm, activeMembers, ordersThisMonth, ai, ...files] = await Promise.all([
    metric('firma', async () => (await db`SELECT name, created_at FROM tenants WHERE id = ${tenantId}`)[0] ?? null),
    metric('üyeler', async () => num((await db`
      SELECT count(*)::int AS n FROM tenant_members m
      WHERE m.tenant_id = ${tenantId} AND (to_jsonb(m)->>'deactivated_at') IS NULL`)[0]?.n)),
    metric('siparişler', async () => num((await db`
      SELECT count(*)::int AS n FROM orders
      WHERE tenant_id = ${tenantId}
        AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`)[0]?.n)),
    // Same cost expression as the daily budget gate (lib/ai/gate.server.ts): model cost, else tool cost.
    metric('yapay zekâ', async () => (await db`
      SELECT
        coalesce(sum(coalesce(cost_usd, (to_jsonb(u)->>'tool_cost_usd')::numeric)), 0) AS month_spend,
        coalesce(sum(coalesce(cost_usd, (to_jsonb(u)->>'tool_cost_usd')::numeric))
          FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'), 0) AS today_spend,
        count(*)::int AS calls
      FROM ai_usage u
      WHERE tenant_id = ${tenantId}
        AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`)[0] ?? null),
    metric('office_files', async () => fileRow('office_files')(await db`SELECT count(*)::int AS count, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM office_files WHERE tenant_id = ${tenantId}`)),
    metric('record_attachments', async () => fileRow('record_attachments')(await db`SELECT count(*)::int AS count, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM record_attachments WHERE tenant_id = ${tenantId} AND deleted_at IS NULL`)),
    metric('order_documents', async () => fileRow('order_documents')(await db`SELECT count(*)::int AS count, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM order_documents WHERE tenant_id = ${tenantId}`)),
    metric('production_files', async () => fileRow('production_files')(await db`SELECT count(*)::int AS count, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM production_files WHERE tenant_id = ${tenantId}`)),
    metric('knowledge_revisions', async () => fileRow('knowledge_revisions')(await db`SELECT count(*)::int AS count, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM knowledge_revisions WHERE tenant_id = ${tenantId} AND file_path IS NOT NULL`)),
  ]);

  const created = firm?.created_at;
  return {
    plan: { key: 'pilot', label: 'Pilot' },
    firmName: firm ? String(firm.name ?? '') || null : null,
    firmCreatedAt: created ? new Date(created as string).toISOString() : null,
    activeMembers,
    ordersThisMonth,
    ai: {
      monthSpendUsd: ai ? num(ai.month_spend) : null,
      todaySpendUsd: ai ? num(ai.today_spend) : null,
      monthCalls: ai ? num(ai.calls) : null,
      dailyBudgetUsd: options.dailyBudgetUsd,
    },
    files: sumFileSources(files as Array<FileSourceUsage | null>),
  };
}
