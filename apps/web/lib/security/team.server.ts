import 'server-only';

import { sql, withTransaction } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { columnExists } from '@/lib/db/schema-guard';
import type { UserRole } from '@/lib/auth/permissions';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import {
  ACTIONS, DEFAULT_PRESET, FIELD_GROUPS, MODULES, PRESETS, can, effectiveAccess, presetFor, sanitizeMatrix,
  type FieldGroup, type Matrix,
} from './access-matrix';
import { forgetMemberAccess, forgetSessions, resolveMemberAccess } from './member-access.server';
import { ASSIGNABLE_ROLES, accessRoleFits, describeAgent, roleNameKey, teamChangeProblem } from './team-rules';

export type TeamActor = { userId: string; tenantId: string; role: UserRole };

/** Team management needs migration 044 (roles, deactivation, sessions). */
async function requireSchema() {
  if (!(await columnExists('tenant_members', 'access_role'))) throw new WorkOrderApiError('Ekip yönetimi için veritabanı güncellemesi (044) bekleniyor', 503);
}

/** The actor may manage the team: base owner/admin, and their role keeps team editing. */
export async function requireTeamManager(actor: TeamActor) {
  if (actor.role !== 'owner' && actor.role !== 'admin') throw new WorkOrderApiError('Ekibi yalnız firma sahibi ve yöneticiler yönetir', 403);
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated || !can(access, 'team', 'edit')) throw new WorkOrderApiError('Ekibi yönetme yetkiniz yok', 403);
  await requireSchema();
}

const fieldList = (raw: unknown): FieldGroup[] => (Array.isArray(raw) ? raw : []).filter((f): f is FieldGroup => (FIELD_GROUPS as readonly string[]).includes(f as string));

async function customRoles(tenantId: string) {
  const rows = await sql`SELECT id, name, base_role, permissions, hidden_fields, updated_at FROM access_roles WHERE tenant_id = ${tenantId} ORDER BY name`;
  return (rows as any[]).map((r: any) => ({ id: String(r.id), name: r.name as string, base: r.base_role as UserRole, permissions: sanitizeMatrix(r.base_role, r.permissions), hidden: fieldList(r.hidden_fields), updatedAt: r.updated_at }));
}

/** Members with their base role, access role, status and last activity. */
export async function listTeam(actor: TeamActor) {
  await requireSchema();
  const [members, roles] = await Promise.all([
    sql`
      SELECT u.id, u.name, u.email, m.role, m.access_role, m.deactivated_at, m.created_at,
        (SELECT max(s.last_seen_at) FROM user_sessions s WHERE s.user_id = u.id AND s.tenant_id = m.tenant_id) AS last_seen_at,
        (SELECT count(*)::int FROM user_sessions s WHERE s.user_id = u.id AND s.tenant_id = m.tenant_id AND s.revoked_at IS NULL AND s.last_seen_at > now() - interval '30 days') AS open_sessions
      FROM tenant_members m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ${actor.tenantId}
      ORDER BY (m.deactivated_at IS NOT NULL), CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name`,
    customRoles(actor.tenantId),
  ]);
  return members.map((m: any) => {
    const found = roles.find((r) => r.id === m.access_role && r.base === m.role);
    const custom = found ? { key: found.id, name: found.name, permissions: found.permissions, hidden: found.hidden } : null;
    const access = effectiveAccess(m.role, custom ?? (m.access_role && presetFor(m.access_role)?.base === m.role ? presetFor(m.access_role) : null));
    return {
      userId: String(m.id), name: m.name as string | null, email: m.email as string, role: m.role as UserRole,
      accessRole: access.roleKey, accessRoleName: access.roleName, hidden: access.hidden,
      active: !m.deactivated_at, deactivatedAt: m.deactivated_at, joinedAt: m.created_at,
      lastSeenAt: m.last_seen_at, openSessions: Number(m.open_sessions ?? 0),
    };
  });
}

async function lockTarget(tx: any, tenantId: string, userId: string) {
  const [t] = await tx`SELECT role, access_role, deactivated_at FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${userId} FOR UPDATE`;
  if (!t) throw new WorkOrderApiError('Üye bulunamadı', 404);
  return t as { role: UserRole; access_role: string | null; deactivated_at: Date | null };
}

