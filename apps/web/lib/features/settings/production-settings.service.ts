import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { columnExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { FIRM_MANAGER_ROLES } from './roles';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};

/** Who may lead production: the roles a work order can be assigned to. */
export const PRODUCTION_LEAD_ROLES = ['worker', 'office', 'admin', 'owner'];

export const productionLeadAvailable = () => columnExists('manufacturing_preferences', 'production_lead_user_id');

/** The firm's default production lead, or null when none is set (or the setting does not exist yet). */
export async function productionLead(db: any, tenantId: string): Promise<string | null> {
  if (!(await productionLeadAvailable())) return null;
  const [row] = await db`SELECT production_lead_user_id FROM manufacturing_preferences WHERE tenant_id = ${tenantId}`;
  return row?.production_lead_user_id ?? null;
}

export async function productionSettings(actor: WorkOrderActor) {
  if (!FIRM_MANAGER_ROLES.includes(actor.role)) fail('Üretim ayarlarını firma yöneticisi görür', 403);
  const [available, members] = await Promise.all([
    productionLeadAvailable(),
    sql`SELECT u.id, u.name, u.email, m.role FROM tenant_members m JOIN users u ON u.id = m.user_id
        WHERE m.tenant_id = ${actor.tenantId} AND m.role = ANY(${PRODUCTION_LEAD_ROLES}::text[]) ORDER BY u.name, u.email`,
  ]);
  const leadUserId = available ? await productionLead(sql, actor.tenantId) : null;
  // A lead who has left the team is still the setting: conversions wait until it is changed.
  const leadLeft = Boolean(leadUserId && !members.some((m: any) => m.id === leadUserId));
  return { available, leadUserId, leadLeft, members };
}

const SaveSchema = z.object({ leadUserId: z.string().uuid().nullable() });

export async function saveProductionLead(actor: WorkOrderActor, raw: unknown) {
  if (!FIRM_MANAGER_ROLES.includes(actor.role)) fail('Üretim sorumlusunu firma yöneticisi seçer', 403);
  const { leadUserId } = SaveSchema.parse(raw);
  if (!(await productionLeadAvailable())) fail('Bu ayar bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
  return withTransaction(async (tx: any) => {
    if (leadUserId && !(await tx`SELECT 1 FROM tenant_members WHERE tenant_id = ${actor.tenantId} AND user_id = ${leadUserId} AND role = ANY(${PRODUCTION_LEAD_ROLES}::text[])`).length)
      fail('Seçilen kişi firmanın üretim ekibinde değil');
    const [before] = await tx`SELECT production_lead_user_id FROM manufacturing_preferences WHERE tenant_id = ${actor.tenantId} FOR UPDATE`;
    await tx`INSERT INTO manufacturing_preferences (tenant_id, production_lead_user_id) VALUES (${actor.tenantId}, ${leadUserId})
      ON CONFLICT (tenant_id) DO UPDATE SET production_lead_user_id = EXCLUDED.production_lead_user_id, updated_at = now()`;
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorId: actor.userId,
      entityType: 'tenant_settings',
      entityId: actor.tenantId,
      action: 'production_lead_changed',
      changes: { productionLeadUserId: { from: before?.production_lead_user_id ?? null, to: leadUserId } },
    });
    return { leadUserId };
  });
}
