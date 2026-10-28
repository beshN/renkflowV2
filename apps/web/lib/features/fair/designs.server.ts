import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { fairTenantId } from './config';
import { DesignItemsSchema, DraftItemsSchema, LocaleSchema, TOKEN_PATTERN, type DesignItem } from './design';
import { fairIdByCode } from './fairs.server';

export function requireFairTenant() {
  const tenantId = fairTenantId();
  if (!tenantId) throw new WorkOrderApiError('Bulunamadı', 404);
  return tenantId;
}

export const Token = z.string().regex(TOKEN_PATTERN);
const CreateInput = z
  .object({ token: Token, fairCode: z.string().max(40).nullish(), origin: z.enum(['kiosk', 'mobile', 'web']), locale: LocaleSchema, items: DesignItemsSchema })
  .strict();
const UpdateInput = z.object({ items: DraftItemsSchema, locale: LocaleSchema.optional(), expectedVersion: z.number().int().positive() }).strict();

export type PublicDesign = { token: string; items: DesignItem[]; locale: 'tr' | 'en' | 'de'; origin: string; version: number; updatedAt: string; fair: { code: string; name: string } | null };
const designDto = (r: any): PublicDesign => ({
  token: r.token, items: r.items, locale: r.locale, origin: r.origin, version: Number(r.version), updatedAt: r.updated_at,
  fair: r.fair_code ? { code: r.fair_code, name: r.fair_name } : null,
});

/**
 * Create-if-absent: the kiosk's sync, a phone opening a not-yet-uploaded kiosk design and the web
 * configurator all send the same token; whoever comes first stores it and later copies change nothing.
 */
export async function createDesign(raw: unknown) {
  const tenantId = requireFairTenant();
  const d = CreateInput.parse(raw);
  return withTransaction(async (tx: any) => {
    const fairId = await fairIdByCode(tx, tenantId, d.fairCode);
    const [row] = await tx`
      INSERT INTO fair_designs (tenant_id, token, fair_id, origin, locale, items)
      VALUES (${tenantId}, ${d.token}, ${fairId}, ${d.origin}, ${d.locale}, ${JSON.stringify(d.items)}::text::jsonb)
      ON CONFLICT (token) DO NOTHING RETURNING version`;
    if (row) return { token: d.token, created: true, version: Number(row.version) };
    const [existing] = await tx`SELECT version FROM fair_designs WHERE tenant_id = ${tenantId} AND token = ${d.token}`;
    if (!existing) throw new WorkOrderApiError('Bu bağlantı kullanılamıyor', 409);
    return { token: d.token, created: false, version: Number(existing.version) };
  });
}

export async function getDesign(token: string): Promise<PublicDesign | null> {
  const tenantId = fairTenantId();
  if (!tenantId || !TOKEN_PATTERN.test(token)) return null;
  const [row] = await sql`
    SELECT d.token, d.items, d.locale, d.origin, d.version, d.updated_at, f.code AS fair_code, f.name AS fair_name
    FROM fair_designs d LEFT JOIN fairs f ON f.id = d.fair_id AND f.tenant_id = d.tenant_id
    WHERE d.tenant_id = ${tenantId} AND d.token = ${token}`;
  return row ? designDto(row) : null;
}

/** Another phone or tab saved the design after this copy was loaded. */
export class DesignConflictError extends WorkOrderApiError {
  constructor() {
    super('Bu tasarım başka bir yerde değiştirildi', 409);
  }
}

/**
 * The link is the key: whoever holds it may keep editing the design. Edits name the version they
 * were made on; an edit on an older copy is refused (409) instead of silently overwriting newer work.
 */
export async function updateDesign(token: string, raw: unknown) {
  const tenantId = requireFairTenant();
  if (!TOKEN_PATTERN.test(token)) throw new WorkOrderApiError('Bulunamadı', 404);
  const d = UpdateInput.parse(raw);
  const [row] = await sql`
    UPDATE fair_designs SET items = ${JSON.stringify(d.items)}::text::jsonb, locale = COALESCE(${d.locale ?? null}, locale), version = version + 1, updated_at = now()
    WHERE tenant_id = ${tenantId} AND token = ${token} AND version = ${d.expectedVersion} RETURNING version, updated_at`;
  if (row) return { version: Number(row.version), updatedAt: row.updated_at };
  const [exists] = await sql`SELECT 1 FROM fair_designs WHERE tenant_id = ${tenantId} AND token = ${token}`;
  throw exists ? new DesignConflictError() : new WorkOrderApiError('Bulunamadı', 404);
}
