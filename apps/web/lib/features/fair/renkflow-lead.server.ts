import 'server-only';

import { recordAudit } from '@/lib/audit/audit-log';
import { nextNumber } from '@/lib/features/field/common.server';
import { itemSummary, type DesignItem } from './design';

/**
 * RenkFlow hand-off: a quote request opens a lead on the sales board (source "fair" or "web", no
 * owner yet), in the same transaction. The configurator runs inside RenkFlow and writes the same
 * database, so this is a direct insert, not an API call. Another destination (a CRM, an ERP) would
 * be one more function with this signature.
 */
const FAMILY_FOR_KIND: Partial<Record<DesignItem['kind'], string>> = {
  makasli: 'makasli', pergola: 'pergola', 'wind-manual': 'wind-manual', 'wind-piston': 'wind-piston', giyotin: 'giyotin',
};
export function leadFamilyFor(items: Array<Pick<DesignItem, 'kind'>>): string | null {
  const families = new Set(items.map((i) => FAMILY_FOR_KIND[i.kind] ?? null));
  return families.size === 1 ? [...families][0] : null;
}

export async function openLeadForQuote(
  tx: any,
  q: { tenantId: string; quoteId: string; number: string; fair: boolean; items: DesignItem[]; contactName: string; companyName: string | null; phone: string | null; email: string; location: string | null },
) {
  const leadNumber = await nextNumber(tx, q.tenantId, 'leads', 'lead_number', 'POT');
  const first = itemSummary('tr', q.items[0]);
  const title = `${q.number}: ${first}${q.items.length > 1 ? ` +${q.items.length - 1} ürün` : ''}`.slice(0, 200);
  const [lead] = await tx`
    INSERT INTO leads (tenant_id, lead_number, title, contact_name, company_name, phone, email, address, source, product_family)
    VALUES (${q.tenantId}, ${leadNumber}, ${title}, ${q.contactName}, ${q.companyName}, ${q.phone}, ${q.email}, ${q.location}, ${q.fair ? 'fair' : 'web'}, ${leadFamilyFor(q.items)})
    RETURNING id`;
  await recordAudit(tx, { tenantId: q.tenantId, actorId: null, entityType: 'lead', entityId: lead.id, action: 'created', metadata: { number: leadNumber, source: q.fair ? 'fair' : 'web', fairQuote: q.number } });
  return String(lead.id);
}
