import 'server-only';

import { createHash } from 'node:crypto';
import { sql, withTransaction } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { nextNumber, requireCap, requireChain } from '@/lib/features/field/common.server';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { fairEventName, fairTenantId } from './config';
import { FAIR_PRIVACY_VERSION, FairRequestSchema, itemSummary, leadFamilyFor, type FairItem } from './schema';

/** The fair firm, or 404 when the module is off on this installation. */
export function requireFairTenant() {
  const tenantId = fairTenantId();
  if (!tenantId) throw new WorkOrderApiError('Bulunamadı', 404);
  return tenantId;
}

/**
 * A visitor's request: a lead (source "fair", no owner yet) and the configured products beside it,
 * in one transaction. Duplicate phones are allowed here; sales merges them on the lead board.
 */
export async function createFairRequest(raw: unknown, meta: { ip: string; agent: string }) {
  const tenantId = requireFairTenant();
  await requireChain();
  const d = FairRequestSchema.parse(raw);
  const event = fairEventName() || d.event || null;
  const first = itemSummary(d.items[0]);
  const title = `Fuar${event ? ` (${event})` : ''}: ${first}${d.items.length > 1 ? ` +${d.items.length - 1} ürün` : ''}`.slice(0, 200);
  const items = d.items.map(({ configuration, image, quantity, note }) => ({ configuration, quantity, ...(image ? { image } : {}), ...(note ? { note } : {}) }));
  const ipHash = meta.ip && meta.ip !== 'unknown' ? createHash('sha256').update(`${tenantId}:${meta.ip}`).digest('hex').slice(0, 32) : null;
  return withTransaction(async (tx: any) => {
    const number = await nextNumber(tx, tenantId, 'leads', 'lead_number', 'POT');
    const [lead] = await tx`
      INSERT INTO leads (tenant_id, lead_number, title, contact_name, company_name, phone, email, address, source, product_family)
      VALUES (${tenantId}, ${number}, ${title}, ${d.contactName}, ${d.companyName || null}, ${d.phone}, ${d.email || null}, ${d.city || null}, 'fair', ${leadFamilyFor(d.items)})
      RETURNING id`;
    const [request] = await tx`
      INSERT INTO fair_requests (tenant_id, lead_id, event, items, contact_name, company_name, phone, email, city, note,
        privacy_notice_version, privacy_notice_ack_at, marketing_consent, ip_hash, user_agent)
      VALUES (${tenantId}, ${lead.id}, ${event}, ${JSON.stringify(items)}::text::jsonb, ${d.contactName}, ${d.companyName || null}, ${d.phone},
        ${d.email || null}, ${d.city || null}, ${d.note || null}, ${FAIR_PRIVACY_VERSION}, now(), ${d.marketingConsent}, ${ipHash}, ${meta.agent.slice(0, 300) || null})
      RETURNING id`;
    await recordAudit(tx, {
      tenantId, actorId: null, entityType: 'lead', entityId: lead.id, action: 'created',
      metadata: { number, source: 'fair', fairRequestId: request.id, items: d.items.length },
    });
    return { reference: number as string };
  });
}

type Row = Record<string, any>;
function requestDto(r: Row, withImages: boolean) {
  const items = (Array.isArray(r.items) ? r.items : []) as FairItem[];
  return {
    id: String(r.id), createdAt: r.created_at, event: r.event ?? null,
    contactName: r.contact_name as string, companyName: r.company_name ?? null, phone: r.phone as string, email: r.email ?? null,
    city: r.city ?? null, note: r.note ?? null, marketingConsent: Boolean(r.marketing_consent),
    leadId: r.lead_id ? String(r.lead_id) : null, leadNumber: r.lead_number ?? null, leadStage: r.lead_stage ?? null,
    items: items.map((i) => ({
      configuration: i.configuration, quantity: Number(i.quantity) || 1, note: i.note ?? null, summary: itemSummary(i),
      hasImage: Boolean(i.image), ...(withImages && i.image ? { image: i.image } : {}),
    })),
  };
}

/** The firm's fair requests, newest first (no preview images: the detail call carries them). */
export async function listFairRequests(actor: WorkOrderActor) {
  await requireCap(actor, 'crm', 'view', 'Fuar taleplerini görme');
  const rows = await sql`
    SELECT f.id, f.created_at, f.event, f.contact_name, f.company_name, f.phone, f.email, f.city, f.note, f.marketing_consent, f.lead_id,
      (SELECT jsonb_agg(i - 'image') FROM jsonb_array_elements(f.items) i) AS items,
      l.lead_number, l.stage AS lead_stage
    FROM fair_requests f LEFT JOIN leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id
    WHERE f.tenant_id = ${actor.tenantId} ORDER BY f.created_at DESC LIMIT 500`;
  return rows.map((r: Row) => requestDto(r, false));
}

export async function getFairRequest(actor: WorkOrderActor, id: string) {
  await requireCap(actor, 'crm', 'view', 'Fuar taleplerini görme');
  const [row] = await sql`
    SELECT f.*, l.lead_number, l.stage AS lead_stage
    FROM fair_requests f LEFT JOIN leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id
    WHERE f.tenant_id = ${actor.tenantId} AND f.id = ${id}`;
  if (!row) throw new WorkOrderApiError('Fuar talebi bulunamadı', 404);
  return requestDto(row, true);
}
