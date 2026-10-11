// Server code (also loaded by proxy.ts, so no 'server-only' import: the proxy bundle is not React-server).
import * as dbModule from '@/lib/db';

/** The shared client (whichever form the db module offers). */
const db = (): any => (typeof (dbModule as any).sql === 'function' ? (dbModule as any).sql : (dbModule as any).getSql());
import type { UserRole } from '@/lib/auth/permissions';
import {
  effectiveAccess, meets, presetFor, routeRequirement, sanitizeMatrix, DEFAULT_PRESET, FIELD_GROUPS,
  type Access, type FieldGroup, type Module, type Action,
} from './access-matrix';

export type MemberAccess = Access & { userId: string; tenantId: string; deactivated: boolean };

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: MemberAccess | null }>();
let columns: { ok: boolean; at: number } | null = null;

/** Whether migration 044 has run (checked at most every 5 minutes). */
async function accessColumns() {
  if (columns && (columns.ok || Date.now() - columns.at < 300_000)) return columns.ok;
  const [r] = await db()`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_members' AND column_name = 'access_role') AS ok`;
  columns = { ok: Boolean(r?.ok), at: Date.now() };
  return columns.ok;
}

/** Drops a member from the cache (after a role or status change). */
export function forgetMemberAccess(userId: string, tenantId: string) {
  cache.delete(`${tenantId}:${userId}`);
}

/**
 * A member's effective access in a firm: their base role, the role they were given (preset or
 * custom) cut down to that base, and whether they were deactivated. Null when not a member.
 */
export async function resolveMemberAccess(userId: string, tenantId: string, options: { cached?: boolean } = {}): Promise<MemberAccess | null> {
  const key = `${tenantId}:${userId}`;
  const hit = cache.get(key);
  // Only the proxy reads through the cache (≤30 s); server guards read fresh, so a demotion counts at once.
  if (options.cached && hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value: MemberAccess | null = null;
  if (await accessColumns()) {
    const [m] = await db()`
      SELECT m.role, m.access_role, m.deactivated_at, r.id AS custom_id, r.name AS custom_name, r.base_role AS custom_base, r.permissions AS custom_permissions, r.hidden_fields AS custom_hidden
      FROM tenant_members m
      LEFT JOIN access_roles r ON r.tenant_id = m.tenant_id AND r.id::text = m.access_role
      WHERE m.tenant_id = ${tenantId} AND m.user_id = ${userId} LIMIT 1`;
    if (m) {
      const base = m.role as UserRole;
      // A custom role only applies on the base role it was made for; otherwise the base role's preset.
      const custom = m.custom_id && m.custom_base === base
        ? { key: String(m.custom_id), name: m.custom_name as string, permissions: sanitizeMatrix(base, m.custom_permissions), hidden: ((m.custom_hidden ?? []) as string[]).filter((f): f is FieldGroup => (FIELD_GROUPS as readonly string[]).includes(f)) }
        : null;
      const preset = !custom && m.access_role ? presetFor(String(m.access_role)) : null;
      const role = custom ?? (preset && preset.base === base ? preset : null);
      value = { ...effectiveAccess(base, role), userId, tenantId, deactivated: Boolean(m.deactivated_at) };
    }
  } else {
    const [m] = await db()`SELECT role FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${userId} LIMIT 1`;
    if (m) value = { ...effectiveAccess(m.role as UserRole, null), userId, tenantId, deactivated: false };
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

const sessionCache = new Map<string, { at: number; revoked: boolean }>();

/**
 * Whether this sign-in no longer counts: its session row was closed, or every session of the
 * person was closed after it was issued (sign out everywhere, password reset, deactivation).
 */
export async function sessionRevoked(userId: string, sid: string | null, iat: number | null, options: { cached?: boolean } = {}) {
  if (!(await accessColumns())) return false;
  const key = `${userId}:${sid ?? ''}:${iat ?? ''}`;
  const hit = sessionCache.get(key);
  if (options.cached && hit && Date.now() - hit.at < TTL_MS) return hit.revoked;
  const [u] = await db()`SELECT sessions_valid_after FROM users WHERE id = ${userId}`;
  // iat has whole seconds: a sign-in in the same second as the cut-off still counts.
  let revoked = Boolean(u?.sessions_valid_after && iat != null && iat < Math.floor(new Date(u.sessions_valid_after).getTime() / 1000));
  if (!revoked && sid) {
    const [s] = await db()`SELECT revoked_at FROM user_sessions WHERE id = ${sid} AND user_id = ${userId}`;
    revoked = Boolean(s?.revoked_at);
  }
  sessionCache.set(key, { at: Date.now(), revoked });
  if (sessionCache.size > 10_000) sessionCache.clear();
  return revoked;
}

/** Forget cached session answers for a person (after revoking). */
export function forgetSessions(userId: string) {
  for (const k of sessionCache.keys()) if (k.startsWith(userId + ':')) sessionCache.delete(k);
}

const deniedLogged = new Map<string, number>();

/** Writes a refused attempt to the audit trail (at most once a minute per person, path and method). */
export async function logAccessDenied(a: { tenantId: string; userId: string; path: string; method: string; module: Module | null; action: Action | null; reason: string }) {
  const key = `${a.tenantId}:${a.userId}:${a.method}:${a.path}`;
  const last = deniedLogged.get(key) ?? 0;
  if (Date.now() - last < 60_000) return;
  deniedLogged.set(key, Date.now());
  if (deniedLogged.size > 5000) deniedLogged.clear();
  try {
    await db()`INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, metadata)
      VALUES (${a.tenantId}, 'security', ${a.tenantId}, 'access_denied', ${a.userId}, ${JSON.stringify({ path: a.path.slice(0, 300), method: a.method, module: a.module, action: a.action, reason: a.reason })}::text::jsonb)`;
  } catch (e) {
    console.error('[access] denied log failed', e instanceof Error ? e.message : e);
  }
}

/**
 * The single gate every signed-in request passes in the proxy: the module and action the path
 * needs against the member's access. Null when allowed (or not module-gated).
 */
export async function accessDecision(userId: string, tenantId: string, path: string, method: string, session: { sid: string | null; iat: number | null } = { sid: null, iat: null }) {
  const need = routeRequirement(path, method);
  const access = await resolveMemberAccess(userId, tenantId, { cached: true });
  if (!access) return null; // not a member: the route's own guard answers 401
  if (access.deactivated) return { status: 401 as const, reason: 'deactivated', need };
  if (await sessionRevoked(userId, session.sid, session.iat, { cached: true })) return { status: 401 as const, reason: 'session_revoked', need };
  // A member on their base role's own preset keeps exactly today's access: the route checks decide.
  // The matrix narrows only for a job preset or a custom role.
  if (!need || access.roleKey === DEFAULT_PRESET[access.base]) return null;
  if (meets(access, need)) return null;
  return { status: 403 as const, reason: 'role', need };
}

/**
 * Field groups to strip from this member's responses: only for a job preset or custom role (the
 * base role's own preset keeps today's DTOs, e.g. the worker's technical view). Cached like the gate.
 */
export async function narrowedHiddenFields(userId: string, tenantId: string): Promise<FieldGroup[]> {
  const access = await resolveMemberAccess(userId, tenantId, { cached: true });
  if (!access || access.roleKey === DEFAULT_PRESET[access.base]) return [];
  return access.hidden;
}
