/**
 * Pure rules for managing a firm's team: who may change whom, which access role fits which base
 * role, invite expiry. The server code applies them; the tests pin them.
 */
import type { UserRole } from '@/lib/auth/permissions';
import { presetFor } from './access-matrix';

/** Base roles that can be given from the team screen (owner is not handed out here). */
export const ASSIGNABLE_ROLES = ['admin', 'accountant', 'office', 'worker', 'member'] as const satisfies readonly UserRole[];

export const BASE_ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Firma sahibi', admin: 'Yönetici', office: 'Ofis', accountant: 'Muhasebe', worker: 'Atölye', member: 'Ekip üyesi',
};

export type TeamTarget = { userId: string; role: UserRole; active: boolean };
export type TeamChange = { role?: UserRole; active?: boolean };

/**
 * Why `actor` may not apply `change` to `target`, or null when allowed.
 * - only owners and admins manage the team; nobody changes their own role or status;
 * - an admin manages the roles below admin; only an owner manages admins;
 * - an owner's role or status is not changed here, so a firm always keeps its owner;
 * - nobody is made owner here.
 */
export function teamChangeProblem(actor: { userId: string; role: UserRole }, target: TeamTarget, change: TeamChange): string | null {
  if (actor.role !== 'owner' && actor.role !== 'admin') return 'Ekibi yalnız firma sahibi ve yöneticiler yönetir.';
  if (actor.userId === target.userId) return 'Kendi rolünüzü ya da durumunuzu değiştiremezsiniz.';
  if (target.role === 'owner') return 'Firma sahibinin rolü ve durumu buradan değiştirilemez.';
  if (change.role && !(ASSIGNABLE_ROLES as readonly string[]).includes(change.role)) return 'Bu rol buradan verilemez.';
  if (actor.role === 'admin' && (target.role === 'admin' || change.role === 'admin')) return 'Yöneticileri yalnız firma sahibi yönetir.';
  return null;
}

/** Whether an access role (preset key or custom role id) can sit on a base role. */
export function accessRoleFits(base: UserRole, accessRole: string | null, customRoles: Array<{ id: string; base: string }>) {
  if (!accessRole) return true;
  const preset = presetFor(accessRole);
  if (preset) return preset.base === base;
  return customRoles.some((r) => r.id === accessRole && r.base === base);
}

export const INVITE_TTL = { min: 1, max: 30, default: 7 } as const;

/** Invite lifetime in days, kept between 1 and 30 (7 when not given). */
export function inviteTtlDays(raw: unknown) {
  const n = Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(n)) return INVITE_TTL.default;
  return Math.min(INVITE_TTL.max, Math.max(INVITE_TTL.min, Math.round(n)));
}

/** Normalised key for a custom role name (unique per firm). */
export const roleNameKey = (name: string) => name.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');

/** A short, readable device name from a user agent ("Chrome · macOS"). */
export function describeAgent(agent: string | null | undefined) {
  if (!agent) return 'Bilinmeyen cihaz';
  const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : 'Tarayıcı';
  const os = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'macOS' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : 'Bilinmeyen sistem';
  return `${browser} · ${os}`;
}
