import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { changedFields, recordAudit } from '@/lib/audit/audit-log';
import { resolveOrderCustomer } from '@/lib/features/customers/link';
import { quotationService } from '@/lib/features/quotations/service';
import { productFamily } from '@/lib/features/products/families';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import {
  LEAD_SOURCES, LEAD_STAGES, LOST_REASONS, cleanMeasures, conversionReport, leadStageProblem, mapLink, measureDiff, measureFields, measureProblems,
  type LeadStage, type Measures,
} from './engine';
import { isoDay, nextNumber, requireCap, requireChain } from './common.server';
import {SalesProfileSchema,salesPriority} from './sales-context';
import {leadSalesContext} from './sales-context.server';

const LeadInput = z.object({
  title: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).nullish(),
  phone: z.string().trim().max(40).nullish(),
  email: z.string().trim().toLowerCase().email().max(200).nullish().or(z.literal('')),
  address: z.string().trim().max(500).nullish(),
  source: z.enum(LEAD_SOURCES).default('other'),
  productFamily: z.string().trim().max(60).nullish(),
  estimatedValue: z.coerce.number().min(0).max(1e12).nullish(),
  ownerId: z.string().uuid().nullish(),
  nextFollowUp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  salesProfile:SalesProfileSchema.optional(),
  duplicateReason:z.string().trim().min(5).max(500).optional(),
}).strict();

/** For edits: every field optional and none defaulted (a missing source must not reset it). */
const LeadPatch = LeadInput.extend({ source: z.enum(LEAD_SOURCES).optional() }).partial();

const LEAD_FIELDS = `l.id, l.lead_number, l.title, l.contact_name, l.company_name, l.phone, l.email, l.address, l.source, l.stage, l.lost_reason, l.lost_note,
  l.product_family, l.estimated_value, l.owner_id, l.next_follow_up, l.customer_id, l.quotation_id, l.closed_at, l.stage_changed_at, l.version, l.created_at, l.updated_at,to_jsonb(l)->'sales_profile' AS sales_profile,to_jsonb(l)->'priority_override' AS priority_override`;