/** Change a member's base role and/or access role (a preset key or a custom role id). */
export async function updateMember(actor: TeamActor, userId: string, input: { role?: UserRole; accessRole?: string | null }) {
  await requireTeamManager(actor);
  const roles = await customRoles(actor.tenantId);
  await withTransaction(async (tx) => {
    const t = await lockTarget(tx, actor.tenantId, userId);
    const problem = teamChangeProblem(actor, { userId, role: t.role, active: !t.deactivated_at }, { role: input.role });
    if (problem) throw new WorkOrderApiError(problem, 403);
    const role = input.role ?? t.role;
    // A role change keeps the access role only if it still fits; otherwise the new base role's preset.
    let accessRole = input.accessRole !== undefined ? input.accessRole : t.access_role;
    if (accessRole && !accessRoleFits(role, accessRole, roles)) {
      if (input.accessRole !== undefined) throw new WorkOrderApiError('Seçilen yetki rolü bu temel role uymuyor', 400);
      accessRole = null;
    }
    if (accessRole === DEFAULT_PRESET[role]) accessRole = null;
    await tx`UPDATE tenant_members SET role = ${role}, access_role = ${accessRole} WHERE tenant_id = ${actor.tenantId} AND user_id = ${userId}`;
    await recordAudit(tx, {
      tenantId: actor.tenantId, actorId: actor.userId, entityType: 'member', entityId: userId, action: 'member_role_changed',
      changes: { role: { from: t.role, to: role }, accessRole: { from: t.access_role, to: accessRole } },
    });
  });
  forgetMemberAccess(userId, actor.tenantId);
}

/** Deactivate or reactivate a member. Their records stay; a deactivated member's sessions close. */
export async function setMemberActive(actor: TeamActor, userId: string, active: boolean) {
  await requireTeamManager(actor);
  await withTransaction(async (tx) => {
    const t = await lockTarget(tx, actor.tenantId, userId);
    const problem = teamChangeProblem(actor, { userId, role: t.role, active: !t.deactivated_at }, { active });
    if (problem) throw new WorkOrderApiError(problem, 403);
    if (active === !t.deactivated_at) return;
    if (active) {
      await tx`UPDATE tenant_members SET deactivated_at = NULL, deactivated_by = NULL WHERE tenant_id = ${actor.tenantId} AND user_id = ${userId}`;
    } else {
      await tx`UPDATE tenant_members SET deactivated_at = now(), deactivated_by = ${actor.userId} WHERE tenant_id = ${actor.tenantId} AND user_id = ${userId}`;
      await tx`UPDATE user_sessions SET revoked_at = now(), revoked_by = ${actor.userId} WHERE user_id = ${userId} AND tenant_id = ${actor.tenantId} AND revoked_at IS NULL`;
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'member', entityId: userId, action: active ? 'member_reactivated' : 'member_deactivated' });
  });
  forgetMemberAccess(userId, actor.tenantId);
  forgetSessions(userId);
}

/** Preset and custom roles, with how many members use each. */
export async function listRoles(actor: TeamActor) {
  await requireSchema();
  const [roles, usage] = await Promise.all([
    customRoles(actor.tenantId),
    sql`SELECT role, access_role, count(*)::int AS n FROM tenant_members WHERE tenant_id = ${actor.tenantId} AND deactivated_at IS NULL GROUP BY role, access_role`,
  ]);
  const count = (key: string, base: UserRole) => usage.filter((u: any) => u.role === base && (u.access_role ?? DEFAULT_PRESET[base]) === key).reduce((n: number, u: any) => n + Number(u.n), 0);
  return {
    modules: MODULES, actions: ACTIONS, fields: FIELD_GROUPS, assignable: ASSIGNABLE_ROLES,
    presets: PRESETS.map((p) => ({ ...effectiveAccess(p.base, p), key: p.key, description: p.description, builtIn: true, members: count(p.key, p.base) })),
    custom: roles.map((r) => ({ ...effectiveAccess(r.base, { key: r.id, name: r.name, permissions: r.permissions, hidden: r.hidden }), key: r.id, id: r.id, builtIn: false, members: count(r.id, r.base) })),
  };
}

export type RoleInput = { name: string; base: UserRole; permissions: unknown; hidden: unknown };

function cleanRole(input: RoleInput) {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60) throw new WorkOrderApiError('Rol adı 2–60 karakter olmalı', 400);
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(input.base)) throw new WorkOrderApiError('Geçersiz temel rol', 400);
  if (PRESETS.some((p) => roleNameKey(p.name) === roleNameKey(name))) throw new WorkOrderApiError('Bu ad hazır bir rolün adı', 409);
  const permissions: Matrix = sanitizeMatrix(input.base, input.permissions);
  return { name, key: roleNameKey(name), base: input.base, permissions, hidden: fieldList(input.hidden) };
}

/** Create or update a custom role; it can never grant more than its base role. */
/** Roles on the admin base change what other admins may do: like admins themselves, only the owner manages them. */
function requireRoleAuthority(actor: TeamActor, ...bases: Array<string | null | undefined>) {
  if (actor.role !== 'owner' && bases.includes('admin')) throw new WorkOrderApiError('Yönetici temelli rolleri yalnız firma sahibi yönetir', 403);
}

