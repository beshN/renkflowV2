import 'server-only';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireModuleAccess } from '@/lib/security/module-access.server';
import { recordAudit } from '@/lib/audit/audit-log';
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from '@/lib/features/work-orders/security';
import { validCompanyAddress, COMPANY_ROOT_DOMAIN } from './host';
export async function companyAddress(actor: WorkOrderActor) {
  await requireModuleAccess(actor, 'settings');
  const [row] =
    await sql`SELECT address,version FROM company_addresses WHERE tenant_id=${actor.tenantId}`;
  return row
    ? { ...row, url: `https://${row.address}.${COMPANY_ROOT_DOMAIN}` }
    : { address: '', version: 0, url: null };
}
export async function saveCompanyAddress(actor: WorkOrderActor, raw: unknown) {
  await requireModuleAccess(actor, 'settings', 'edit');
  if (!['owner', 'admin'].includes(actor.role))
    throw new WorkOrderApiError('Yönetici yetkisi gerekli.', 403);
  const input = z
    .object({
      address: z
        .string()
        .trim()
        .toLowerCase()
        .refine(
          validCompanyAddress,
          'Adres 1–63 karakter, küçük harf, rakam ve tire içermeli; sistem adresleri kullanılamaz.',
        ),
      version: z.number().int().nonnegative(),
    })
    .parse(raw);
  return sql.begin(async (tx: any) => {
    await tx`SELECT id FROM tenants WHERE id=${actor.tenantId} FOR UPDATE`;
    const [old] =
      await tx`SELECT * FROM company_addresses WHERE tenant_id=${actor.tenantId}`;
    if ((old?.version ?? 0) !== input.version)
      throw new WorkOrderApiError(
        'Adres başka oturumda değişti. Yenileyin.',
        409,
      );
    await tx`INSERT INTO company_address_claims(address,tenant_id) VALUES(${input.address},${actor.tenantId}) ON CONFLICT DO NOTHING`;
    const [claim] =
      await tx`SELECT tenant_id FROM company_address_claims WHERE address=${input.address}`;
    if (claim.tenant_id !== actor.tenantId)
      throw new WorkOrderApiError('Bu adres başka bir şirkete ayrılmış.', 409);
    // A domain change cannot free another firm's claim. The unique constraint also serializes competing claims.
    let row;
    try {
      [row] =
        await tx`INSERT INTO company_addresses(tenant_id,address) VALUES(${actor.tenantId},${input.address}) ON CONFLICT(tenant_id) DO UPDATE SET address=EXCLUDED.address,version=company_addresses.version+1,updated_at=now() RETURNING address,version`;
    } catch (e) {
      if ((e as { code?: string }).code === '23505')
        throw new WorkOrderApiError(
          'Bu adres başka bir şirket tarafından kullanılıyor.',
          409,
        );
      throw e;
    }
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorId: actor.userId,
      entityType: 'tenant',
      entityId: actor.tenantId,
      action: 'company_address_updated',
      metadata: { before: old?.address ?? null, after: row.address },
    });
    return { ...row, url: `https://${row.address}.${COMPANY_ROOT_DOMAIN}` };
  });
}