function leadDto(r: any) {
  return {
    id: String(r.id), number: r.lead_number as string, title: r.title as string, contactName: r.contact_name as string, companyName: r.company_name ?? null,
    phone: r.phone ?? null, email: r.email ?? null, address: r.address ?? null, mapUrl: mapLink(r.address), source: r.source as string,
    stage: (['accepted','converted'].includes(r.quotation_status)?'won':r.stage) as LeadStage, lostReason: r.lost_reason ?? null, lostNote: r.lost_note ?? null, productFamily: r.product_family ?? null,
    quotationStatus:r.quotation_status||null,quotationRevision:r.quotation_revision||null,
    salesProfile:SalesProfileSchema.parse(r.sales_profile||{}),priority:salesPriority(r.sales_profile,r.priority_override),
    estimatedValue: r.estimated_value === null || r.estimated_value === undefined ? null : Number(r.estimated_value),
    ownerId: r.owner_id ? String(r.owner_id) : null, ownerName: r.owner_name ?? null, nextFollowUp: isoDay(r.next_follow_up),
    customerId: r.customer_id ? String(r.customer_id) : null, quotationId: r.quotation_id ? String(r.quotation_id) : null, quotationNumber: r.quotation_number ?? null,
    closedAt: r.closed_at, stageChangedAt: r.stage_changed_at, version: Number(r.version), createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const phoneIdentity=(s:string|null|undefined)=>(s||'').replace(/\D/g,'').replace(/^00/,'');
async function checkDuplicate(db:any,tenantId:string,phone:string|null|undefined,email:string|null|undefined,except?:string,reason?:string){
  const p=phoneIdentity(phone),e=(email||'').trim().toLowerCase();
  if(!p&&!e)return;
  const duplicates=await db`SELECT id,lead_number FROM leads WHERE tenant_id=${tenantId} AND (${!except} OR id<>${except||null}) AND ((${!!e} AND lower(trim(email))=${e}) OR (${p.length>=7} AND regexp_replace(regexp_replace(phone,'[^0-9]','','g'),'^00','')=${p})) LIMIT 5`;
  if(duplicates.length&&!reason)throw new WorkOrderApiError(`Aynı telefon veya e-posta ile kayıt var (${duplicates.map((r:any)=>r.lead_number).join(', ')}). Ayrı proje talebiyse mükerrer kayıt gerekçesini yazın.`,409);
}

async function loadLead(db: any, tenantId: string, id: string, lock = false) {
  const [r] = lock
    ? await db`SELECT * FROM leads WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE`
    : await db`SELECT * FROM leads WHERE tenant_id = ${tenantId} AND id = ${id}`;
  if (!r) throw new WorkOrderApiError('Potansiyel müşteri bulunamadı', 404);
  return r;
}

async function checkOwner(db: any, tenantId: string, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const [m] = await db`SELECT 1 FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${ownerId}`;
  if (!m) throw new WorkOrderApiError('Sorumlu bu firmanın üyesi değil', 400);
}

/** The pipeline: every lead with its owner and quote, newest change first. */
export async function listLeads(actor: WorkOrderActor) {
  await requireChain();
  await requireCap(actor, 'crm', 'view', 'Potansiyel müşterileri görme');
  const rows = await sql.unsafe(`
    SELECT ${LEAD_FIELDS}, u.name AS owner_name, q.quotation_number,q.status AS quotation_status,q.revision AS quotation_revision,
      (SELECT count(*)::int FROM site_surveys s WHERE s.tenant_id = l.tenant_id AND s.lead_id = l.id AND s.status <> 'cancelled') AS surveys
    FROM leads l LEFT JOIN users u ON u.id = l.owner_id LEFT JOIN quotations q ON q.id = l.quotation_id AND q.tenant_id = l.tenant_id
    WHERE l.tenant_id = $1 ORDER BY l.stage_changed_at DESC LIMIT 500`, [actor.tenantId]);
  return rows.map((r: any) => ({ ...leadDto(r), surveys: Number(r.surveys) })).sort((a:any,b:any)=>a.priority.rank-b.priority.rank||Number(b.priority.foreign)-Number(a.priority.foreign)||b.priority.quantity-a.priority.quantity);
}

export async function createLead(actor: WorkOrderActor, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'crm', 'create', 'Potansiyel müşteri ekleme');
  const d = LeadInput.parse(raw);
  if (d.productFamily && !productFamily(d.productFamily)) throw new WorkOrderApiError('Bilinmeyen ürün ailesi', 400);
  return withTransaction(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId},0))`;
    await checkOwner(tx, actor.tenantId, d.ownerId);
    await checkDuplicate(tx,actor.tenantId,d.phone,d.email,undefined,d.duplicateReason);
    const number = await nextNumber(tx, actor.tenantId, 'leads', 'lead_number', 'POT');
    const [row] = await tx`
      INSERT INTO leads (tenant_id, lead_number, title, contact_name, company_name, phone, email, address, source, product_family, estimated_value, owner_id, next_follow_up, created_by)
      VALUES (${actor.tenantId}, ${number}, ${d.title}, ${d.contactName}, ${d.companyName || null}, ${d.phone || null}, ${d.email || null}, ${d.address || null},
        ${d.source}, ${d.productFamily || null}, ${d.estimatedValue ?? null}, ${d.ownerId ?? actor.userId}, ${d.nextFollowUp || null}, ${actor.userId})
      RETURNING id`;
    if(d.salesProfile)await tx`UPDATE leads SET sales_profile=${JSON.stringify(d.salesProfile)}::text::jsonb WHERE tenant_id=${actor.tenantId} AND id=${row.id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'lead', entityId: row.id, action: 'created', metadata: { number, source: d.source } });
    return { id: String(row.id), number };
  });
}

