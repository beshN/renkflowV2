import "server-only";
import { z } from "zod";
import { sql, withTransaction } from "@/lib/db";
import { tableExists } from "@/lib/db/schema-guard";
import { recordAudit } from "@/lib/audit/audit-log";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { stableJson } from "../products/configuration";
import { requireCap, hasCap } from "./common.server";
import {
  SalesProfileSchema,
  PriorityOverrideSchema,
  ResearchSourceSchema,
  RESEARCH_CATEGORIES,
  salesPriority,
} from "./sales-context";
import { syncLeadQuoteState } from "./quote-sync.server";
import { companyResearchAvailability } from "./company-research.server";
const fail = (m: string, s = 409): never => {
  throw new WorkOrderApiError(m, s);
};
async function need(a: WorkOrderActor, write = false) {
  await requireCap(a, "crm", write ? "edit" : "view", "Satış takibi");
  if (!(await tableExists("lead_research_sources")))
    fail("Satış bağlamı için veritabanı güncellemesi bekleniyor");
}
async function lockLead(tx: any, a: WorkOrderActor, id: string) {
  z.uuid().parse(id);
  const [l] =
    await tx`SELECT id,version,customer_id,quotation_id,sales_profile,priority_override FROM leads WHERE tenant_id=${a.tenantId} AND id=${id} FOR UPDATE`;
  if (!l) fail("Potansiyel müşteri bulunamadı", 404);
  return l;
}
export async function leadSalesContext(a: WorkOrderActor, id: string) {
  await requireCap(a, "crm", "view", "Satış takibi");
  z.uuid().parse(id);
  if (!(await tableExists("lead_research_sources")))
    return { available: false as const };
  const [lead] =
    await sql`SELECT sales_profile,priority_override,version,customer_id,owner_id FROM leads WHERE tenant_id=${a.tenantId} AND id=${id}`;
  if (!lead) fail("Potansiyel müşteri bulunamadı", 404);
  const sources =
    await sql`SELECT id,category,url,title,findings,status,checked_at,version,to_jsonb(lead_research_sources)->'evidence' AS evidence FROM lead_research_sources WHERE tenant_id=${a.tenantId} AND lead_id=${id} ORDER BY checked_at DESC`;
  const researchAutomation = await companyResearchAvailability(a.tenantId);
  const [lastResearch] = (await tableExists("lead_research_runs"))
    ? await sql`SELECT status,result,created_at,finished_at FROM lead_research_runs WHERE tenant_id=${a.tenantId} AND lead_id=${id} ORDER BY created_at DESC LIMIT 1`
    : [];
  const quotes = (await hasCap(a, "quotations", "view"))
    ? await sql`SELECT q.id,q.quotation_number AS number,q.status,q.revision,q.total_amount AS "totalAmount",q.currency,q.created_at,q.updated_at,
 COALESCE((SELECT json_agg(json_build_object('revision',r.revision,'status',r.status,'reason',r.reason,'at',r.created_at,'totalAmount',r.snapshot->'totalAmount')) FROM quotation_revisions r WHERE r.tenant_id=q.tenant_id AND r.quotation_id=q.id),'[]'::json) AS history
 FROM quotations q WHERE q.tenant_id=${a.tenantId} AND (q.id=(SELECT quotation_id FROM leads WHERE tenant_id=${a.tenantId} AND id=${id}) OR EXISTS(SELECT 1 FROM lead_quotation_links x WHERE x.tenant_id=q.tenant_id AND x.lead_id=${id} AND x.quotation_id=q.id)) ORDER BY q.created_at DESC`
    : [];
  const quoteCandidates =
    lead.customer_id && (await hasCap(a, "quotations", "view"))
      ? await sql`SELECT id,quotation_number AS number,status FROM quotations WHERE tenant_id=${a.tenantId} AND customer_id=${lead.customer_id} ORDER BY created_at DESC LIMIT 100`
      : [];
  const members =
    await sql`SELECT u.id,u.name FROM tenant_members m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=${a.tenantId} ORDER BY u.name`;
  const [contact] =
    await sql`SELECT MAX(done_at) AS at FROM record_activities WHERE tenant_id=${a.tenantId} AND entity_type='lead' AND entity_id=${id} AND kind IN('call','email','meeting')`;
  const profile = SalesProfileSchema.safeParse(lead.sales_profile),
    verified = sources.filter((s: any) => s.status === "verified");
  return {
    available: true as const,
    profile: profile.success ? profile.data : SalesProfileSchema.parse({}),
    priority: salesPriority(lead.sales_profile, lead.priority_override),
    override: lead.priority_override,
    version: lead.version,
    ownerId: lead.owner_id,
    members,
    sources,
    quotes,
    quoteCandidates,
    lastContactAt: contact?.at || null,
    research: {
      verified: verified.length,
      pending: sources.filter((s: any) => s.status === "reported").length,
      coverage: RESEARCH_CATEGORIES.filter((k) =>
        verified.some((s: any) => s.category === k),
      ),
      lastCheckedAt: sources[0]?.checked_at || null,
    },
    researchAutomation,
    lastResearch: lastResearch || null,
    canEdit: await hasCap(a, "crm", "edit"),
  };
}
export async function saveLeadSalesContext(
  a: WorkOrderActor,
  id: string,
  raw: unknown,
) {
  await need(a, true);
  const d = z
    .object({
      version: z.number().int().positive(),
      ownerId: z.uuid().nullable().optional(),
      profile: SalesProfileSchema,
      override: PriorityOverrideSchema.nullable(),
    })
    .strict()
    .parse(raw);
  await withTransaction(async (tx) => {
    const l = await lockLead(tx, a, id);
    if (l.version !== d.version) fail("Kayıt değişti; güncel bilgileri açın");
    if (
      d.ownerId &&
      !(
        await tx`SELECT 1 FROM tenant_members WHERE tenant_id=${a.tenantId} AND user_id=${d.ownerId}`
      ).length
    )
      fail("Sorumlu bu firmaya ait değil", 400);
    if (d.ownerId !== undefined)
      await tx`UPDATE leads SET owner_id=${d.ownerId} WHERE tenant_id=${a.tenantId} AND id=${id}`;
    await tx`UPDATE leads SET sales_profile=${JSON.stringify(d.profile)}::text::jsonb,priority_override=${JSON.stringify(d.override)}::text::jsonb,version=version+1,updated_at=now() WHERE tenant_id=${a.tenantId} AND id=${id}`;
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "lead",
      entityId: id,
      action: "sales_context_updated",
      metadata: { priority: salesPriority(d.profile, d.override) },
    });
  });
  return leadSalesContext(a, id);
}
export async function saveResearchSource(
  a: WorkOrderActor,
  id: string,
  raw: unknown,
) {
  await need(a, true);
  const d = z
    .object({
      commandId: z.uuid(),
      id: z.uuid().optional(),
      version: z.number().int().positive().optional(),
      source: ResearchSourceSchema,
    })
    .strict()
    .parse(raw);
  if (new Date(d.source.checkedAt).getTime() > Date.now() + 300000)
    fail("Kontrol tarihi gelecekte olamaz", 400);
  await withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId + ":research"},0))`;
    await lockLead(tx, a, id);
    const [old] =
      await tx`SELECT * FROM lead_research_sources WHERE tenant_id=${a.tenantId} AND command_id=${d.commandId}`;
    if (old) {
      const previous = {
        category: old.category,
        url: old.url,
        title: old.title,
        findings: old.findings,
        status: old.status,
        checkedAt: new Date(old.checked_at).toISOString(),
      };
      const next = {
        ...d.source,
        checkedAt: new Date(d.source.checkedAt).toISOString(),
      };
      if (
        old.lead_id !== id ||
        (old.updated_by || old.created_by) !== a.userId ||
        stableJson(previous) !== stableJson(next)
      )
        fail("İşlem anahtarı farklı kaynakta kullanıldı");
      return;
    }
    let sourceId: string;
    if (d.id) {
      const [existing] =
        await tx`SELECT * FROM lead_research_sources WHERE tenant_id=${a.tenantId} AND lead_id=${id} AND id=${d.id} FOR UPDATE`;
      if (
        existing?.evidence?.kind === "web_search_citation" &&
        (existing.url !== d.source.url ||
          existing.title !== d.source.title ||
          existing.findings !== d.source.findings)
      )
        fail(
          "AI kaynak alıntısı değiştirilemez; düzeltme için yeni kaynak ekleyin.",
        );
      const updated =
        await tx`UPDATE lead_research_sources SET category=${d.source.category},url=${d.source.url},title=${d.source.title},findings=${d.source.findings},status=${d.source.status},checked_at=${d.source.checkedAt},version=version+1,updated_at=now(),command_id=${d.commandId},updated_by=${a.userId} WHERE tenant_id=${a.tenantId} AND lead_id=${id} AND id=${d.id} AND version=${d.version || 0} RETURNING id`;
      if (!updated.length) fail("Kaynak değişti; güncel bilgileri açın");
      sourceId = updated[0].id;
    } else {
      const [r] =
        await tx`INSERT INTO lead_research_sources(tenant_id,lead_id,category,url,title,findings,status,checked_at,created_by,command_id,updated_by) VALUES(${a.tenantId},${id},${d.source.category},${d.source.url},${d.source.title},${d.source.findings},${d.source.status},${d.source.checkedAt},${a.userId},${d.commandId},${a.userId}) RETURNING id`;
      sourceId = r.id;
    }
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "lead",
      entityId: id,
      action: "research_source_saved",
      metadata: {
        sourceId,
        status: d.source.status,
        category: d.source.category,
      },
    });
  });
  return leadSalesContext(a, id);
}
export async function linkLeadQuotation(
  a: WorkOrderActor,
  id: string,
  quotationId: string,
) {
  await need(a, true);
  await requireCap(a, "quotations", "view", "Teklif bağlama");
  z.uuid().parse(quotationId);
  await withTransaction(async (tx) => {
    const l = await lockLead(tx, a, id);
    const [q] =
      await tx`SELECT customer_id FROM quotations WHERE tenant_id=${a.tenantId} AND id=${quotationId}`;
    if (!q) fail("Teklif bulunamadı", 404);
    if (!l.customer_id || q.customer_id !== l.customer_id)
      fail("Yalnız bu müşteriye ait teklif bağlanabilir");
    await tx`INSERT INTO lead_quotation_links(tenant_id,lead_id,quotation_id,created_by) VALUES(${a.tenantId},${id},${quotationId},${a.userId}) ON CONFLICT DO NOTHING`;
    await syncLeadQuoteState(tx, a.tenantId, quotationId);
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "lead",
      entityId: id,
      action: "quotation_linked",
      metadata: { quotationId },
    });
  });
  return leadSalesContext(a, id);
}
