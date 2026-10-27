import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { requireCap } from '@/lib/features/field/common.server';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { LocaleSchema } from './design';
import { fairTenantId } from './config';

export type PublicFair = { id: string; code: string; name: string; defaultLocale: 'tr' | 'en' | 'de'; campaign: string | null; startsOn: string | null; endsOn: string | null };

const day = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null);
const publicFair = (r: any): PublicFair => ({ id: String(r.id), code: r.code, name: r.name, defaultLocale: r.default_locale, campaign: r.campaign ?? null, startsOn: day(r.starts_on), endsOn: day(r.ends_on) });

/** The fair behind /fair/<code>, only while it is active. */
export async function activeFair(code: string): Promise<PublicFair | null> {
  const tenantId = fairTenantId();
  if (!tenantId || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(code)) return null;
  const [row] = await sql`SELECT * FROM fairs WHERE tenant_id = ${tenantId} AND code = ${code} AND active`;
  return row ? publicFair(row) : null;
}

/** Attribution keeps working for a design made while the fair was active, even after it ends. */
export async function fairIdByCode(db: any, tenantId: string, code: string | null | undefined): Promise<string | null> {
  if (!code) return null;
  const [row] = await db`SELECT id FROM fairs WHERE tenant_id = ${tenantId} AND code = ${code}`;
  return row ? String(row.id) : null;
}

export async function firmName(): Promise<string> {
  const tenantId = fairTenantId();
  if (!tenantId) return '';
  const [firm] = await sql`SELECT name FROM tenants WHERE id = ${tenantId}`.catch(() => []);
  return firm?.name ? String(firm.name) : '';
}

const FairInput = z
  .object({
    code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, 'Kod: küçük harf, rakam ve tire (2–40)'),
    name: z.string().trim().min(1).max(160),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal('')),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal('')),
    defaultLocale: LocaleSchema.default('en'),
    active: z.boolean().default(true),
    campaign: z.string().trim().max(1000).nullish(),
    source: z.string().trim().max(200).nullish(),
  })
  .strict()
  .refine((d) => !d.startsOn || !d.endsOn || d.endsOn >= d.startsOn, { message: 'Bitiş tarihi başlangıçtan önce olamaz', path: ['endsOn'] });

/** Fairs of the configurator firm with how many designs and quote requests each brought. */
export async function listFairs(actor: WorkOrderActor) {
  requireConfiguratorFirm(actor);
  await requireCap(actor, 'crm', 'view', 'Fuarları görme');
  const rows = await sql`
    SELECT f.*,
      (SELECT count(*)::int FROM fair_designs d WHERE d.tenant_id = f.tenant_id AND d.fair_id = f.id) AS designs,
      (SELECT count(*)::int FROM fair_quotes q WHERE q.tenant_id = f.tenant_id AND q.fair_id = f.id) AS quotes
    FROM fairs f WHERE f.tenant_id = ${actor.tenantId} ORDER BY f.starts_on DESC NULLS LAST, f.created_at DESC`;
  return rows.map((r: any) => ({ ...publicFair(r), active: Boolean(r.active), source: r.source ?? null, designs: Number(r.designs), quotes: Number(r.quotes) }));
}

export async function saveFair(actor: WorkOrderActor, raw: unknown, id?: string) {
  requireConfiguratorFirm(actor);
  await requireCap(actor, 'crm', id ? 'edit' : 'create', 'Fuar kaydetme');
  const d = FairInput.parse(raw);
  const values = [d.code, d.name, d.startsOn || null, d.endsOn || null, d.defaultLocale, d.active, d.campaign || null, d.source || null] as const;
  try {
    const [row] = id
      ? await sql`UPDATE fairs SET code = ${values[0]}, name = ${values[1]}, starts_on = ${values[2]}, ends_on = ${values[3]}, default_locale = ${values[4]},
          active = ${values[5]}, campaign = ${values[6]}, source = ${values[7]}, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id} RETURNING id`
      : await sql`INSERT INTO fairs (tenant_id, code, name, starts_on, ends_on, default_locale, active, campaign, source)
          VALUES (${actor.tenantId}, ${values[0]}, ${values[1]}, ${values[2]}, ${values[3]}, ${values[4]}, ${values[5]}, ${values[6]}, ${values[7]}) RETURNING id`;
    if (!row) throw new WorkOrderApiError('Fuar bulunamadı', 404);
    await recordAudit(sql, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'fair', entityId: row.id, action: id ? 'updated' : 'created', metadata: { code: d.code } });
    return { id: String(row.id) };
  } catch (e: any) {
    if (e?.code === '23505') throw new WorkOrderApiError('Bu fuar kodu zaten kullanılıyor', 409);
    throw e;
  }
}

/** The sales screens manage the configurator firm's records only. */
export function requireConfiguratorFirm(actor: WorkOrderActor) {
  if (fairTenantId() !== actor.tenantId) throw new WorkOrderApiError('Ürün konfigüratörü bu firma için açık değil (FAIR_TENANT_ID)', 404);
}