export async function updateLead(actor: WorkOrderActor, id: string, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'crm', 'edit', 'Potansiyel müşteriyi düzenleme');
  const d = LeadPatch.parse(raw);
  if (d.productFamily && !productFamily(d.productFamily)) throw new WorkOrderApiError('Bilinmeyen ürün ailesi', 400);
  await withTransaction(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId},0))`;
    const before = await loadLead(tx, actor.tenantId, id, true);
    if (before.stage === 'won' || before.stage === 'lost') throw new WorkOrderApiError('Kapanmış kayıt düzenlenemez; önce yeniden açın', 409);
    await checkOwner(tx, actor.tenantId, d.ownerId);
    if(d.phone!==undefined||d.email!==undefined)await checkDuplicate(tx,actor.tenantId,d.phone===undefined?before.phone:d.phone,d.email===undefined?before.email:d.email,id,d.duplicateReason);
    if(d.salesProfile)await tx`UPDATE leads SET sales_profile=${JSON.stringify(d.salesProfile)}::text::jsonb WHERE tenant_id=${actor.tenantId} AND id=${id}`;
    const next = {
      title: d.title ?? before.title, contact_name: d.contactName ?? before.contact_name, company_name: d.companyName === undefined ? before.company_name : d.companyName || null,
      phone: d.phone === undefined ? before.phone : d.phone || null, email: d.email === undefined ? before.email : d.email || null,
      address: d.address === undefined ? before.address : d.address || null, source: d.source ?? before.source,
      product_family: d.productFamily === undefined ? before.product_family : d.productFamily || null,
      estimated_value: d.estimatedValue === undefined ? before.estimated_value : d.estimatedValue,
      owner_id: d.ownerId === undefined ? before.owner_id : d.ownerId, next_follow_up: d.nextFollowUp === undefined ? isoDay(before.next_follow_up) : d.nextFollowUp || null,
    };
    await tx`UPDATE leads SET title = ${next.title}, contact_name = ${next.contact_name}, company_name = ${next.company_name}, phone = ${next.phone}, email = ${next.email},
      address = ${next.address}, source = ${next.source}, product_family = ${next.product_family}, estimated_value = ${next.estimated_value}, owner_id = ${next.owner_id},
      next_follow_up = ${next.next_follow_up}, version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'lead', entityId: id, action: 'updated', changes: changedFields(before, next) });
  });
}

/**
 * Move a lead along the pipeline. Reaching "quoted" or "won" makes sure there is a customer card
 * (the same matcher orders use) and a draft quote from the survey measures, in the same step.
 */
