import 'server-only';
import jwt from 'jsonwebtoken';
import { sql } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';

export type MobileAccess = { production: { view: boolean; edit: boolean }; inventory: { view: boolean; edit: boolean }; installations: { view: boolean; edit: boolean }; roleKey: string };
type Matrix = Record<string, string[]>;
const full = { production: ['view', 'edit'], inventory: ['view', 'edit'], installations: ['view', 'edit'] };
const presets: Record<string, { base: string; matrix: Matrix }> = {
  owner: { base: 'owner', matrix: full }, admin: { base: 'admin', matrix: full }, office: { base: 'office', matrix: full },
  operator: { base: 'worker', matrix: { ...full, inventory: ['view'] } },
  sales: { base: 'office', matrix: { production: ['view'], inventory: ['view'], installations: ['view', 'edit'] } },
  planning: { base: 'office', matrix: full },
  warehouse: { base: 'office', matrix: { production: ['view'], inventory: ['view', 'edit'], installations: [] } },
};
export function mobileAccess(base: string, chosen: string | null, custom?: { base: string; permissions: Matrix }): MobileAccess {
  const defaultKey = base === 'worker' ? 'operator' : base;
  const cap = presets[defaultKey]?.matrix || {};
  const role = custom && custom.base === base ? { base, matrix: custom.permissions } : chosen ? presets[chosen] : null;
  // Unknown/mismatched selected roles fail closed instead of silently granting the base role.
  const selected = chosen ? role?.base === base ? role.matrix : {} : cap;
  const allow = (module: string, action: string) => (cap[module] || []).includes(action) && (selected[module] || []).includes(action);
  return { roleKey: chosen || defaultKey, production: { view: allow('production', 'view'), edit: allow('production', 'edit') }, inventory: { view: allow('inventory', 'view'), edit: allow('inventory', 'edit') }, installations: { view: allow('installations', 'view'), edit: allow('installations', 'edit') } };
}
export async function currentMobileAccess(actor: WorkOrderActor, token: string): Promise<MobileAccess> {
  // to_jsonb supports both main (before 044) and night-2 without querying absent columns.
  const [row] = await sql`SELECT to_jsonb(m) AS member_data, to_jsonb(u) AS user_data, to_regclass('public.access_roles') AS role_table
    FROM tenant_members m JOIN users u ON u.id = m.user_id
    WHERE m.tenant_id = ${actor.tenantId} AND m.user_id = ${actor.userId}`;
  if (!row) throw new WorkOrderApiError('Oturumunuz sona erdi.', 401);
  const member = row.member_data as Record<string, unknown> | undefined;
  const user = row.user_data as Record<string, unknown> | undefined;
  if (member?.deactivated_at) throw new WorkOrderApiError('Oturumunuz sona erdi.', 401);
  const decoded = jwt.decode(token) as { iat?: number; sid?: string } | null;
  if (user?.sessions_valid_after && (!decoded?.iat || decoded.iat < Math.floor(new Date(String(user.sessions_valid_after)).getTime() / 1000))) throw new WorkOrderApiError('Oturumunuz iptal edildi.', 401);
  const key = typeof member?.access_role === 'string' ? member.access_role : null;
  let custom: { base: string; permissions: Matrix } | undefined;
  if (key && row.role_table && !presets[key]) {
    const [r] = await sql`SELECT base_role, permissions FROM access_roles WHERE tenant_id = ${actor.tenantId} AND id::text = ${key}`;
    if (r) custom = { base: String(r.base_role), permissions: r.permissions as Matrix };
  }
  return mobileAccess(actor.role, key, custom);
}