export async function saveRole(actor: TeamActor, id: string | null, input: RoleInput) {
  await requireTeamManager(actor);
  const r = cleanRole(input);
  requireRoleAuthority(actor, r.base);
  try {
    return await withTransaction(async (tx) => {
      if (id) {
        const [before] = await tx`SELECT name, base_role, permissions, hidden_fields FROM access_roles WHERE id = ${id} AND tenant_id = ${actor.tenantId} FOR UPDATE`;
        if (!before) throw new WorkOrderApiError('Rol bulunamadı', 404);
        requireRoleAuthority(actor, before.base_role);
        if (before.base_role !== r.base) {
          const [used] = await tx`SELECT count(*)::int AS n FROM tenant_members WHERE tenant_id = ${actor.tenantId} AND access_role = ${id}`;
          if (Number(used?.n) > 0) throw new WorkOrderApiError('Rolü kullanan üyeler varken temel rol değiştirilemez', 409);
        }
        await tx`UPDATE access_roles SET name = ${r.name}, name_key = ${r.key}, base_role = ${r.base}, permissions = ${JSON.stringify(r.permissions)}::text::jsonb, hidden_fields = ${r.hidden}, updated_at = now() WHERE id = ${id} AND tenant_id = ${actor.tenantId}`;
        await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'access_role', entityId: id, action: 'role_updated', changes: { before: { name: before.name, base: before.base_role, permissions: before.permissions, hidden: before.hidden_fields }, after: { name: r.name, base: r.base, permissions: r.permissions, hidden: r.hidden } } });
        return id;
      }
      const [row] = await tx`INSERT INTO access_roles (tenant_id, name, name_key, base_role, permissions, hidden_fields, created_by)
        VALUES (${actor.tenantId}, ${r.name}, ${r.key}, ${r.base}, ${JSON.stringify(r.permissions)}::text::jsonb, ${r.hidden}, ${actor.userId}) RETURNING id`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'access_role', entityId: row.id, action: 'role_created', metadata: { name: r.name, base: r.base, permissions: r.permissions, hidden: r.hidden } });
      return String(row.id);
    });
  } catch (e: any) {
    if (e?.code === '23505') throw new WorkOrderApiError('Bu adla bir rol zaten var', 409);
    throw e;
  } finally {
    forgetAll(actor.tenantId);
  }
}

/** Delete a custom role; its members fall back to their base role's preset. */
export async function deleteRole(actor: TeamActor, id: string) {
  await requireTeamManager(actor);
  await withTransaction(async (tx) => {
    const [existing] = await tx`SELECT base_role FROM access_roles WHERE id = ${id} AND tenant_id = ${actor.tenantId} FOR UPDATE`;
    if (!existing) throw new WorkOrderApiError('Rol bulunamadı', 404);
    requireRoleAuthority(actor, existing.base_role);
    const [role] = await tx`DELETE FROM access_roles WHERE id = ${id} AND tenant_id = ${actor.tenantId} RETURNING name`;
    const moved = await tx`UPDATE tenant_members SET access_role = NULL WHERE tenant_id = ${actor.tenantId} AND access_role = ${id} RETURNING user_id`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'access_role', entityId: id, action: 'role_deleted', metadata: { name: role.name, members: moved.length } });
  });
  forgetAll(actor.tenantId);
}

/** Drop cached access for everyone in a firm (after a role definition changes). */
async function forgetAll(tenantId: string) {
  try {
    const rows = await sql`SELECT user_id FROM tenant_members WHERE tenant_id = ${tenantId}`;
    for (const r of rows as any[]) forgetMemberAccess(String(r.user_id), tenantId);
  } catch {
    /* the cache expires in 30 s anyway */
  }
}

/** Open invitations (never with their token: the link is shown once, when the invite is made). */
export async function listInvites(actor: TeamActor) {
  await requireTeamManager(actor);
  const rows = await sql`
    SELECT i.id, i.email, i.role, i.access_role, i.created_at, i.expires_at, u.name AS invited_by_name
    FROM invitations i LEFT JOIN users u ON u.id = i.invited_by
    WHERE i.tenant_id = ${actor.tenantId}
    ORDER BY i.created_at DESC LIMIT 200`;
  const roles = await customRoles(actor.tenantId);
  return rows.map((r: any) => ({
    id: String(r.id), email: r.email as string, role: r.role as UserRole,
    accessRoleName: (r.access_role && (presetFor(r.access_role)?.name ?? roles.find((x) => x.id === r.access_role)?.name)) || presetFor(DEFAULT_PRESET[r.role as UserRole])?.name || r.role,
    createdAt: r.created_at, expiresAt: r.expires_at, expired: new Date(r.expires_at).getTime() <= Date.now(), invitedBy: r.invited_by_name ?? null,
  }));
}