export async function moveLead(actor: WorkOrderActor, id: string, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'crm', 'edit', 'Potansiyel müşteriyi ilerletme');
  const d = z.object({ to: z.enum(LEAD_STAGES), lostReason: z.enum(LOST_REASONS).nullish(), lostNote: z.string().trim().max(1000).nullish(), expectedVersion: z.number().int().optional() }).strict().parse(raw);
  // Check the move first; a stage that needs a quote gets it before the stage changes, so a refused
  // quote (no quote rights, a failure) leaves the lead where it was.
  const current = await loadLead(sql, actor.tenantId, id);
  if (d.expectedVersion !== undefined && Number(current.version) !== d.expectedVersion) throw new WorkOrderApiError('Kayıt bu arada değişti; yenileyin', 409);
  const precheck = leadStageProblem(current.stage, d.to, d.lostReason);
  if (precheck) throw new WorkOrderApiError(precheck, 409);
  if ((d.to === 'quoted' || d.to === 'won') && !current.quotation_id) await convertLead(actor, id);
  await withTransaction(async (tx: any) => {
    const l = await loadLead(tx, actor.tenantId, id, true);
    if (l.stage === d.to) return;
    const problem = leadStageProblem(l.stage, d.to, d.lostReason);
    if (problem) throw new WorkOrderApiError(problem, 409);
    const closing = d.to === 'won' || d.to === 'lost';
    await tx`UPDATE leads SET stage = ${d.to}, lost_reason = ${d.to === 'lost' ? d.lostReason : null}, lost_note = ${d.to === 'lost' ? d.lostNote || null : null},
      closed_at = ${closing ? new Date() : null}, stage_changed_at = now(), version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'lead', entityId: id, action: 'stage_changed', changes: { aşama: { from: l.stage, to: d.to } }, note: d.lostNote || null, metadata: d.lostReason ? { lostReason: d.lostReason } : null });
  });
  return getLead(actor, id);
}

/**
 * One click from a lead to its quote: the customer card (matched by e-mail, phone or name, or
 * created) and a draft quote with one line per survey (measures in the line, price left to the
 * seller). The survey's measures are frozen as "at quote" to show later changes.
 */
export async function convertLead(actor: WorkOrderActor, id: string) {
  await requireChain();
  await requireCap(actor, 'quotations', 'create', 'Teklif oluşturma');
  const l = await loadLead(sql, actor.tenantId, id);
  if (l.quotation_id) return { quotationId: String(l.quotation_id), created: false };
  const customer = await withTransaction(async (tx: any) => {
    const c = l.customer_id ? { id: String(l.customer_id), name: l.contact_name } : await resolveOrderCustomer(tx, actor.tenantId, { customerName: l.company_name || l.contact_name, email: l.email, phone: l.phone }, actor.userId);
    await tx`UPDATE leads SET customer_id = ${c.id}, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    return c;
  });
  const surveys = await sql`SELECT id, product_family, measures FROM site_surveys WHERE tenant_id = ${actor.tenantId} AND lead_id = ${id} AND status <> 'cancelled' ORDER BY created_at`;
  const family = (key: string | null) => (key ? productFamily(key)?.label : null);
  const items = surveys.length
    ? surveys.map((s: any) => {
        const m = (s.measures ?? {}) as Measures;
        return {
          productName: family(s.product_family) ?? family(l.product_family) ?? l.title, quantity: 1, unitPrice: 0, discountPercent: 0, totalPrice: 0,
          widthMm: Number(m.widthMm) || undefined, heightMm: Number(m.heightMm ?? m.mountingHeightMm) || undefined, projectionMm: Number(m.projectionMm) || undefined,
          mountingHeightMm: Number(m.mountingHeightMm) || undefined,
          notes: measureFields(s.product_family).filter((f) => m[f.key] !== undefined && f.type !== 'mm').map((f) => `${f.label}: ${m[f.key] === true ? 'Evet' : m[f.key] === false ? 'Hayır' : m[f.key]}`).join(' · ') || undefined,
        };
      })
    : [{ productName: family(l.product_family) ?? l.title, quantity: 1, unitPrice: 0, discountPercent: 0, totalPrice: 0 }];
  const quotation: any = await quotationService.createQuotation(actor.tenantId, {
    customerId: customer.id, customerName: customer.name, currency: 'TRY', discountPercent: 0, items: items as any,
    // The lead's id as the creation key: a double click or two people at once get the same quote.
    internalNotes: `${l.lead_number} potansiyel müşteriden oluşturuldu. Fiyatları girin.`, idempotencyKey: id,
  } as any, actor.userId);
  const quotationId = String(quotation?.id ?? quotation?.quotation?.id ?? '');
  if (!quotationId) throw new WorkOrderApiError('Teklif oluşturulamadı', 500);
  await withTransaction(async (tx: any) => {
    // A quote made from an early lead moves it to the quote stage (the pipeline follows the work).
    const [moved] = await tx`UPDATE leads SET quotation_id = ${quotationId}, updated_at = now(),
        stage = CASE WHEN stage IN ('new', 'survey') THEN 'quoted' ELSE stage END,
        stage_changed_at = CASE WHEN stage IN ('new', 'survey') THEN now() ELSE stage_changed_at END,
        version = version + 1
      WHERE tenant_id = ${actor.tenantId} AND id = ${id} AND quotation_id IS NULL RETURNING stage`;
    if (moved && (l.stage === 'new' || l.stage === 'survey'))
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'lead', entityId: id, action: 'stage_changed', changes: { aşama: { from: l.stage, to: 'quoted' } } });
    await tx`UPDATE site_surveys SET measures_at_quote = measures, quoted_at = now() WHERE tenant_id = ${actor.tenantId} AND lead_id = ${id} AND status <> 'cancelled'`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'lead', entityId: id, action: 'quotation_created', metadata: { quotationId, customerId: customer.id } });
  });
  return { quotationId, created: true };
}

