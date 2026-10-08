import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { colorKey } from '@/lib/features/inventory/vocabulary';
import { FIRM_MANAGER_ROLES } from './roles';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};


/** The list the firm gave for its catalogue, offered once when the catalogue is empty; never added on its own. */
export const STARTER_COLORS = ['7016 Mat', '1013', '9016 Mat', '7037', 'Kahverengi', 'Boyasız'] as const;

export const colorCatalogAvailable = () => tableExists('firm_colors');
export const sameColor = (a: string, b: string) => colorKey(a) === colorKey(b);

/** The firm's colours, in its order; empty when none are set, null before the catalogue exists. */
export async function firmColors(db: any, tenantId: string): Promise<string[] | null> {
  if (!(await colorCatalogAvailable())) return null;
  return (await db`SELECT name FROM firm_colors WHERE tenant_id = ${tenantId} ORDER BY position, name`).map((r: any) => r.name as string);
}

export async function colorCatalogSettings(actor: WorkOrderActor) {
  if (!FIRM_MANAGER_ROLES.includes(actor.role)) fail('Renk kataloğunu firma yöneticisi düzenler', 403);
  const available = await colorCatalogAvailable();
  return { available, colors: (await firmColors(sql, actor.tenantId)) ?? [], starter: STARTER_COLORS };
}

const SaveSchema = z.object({
  colors: z.array(z.string().trim().min(1, 'Renk adı boş olamaz').max(100, 'Renk adı en fazla 100 karakter')).max(100, 'En fazla 100 renk'),
});

/** Replaces the catalogue with the given list, in that order. */
export async function saveColorCatalog(actor: WorkOrderActor, raw: unknown) {
  if (!FIRM_MANAGER_ROLES.includes(actor.role)) fail('Renk kataloğunu firma yöneticisi düzenler', 403);
  const { colors } = SaveSchema.parse(raw);
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) if (sameColor(colors[i], colors[j])) fail(`"${colors[j]}" listede iki kez geçiyor`);
  if (!(await colorCatalogAvailable())) fail('Renk kataloğu bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
  return withTransaction(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId + ':firm-colors'}, 0))`;
    const before = (await tx`SELECT name FROM firm_colors WHERE tenant_id = ${actor.tenantId} ORDER BY position, name`).map((r: any) => r.name);
    await tx`DELETE FROM firm_colors WHERE tenant_id = ${actor.tenantId}`;
    if (colors.length)
      await tx`INSERT INTO firm_colors (tenant_id, name, name_key, position)
        SELECT ${actor.tenantId}, c.name, c.key, c.position - 1
        FROM unnest(${colors}::text[], ${colors.map(colorKey)}::text[]) WITH ORDINALITY AS c(name, key, position)`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'color_catalog_changed', changes: { colors: { from: before, to: colors } } });
    return { colors };
  });
}
