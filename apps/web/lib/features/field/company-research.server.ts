import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sql, withTransaction } from "@/lib/db";
import { tableExists } from "@/lib/db/schema-guard";
import { recordAudit } from "@/lib/audit/audit-log";
import { aiAvailable, getAIService } from "@/lib/ai/service";
import {
  getAiSettings,
  featureOn,
  assertModelAllowed,
} from "@/lib/ai/gate.server";
import {
  ModelBlockedError,
  modelConfigurationBlock,
  MODEL_BLOCK_MESSAGES,
} from "@/lib/ai/policy";
import {
  CompanyResearchQuery,
  COMPANY_RESEARCH_MAX_SEARCHES,
  COMPANY_RESEARCH_SEARCH_USD,
} from "@/lib/ai/company-research";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { requireCap } from "./common.server";
import { SalesProfileSchema } from "./sales-context";
const fail = (message: string, status = 409): never => {
  throw new WorkOrderApiError(message, status);
};
export async function companyResearchAvailability(tenantId: string) {
  const ready = await tableExists("lead_research_runs"),
    settings = await getAiSettings(tenantId);
  const block = modelConfigurationBlock(settings, aiAvailable());
  const reason = !ready
    ? "Firma araştırması için veritabanı güncellemesi bekleniyor."
    : block === "AI_KEY_MISSING"
      ? "Firma araştırması için model anahtarı sunucuda tanımlı değil."
      : block
        ? MODEL_BLOCK_MESSAGES[block]
        : !featureOn(settings, "company_research")
          ? "Firma araştırması Asistan ayarlarında kapalı."
          : null;
  return {
    available: !reason,
    reason,
    maxSearches: COMPANY_RESEARCH_MAX_SEARCHES,
    searchCostUsd: COMPANY_RESEARCH_SEARCH_USD,
    cacheHours: 24,
  };
}
function researchQuery(lead: any) {
  const profile = SalesProfileSchema.parse(lead.sales_profile || {});
  if (profile.customerType === "individual")
    fail("Firma araştırması için kurumsal bir müşteri seçin.", 400);
  const parsed = CompanyResearchQuery.safeParse({
    companyName: lead.company_name || "",
    country: profile.country,
    city: profile.city,
  });
  if (!parsed.success)
    fail(
      "Önce firma adını ve ülkeyi kaydedin; aynı adlı firmaları ayırt etmek için şehri de belirtin.",
      400,
    );
  const query = parsed.data;
  return {
    query,
    fingerprint: createHash("sha256")
      .update(JSON.stringify([query, profile.customerType]))
      .digest("hex"),
  };
}
type Result = {
  message: string;
  sourceCount: number;
  cached?: boolean;
  incomplete?: boolean;
  classificationComplete?: boolean;
};
/** Claim once, call outside the DB transaction, then apply only against the same company context. */
export async function researchLeadCompany(
  a: WorkOrderActor,
  leadId: string,
  raw: unknown,
): Promise<Result> {
  await requireCap(a, "crm", "edit", "Firma araştırması");
  z.uuid().parse(leadId);
  const { commandId } = z.object({ commandId: z.uuid() }).strict().parse(raw);
  if (!(await tableExists("lead_research_runs")))
    fail("Firma araştırması için veritabanı güncellemesi bekleniyor.");
  const claim = await withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId + ":company-research:" + leadId},0))`;
    const [old] =
      await tx`SELECT * FROM lead_research_runs WHERE tenant_id=${a.tenantId} AND command_id=${commandId}`;
    if (old) {
      if (old.lead_id !== leadId || old.created_by !== a.userId)
        fail("İşlem anahtarı farklı araştırmada kullanıldı.");
      if (
        old.status === "running" &&
        Date.now() - new Date(old.created_at).getTime() < 180000
      )
        fail("Araştırma sürüyor; biraz sonra tekrar kontrol edin.");
      if (old.status === "running") {
        const result = {
          message:
            "Önceki araştırmanın sonucu alınamadı. Yeniden araştırabilirsiniz.",
          sourceCount: 0,
        };
        await tx`UPDATE lead_research_runs SET status='failed',result=${JSON.stringify(result)}::text::jsonb,finished_at=now() WHERE id=${old.id}`;
        return { result };
      }
      return { result: old.result as Result };
    }
    const [lead] =
      await tx`SELECT company_name,sales_profile FROM leads WHERE tenant_id=${a.tenantId} AND id=${leadId} FOR UPDATE`;
    if (!lead) fail("Potansiyel müşteri bulunamadı.", 404);
    const { query, fingerprint } = researchQuery(lead);
    await tx`UPDATE lead_research_runs SET status='failed',finished_at=now(),result='{"message":"Araştırma zaman aşımına uğradı.","sourceCount":0}'::jsonb WHERE tenant_id=${a.tenantId} AND lead_id=${leadId} AND status='running' AND created_at<now()-interval '3 minutes'`;
    if (
      (
        await tx`SELECT 1 FROM lead_research_runs WHERE tenant_id=${a.tenantId} AND lead_id=${leadId} AND status='running'`
      ).length
    )
      fail("Bu firma için araştırma zaten sürüyor.");
    const [cached] =
      await tx`SELECT id,result FROM lead_research_runs WHERE tenant_id=${a.tenantId} AND lead_id=${leadId} AND fingerprint=${fingerprint} AND status='completed' AND cached_from_id IS NULL AND finished_at>now()-interval '24 hours' ORDER BY finished_at DESC LIMIT 1`;
    if (cached) {
      const result = {
        ...cached.result,
        cached: true,
        message:
          "Son 24 saatteki araştırma gösteriliyor; yeni servis çağrısı yapılmadı.",
      } as Result;
      await tx`INSERT INTO lead_research_runs(tenant_id,lead_id,command_id,created_by,fingerprint,query,status,result,cached_from_id,finished_at) VALUES(${a.tenantId},${leadId},${commandId},${a.userId},${fingerprint},${JSON.stringify(query)}::text::jsonb,'completed',${JSON.stringify(result)}::text::jsonb,${cached.id},now())`;
      return { result };
    }
    const availability = await companyResearchAvailability(a.tenantId);
    if (!availability.available) fail(availability.reason!);
    try {
      await assertModelAllowed({ tenantId: a.tenantId, userId: a.userId });
    } catch (error) {
      if (error instanceof ModelBlockedError) fail(error.message);
      throw error;
    }
    if (
      (
        await tx`SELECT 1 FROM lead_research_runs WHERE tenant_id=${a.tenantId} AND lead_id=${leadId} AND status IN('failed','stale') AND finished_at>now()-interval '1 minute'`
      ).length
    )
      fail("Yeniden araştırmadan önce bir dakika bekleyin.");
    const [run] =
      await tx`INSERT INTO lead_research_runs(tenant_id,lead_id,command_id,created_by,fingerprint,query,status) VALUES(${a.tenantId},${leadId},${commandId},${a.userId},${fingerprint},${JSON.stringify(query)}::text::jsonb,'running') RETURNING id`;
    return { id: run.id as string, query, fingerprint };
  });
  if ("result" in claim) return claim.result!;
  try {
    const found = await getAIService().researchCompany(claim.query!, {
      tenantId: a.tenantId,
      userId: a.userId,
      feature: "company_research",
    });
    return await withTransaction(async (tx) => {
      const [lead] =
        await tx`SELECT company_name,sales_profile FROM leads WHERE tenant_id=${a.tenantId} AND id=${leadId} FOR UPDATE`;
      const [run] =
        await tx`SELECT status FROM lead_research_runs WHERE tenant_id=${a.tenantId} AND id=${claim.id} FOR UPDATE`;
      let current = false;
      try {
        current =
          Boolean(lead) &&
          researchQuery(lead).fingerprint === claim.fingerprint;
      } catch {
        /* Changed/removed company data invalidates the answer. */
      }
      if (run?.status !== "running")
        return {
          message:
            "Bu araştırma kapanmış; güncel firma bilgilerini kontrol edin.",
          sourceCount: 0,
        };
      if (!current) {
        const result = {
          message:
            "Araştırma sırasında firma bilgileri değişti. Sonuçlar eklenmedi; güncel bilgilerle tekrar araştırın.",
          sourceCount: 0,
        };
        await tx`UPDATE lead_research_runs SET status='stale',result=${JSON.stringify(result)}::text::jsonb,finished_at=now() WHERE id=${claim.id} AND tenant_id=${a.tenantId}`;
        return result;
      }
      for (const s of found.sources) {
        const evidence = {
          kind: "web_search_citation",
          quote: s.quote,
          provider: "anthropic",
          retrievedAt: new Date().toISOString(),
        };
        await tx`INSERT INTO lead_research_sources(tenant_id,lead_id,category,url,title,findings,status,checked_at,created_by,updated_by,command_id,research_run_id,evidence) VALUES(${a.tenantId},${leadId},${s.category},${s.url},${s.title},${s.quote},'reported',now(),${a.userId},${a.userId},${randomUUID()},${claim.id},${JSON.stringify(evidence)}::text::jsonb)`;
      }
      const result: Result = {
        sourceCount: found.sources.length,
        incomplete: found.incomplete,
        classificationComplete: found.classificationComplete,
        message: found.sources.length
          ? `${found.sources.length} kaynak alıntısı eklendi; firma eşleşmesini ve bulguları kontrol edin.`
          : "Bu firmayla eşleştirilebilen kaynak alıntısı bulunamadı. Firma adını ve konumu kontrol edebilirsiniz.",
      };
      await tx`UPDATE lead_research_runs SET status='completed',result=${JSON.stringify(result)}::text::jsonb,finished_at=now() WHERE id=${claim.id} AND tenant_id=${a.tenantId}`;
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorId: a.userId,
        entityType: "lead",
        entityId: leadId,
        action: "company_researched",
        metadata: { runId: claim.id, sourceCount: found.sources.length },
      });
      return result;
    });
  } catch (error) {
    const result = {
      message:
        error instanceof ModelBlockedError
          ? error.message
          : "Firma araştırması tamamlanamadı. Sağlayıcı erişimini kontrol edip yeniden deneyin.",
      sourceCount: 0,
    };
    await sql`UPDATE lead_research_runs SET status='failed',result=${JSON.stringify(result)}::text::jsonb,finished_at=now() WHERE tenant_id=${a.tenantId} AND id=${claim.id} AND status='running'`;
    return result;
  }
}