export async function getLead(actor: WorkOrderActor, id: string) {
  await requireChain();
  await requireCap(actor, 'crm', 'view', 'Potansiyel müşteriyi görme');
  const [r] = await sql.unsafe(`SELECT ${LEAD_FIELDS}, u.name AS owner_name, q.quotation_number,q.status AS quotation_status,q.revision AS quotation_revision FROM leads l LEFT JOIN users u ON u.id = l.owner_id
    LEFT JOIN quotations q ON q.id = l.quotation_id AND q.tenant_id = l.tenant_id WHERE l.tenant_id = $1 AND l.id = $2`, [actor.tenantId, id]);
  if (!r) throw new WorkOrderApiError('Potansiyel müşteri bulunamadı', 404);
  const surveys = await sql`SELECT s.*, u.name AS assignee_name FROM site_surveys s LEFT JOIN users u ON u.id = s.assigned_to
    WHERE s.tenant_id = ${actor.tenantId} AND s.lead_id = ${id} ORDER BY s.scheduled_at NULLS LAST, s.created_at`;
  return { ...leadDto(r), surveys: surveys.map(surveyDto),salesContext:await leadSalesContext(actor,id) };
}

function surveyDto(s: any) {
  const measures = (s.measures ?? {}) as Measures;
  const atQuote = s.measures_at_quote as Measures | null;
  return {
    id: String(s.id), leadId: s.lead_id ? String(s.lead_id) : null, scheduledAt: s.scheduled_at, address: s.address ?? null, mapUrl: mapLink(s.address),
    assignedTo: s.assigned_to ? String(s.assigned_to) : null, assigneeName: s.assignee_name ?? null, status: s.status as string, productFamily: s.product_family ?? null,
    fields: measureFields(s.product_family), measures, notes: s.notes ?? null, quotedAt: s.quoted_at,
    // Measures changed after the quote was made: shown on the lead and on the quote.
    changedSinceQuote: atQuote ? measureDiff(s.product_family, atQuote, measures) : [],
  };
}

const SurveyInput = z.object({
  scheduledAt: z.string().datetime({ offset: true }).nullish(),
  address: z.string().trim().max(500).nullish(),
  assignedTo: z.string().uuid().nullish(),
  productFamily: z.string().trim().max(60).nullish(),
  notes: z.string().trim().max(4000).nullish(),
}).strict();

/** A survey (keşif / ölçü randevusu) for a lead: when, where, who. */
export async function createSurvey(actor: WorkOrderActor, leadId: string, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'crm', 'edit', 'Keşif randevusu');
  const d = SurveyInput.parse(raw);
  if (d.productFamily && !productFamily(d.productFamily)) throw new WorkOrderApiError('Bilinmeyen ürün ailesi', 400);
  return withTransaction(async (tx: any) => {
    const l = await loadLead(tx, actor.tenantId, leadId, true);
    if (l.stage === 'won' || l.stage === 'lost') throw new WorkOrderApiError('Kapanmış kayda keşif eklenemez', 409);
    await checkOwner(tx, actor.tenantId, d.assignedTo);
    const [s] = await tx`INSERT INTO site_surveys (tenant_id, lead_id, scheduled_at, address, assigned_to, product_family, notes, created_by)
      VALUES (${actor.tenantId}, ${leadId}, ${d.scheduledAt || null}, ${d.address || l.address || null}, ${d.assignedTo ?? null}, ${d.productFamily || l.product_family || null}, ${d.notes || null}, ${actor.userId}) RETURNING id`;
    if (l.stage === 'new') {
      await tx`UPDATE leads SET stage = 'survey', stage_changed_at = now(), version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${leadId}`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'lead', entityId: leadId, action: 'stage_changed', changes: { aşama: { from: 'new', to: 'survey' } } });
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'lead', entityId: leadId, action: 'survey_planned', metadata: { surveyId: s.id, scheduledAt: d.scheduledAt ?? null } });
    return { id: String(s.id) };
  });
}

