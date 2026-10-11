import 'server-only';

import { sql } from '@/lib/db';

/**
 * Single audit trail (docs/adr/0001-denetim-kaydi.md): every critical business change is written
 * to `activity_logs`. Immutable domain ledgers (stock entries, production events) stay authoritative
 * for their own domains and are not copied here.
 */
export type AuditEntry = {
  tenantId: string;
  actorId?: string | null;
  entityType: string;
  /** UUID of the changed record; firm-level events (settings, invitations) use the tenant id. */
  entityId: string;
  action: string;
  changes?: Record<string, unknown> | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
};

const json = (value: Record<string, unknown> | null | undefined) => (value ? JSON.stringify(value) : null);

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pass the open transaction client when the change itself runs in one, so both commit together. */
export async function recordAudit(db: any, entry: AuditEntry): Promise<void> {
  const actorId = entry.actorId ?? null;
  await db`
    INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, actor_name, changes, note, metadata)
    VALUES (
      ${entry.tenantId}, ${entry.entityType}, ${entry.entityId}, ${entry.action}, ${actorId},
      (SELECT name FROM users WHERE id = ${actorId}),
      ${json(entry.changes)}::text::jsonb, ${entry.note ?? null}, ${json(entry.metadata)}::text::jsonb
    )
  `;
}

/**
 * For changes that have already committed outside a transaction: a failed audit write is logged,
 * not thrown, so the caller does not report a completed change as failed.
 */
export async function recordAuditAfterCommit(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(sql, entry);
  } catch (error) {
    console.error('[Audit] Kayıt yazılamadı:', entry.entityType, entry.action, error instanceof Error ? error.message : error);
  }
}

export type AuditQuery = {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
};

export async function queryAudit(tenantId: string, q: AuditQuery) {
  const where = sql`
    WHERE a.tenant_id = ${tenantId}
      ${q.entityType ? sql`AND a.entity_type = ${q.entityType}` : sql``}
      ${q.entityId ? sql`AND a.entity_id = ${q.entityId}` : sql``}
      ${q.actorId ? sql`AND a.actor_id = ${q.actorId}` : sql``}
      ${q.action ? sql`AND a.action = ${q.action}` : sql``}
      ${q.from ? sql`AND a.created_at >= ${q.from}` : sql``}
      ${q.to ? sql`AND a.created_at < ${q.to}` : sql``}
  `;
  const [rows, [count]] = await Promise.all([
    sql`
      SELECT a.id, a.entity_type, a.entity_id, a.action, a.actor_id, COALESCE(u.name, a.actor_name) AS actor_name,
        a.changes, a.note, a.metadata, a.created_at
      FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id
      ${where}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${q.limit} OFFSET ${q.offset}
    `,
    sql`SELECT COUNT(*)::int AS total FROM activity_logs a ${where}`,
  ]);
  return { items: rows, total: Number(count?.total ?? 0) };
}

/** Entity types, actions and people that appear in a firm's trail (for the viewer's filters). */
export async function auditFacets(tenantId: string) {
  const [types, actions, actors] = await Promise.all([
    sql`SELECT entity_type AS v, count(*)::int AS n FROM activity_logs WHERE tenant_id = ${tenantId} GROUP BY 1 ORDER BY 2 DESC LIMIT 60`,
    sql`SELECT action AS v, count(*)::int AS n FROM activity_logs WHERE tenant_id = ${tenantId} GROUP BY 1 ORDER BY 2 DESC LIMIT 120`,
    sql`SELECT DISTINCT a.actor_id AS id, COALESCE(u.name, a.actor_name, u.email) AS name FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE a.tenant_id = ${tenantId} AND a.actor_id IS NOT NULL LIMIT 200`,
  ]);
  return {
    entityTypes: types.map((r: any) => String(r.v)),
    actions: actions.map((r: any) => String(r.v)),
    actors: actors.map((r: any) => ({ id: String(r.id), name: (r.name as string | null) ?? 'Bilinmeyen' })),
  };
}

/** Field-level diff for an update: only keys the caller changed; long values are truncated. */
export function changedFields(before: Record<string, unknown>, updates: Record<string, unknown>) {
  const short = (value: unknown) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    return text && text.length > 300 ? text.slice(0, 300) + '…' : value ?? null;
  };
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(value ?? null)) changes[key] = { from: short(before[key]), to: short(value) };
  }
  return changes;
}