/** Whether a custom role exists for an invite's base role (presets are checked without the DB). */
export async function inviteAccessRoleFits(tenantId: string, base: UserRole, accessRole: string | null) {
  if (!accessRole) return true;
  if (presetFor(accessRole)) return accessRoleFits(base, accessRole, []);
  return accessRoleFits(base, accessRole, await customRoles(tenantId));
}

/** Sessions of a person in this firm that are still open (seen in the last 30 days). */
export async function listSessions(tenantId: string, userId: string, currentSid: string | null) {
  await requireSchema();
  const rows = await sql`
    SELECT id, user_agent, created_at, last_seen_at FROM user_sessions
    WHERE user_id = ${userId} AND (tenant_id = ${tenantId} OR tenant_id IS NULL) AND revoked_at IS NULL AND last_seen_at > now() - interval '30 days'
    ORDER BY last_seen_at DESC LIMIT 50`;
  return rows.map((r: any) => ({ id: String(r.id), device: describeAgent(r.user_agent), createdAt: r.created_at, lastSeenAt: r.last_seen_at, current: String(r.id) === currentSid }));
}

/** Close one session: your own, or a member's when you manage the team. */
export async function revokeSession(actor: TeamActor, sessionId: string) {
  await requireSchema();
  const [s] = await sql`SELECT user_id, tenant_id FROM user_sessions WHERE id = ${sessionId} AND revoked_at IS NULL`;
  if (!s) throw new WorkOrderApiError('Oturum bulunamadı', 404);
  const own = String(s.user_id) === actor.userId;
  if (!own) {
    // A manager closes only sessions opened in their own firm.
    if (String(s.tenant_id) !== actor.tenantId) throw new WorkOrderApiError('Oturum bulunamadı', 404);
    await requireTeamManager(actor);
    await assertManagesMember(actor, String(s.user_id));
  }
  await sql`UPDATE user_sessions SET revoked_at = now(), revoked_by = ${actor.userId} WHERE id = ${sessionId}`;
  await silenceMobileDevice(sessionId);
  forgetSessions(String(s.user_id));
  await recordAudit(sql, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'member', entityId: String(s.user_id), action: 'session_revoked', metadata: { sessionId } });
}

/**
 * Close every session of a person. Yourself: everywhere, including sign-ins from before session
 * tracking (tokens issued before now stop counting). A member you manage: only the sessions opened
 * in your firm, since a person may belong to other firms you have no say over.
 */
export async function revokeAllSessions(actor: TeamActor, userId: string, reason: 'self' | 'admin' = 'self') {
  await requireSchema();
  const self = userId === actor.userId;
  if (!self) {
    await requireTeamManager(actor);
    await assertManagesMember(actor, userId);
  }
  await withTransaction(async (tx) => {
    if (self) {
      await tx`UPDATE users SET sessions_valid_after = now() WHERE id = ${userId}`;
      await tx`UPDATE user_sessions SET revoked_at = now(), revoked_by = ${actor.userId} WHERE user_id = ${userId} AND revoked_at IS NULL`;
    } else {
      await tx`UPDATE user_sessions SET revoked_at = now(), revoked_by = ${actor.userId} WHERE user_id = ${userId} AND tenant_id = ${actor.tenantId} AND revoked_at IS NULL`;
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'member', entityId: userId, action: 'sessions_revoked_all', metadata: { reason } });
  });
  forgetSessions(userId);
}

/**
 * A closed phone sign-in also stops that phone's notifications, as closing it from the app does;
 * otherwise a device signed out from the web would keep receiving the firm's push messages.
 */
async function silenceMobileDevice(sessionId: string) {
  const [mobile] = await sql`SELECT to_regclass('public.mobile_sessions') IS NOT NULL AND to_regclass('public.mobile_push_devices') IS NOT NULL AS present`;
  if (!mobile?.present) return;
  await sql`UPDATE mobile_push_devices p SET enabled = false, provider_token = NULL FROM mobile_sessions m
    WHERE m.id = ${sessionId} AND p.tenant_id = m.tenant_id AND p.user_id = m.user_id AND p.device_id = m.device_id`;
}

async function assertManagesMember(actor: TeamActor, userId: string) {
  const [t] = await sql`SELECT role FROM tenant_members WHERE tenant_id = ${actor.tenantId} AND user_id = ${userId}`;
  if (!t) throw new WorkOrderApiError('Üye bulunamadı', 404);
  const problem = teamChangeProblem(actor, { userId, role: t.role, active: true }, {});
  if (problem) throw new WorkOrderApiError(problem, 403);
}