/** Save the measure form; marking the survey done needs a complete, valid form. */
export async function saveSurvey(actor: WorkOrderActor, surveyId: string, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'crm', 'edit', 'Ölçü kaydetme');
  const d = SurveyInput.extend({ measures: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(), status: z.enum(['planned', 'done', 'cancelled']).optional() }).parse(raw);
  return withTransaction(async (tx: any) => {
    const [s] = await tx`SELECT * FROM site_surveys WHERE tenant_id = ${actor.tenantId} AND id = ${surveyId} FOR UPDATE`;
    if (!s) throw new WorkOrderApiError('Keşif bulunamadı', 404);
    const family = d.productFamily === undefined ? s.product_family : d.productFamily || null;
    if (family && !productFamily(family)) throw new WorkOrderApiError('Bilinmeyen ürün ailesi', 400);
    const measures = d.measures ? cleanMeasures(family, d.measures) : (s.measures ?? {});
    const status = d.status ?? s.status;
    if (status === 'done') {
      const problems = measureProblems(family, measures);
      if (problems.length) throw new WorkOrderApiError(`Ölçü eksik: ${problems.join('; ')}`, 400);
    }
    await checkOwner(tx, actor.tenantId, d.assignedTo);
    await tx`UPDATE site_surveys SET measures = ${JSON.stringify(measures)}::text::jsonb, status = ${status}, product_family = ${family},
      scheduled_at = ${d.scheduledAt === undefined ? s.scheduled_at : d.scheduledAt || null}, address = ${d.address === undefined ? s.address : d.address || null},
      assigned_to = ${d.assignedTo === undefined ? s.assigned_to : d.assignedTo || null}, notes = ${d.notes === undefined ? s.notes : d.notes || null}, updated_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${surveyId}`;
    const diff = s.measures_at_quote ? measureDiff(family, s.measures_at_quote, measures) : [];
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'lead', entityId: s.lead_id ?? surveyId, action: 'survey_saved',
      changes: changedFields(s.measures ?? {}, measures), metadata: { surveyId, status, changedSinceQuote: diff.length } });
    return { changedSinceQuote: diff };
  });
}

/** For a quote: measures that changed on its lead's surveys since the quote was made. */
export async function measureChangesForQuote(actor: WorkOrderActor, quotationId: string) {
  await requireChain();
  await requireCap(actor, 'quotations', 'view', 'Teklifi görme');
  const rows = await sql`SELECT s.*, l.lead_number, l.id AS lid FROM site_surveys s JOIN leads l ON l.id = s.lead_id AND l.tenant_id = s.tenant_id
    WHERE s.tenant_id = ${actor.tenantId} AND l.quotation_id = ${quotationId} AND s.status <> 'cancelled' AND s.measures_at_quote IS NOT NULL`;
  return rows.map((s: any) => ({ surveyId: String(s.id), leadId: String(s.lid), leadNumber: s.lead_number as string, changes: measureDiff(s.product_family, s.measures_at_quote, s.measures ?? {}) }))
    .filter((r: any) => r.changes.length);
}

/** Conversion by source and the pipeline funnel for a period (created in [from, to)). */
export async function leadReport(actor: WorkOrderActor, from?: string, to?: string) {
  await requireChain();
  await requireCap(actor, 'crm', 'view', 'Dönüşüm raporu');
  const rows = await sql`SELECT l.source,CASE WHEN q.status IN('accepted','converted') THEN 'won' ELSE l.stage END AS stage,l.created_at,COALESCE(l.closed_at,CASE WHEN q.status IN('accepted','converted') THEN q.customer_decided_at ELSE NULL END) AS closed_at FROM leads l LEFT JOIN quotations q ON q.id=l.quotation_id AND q.tenant_id=l.tenant_id WHERE l.tenant_id = ${actor.tenantId}`;
  return conversionReport(rows.map((r: any) => ({ source: r.source, stage: r.stage, createdAt: new Date(r.created_at).toISOString(), closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null })), from, to);
}
