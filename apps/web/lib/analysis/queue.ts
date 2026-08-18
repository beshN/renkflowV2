import "server-only";

import { start } from "workflow/api";
import { requireMembership } from "@/lib/auth";
import { EXTRACTION_PROMPT_VERSION, EXTRACTION_SCHEMA_VERSION } from "@/lib/ai/extraction-schema";
import { documentAnalysisWorkflow } from "@/workflows/document-analysis";
import { buildAnalysisDedupeKey } from "@/lib/analysis/dedupe";

export async function queueDocumentAnalysis(documentId: string) {
  const context = await requireDocumentAccess(documentId);
  const { supabase, user, document } = context;
  const primaryModel = process.env.AI_PRIMARY_MODEL ?? "google/gemini-3.1-flash-lite";
  const dedupeKey = buildAnalysisDedupeKey({
    documentSha256: document.sha256,
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    model: primaryModel,
  });

  const { data: existing } = await supabase
    .from("document_analyses")
    .select("id, status, workflow_run_id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existing && existing.status !== "failed") {
    return { analysisId: existing.id, status: existing.status, reused: true, runId: existing.workflow_run_id };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: recentCount }, { count: activeCount }, { data: organization }] = await Promise.all([
    supabase.from("document_analyses").select("id", { count: "exact", head: true })
      .eq("organization_id", document.organization_id).gte("created_at", thirtyDaysAgo),
    supabase.from("document_analyses").select("id", { count: "exact", head: true })
      .eq("organization_id", document.organization_id).in("status", ["queued", "running"]),
    supabase.from("organizations").select("analysis_limit_30d, concurrent_analysis_limit")
      .eq("id", document.organization_id).single(),
  ]);

  if (!organization) throw new Error("Şirket analiz ayarları bulunamadı.");
  if ((recentCount ?? 0) >= organization.analysis_limit_30d) {
    throw new Error("Son 30 günlük PDF analiz limitine ulaşıldı.");
  }
  if ((activeCount ?? 0) >= organization.concurrent_analysis_limit) {
    throw new Error("Eşzamanlı analiz sınırına ulaşıldı. Mevcut analiz tamamlanınca yeniden deneyin.");
  }

  let analysisId = existing?.id as string | undefined;
  if (analysisId) {
    const { error } = await supabase.from("document_analyses").update({
      status: "queued",
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
    }).eq("id", analysisId);
    if (error) throw error;
  } else {
    const { data: analysis, error } = await supabase.from("document_analyses").insert({
      organization_id: document.organization_id,
      order_id: document.order_id,
      document_id: document.id,
      status: "queued",
      dedupe_key: dedupeKey,
      model_requested: primaryModel,
      escalation_model: process.env.AI_ESCALATION_MODEL ?? "openai/gpt-5.4-mini",
      prompt_version: EXTRACTION_PROMPT_VERSION,
      schema_version: EXTRACTION_SCHEMA_VERSION,
      created_by: user.id,
    }).select("id").single();
    if (error || !analysis) throw error ?? new Error("Analiz kaydı oluşturulamadı.");
    analysisId = analysis.id;
  }

  if (!analysisId) throw new Error("Analiz kimliği oluşturulamadı.");
  const queuedAnalysisId = analysisId;
  try {
    const run = await start(documentAnalysisWorkflow, [queuedAnalysisId]);
    await supabase.from("document_analyses").update({ workflow_run_id: run.runId }).eq("id", queuedAnalysisId);
    return { analysisId: queuedAnalysisId, status: "queued", reused: false, runId: run.runId };
  } catch (error) {
    await supabase.from("document_analyses").update({
      status: "failed",
      error_code: "WORKFLOW_START_FAILED",
      error_message: error instanceof Error ? error.message.slice(0, 2000) : "Workflow başlatılamadı.",
    }).eq("id", queuedAnalysisId);
    throw error;
  }
}

async function requireDocumentAccess(documentId: string) {
  const { supabase, user } = await requireMembershipForDocument(documentId);
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, organization_id, order_id, sha256")
    .eq("id", documentId)
    .single();
  if (error || !document) throw new Error("PDF bulunamadı.");
  return { supabase, user, document };
}

async function requireMembershipForDocument(documentId: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum gerekli.");

  const { data: document } = await supabase.from("documents")
    .select("organization_id").eq("id", documentId).maybeSingle();
  if (!document) throw new Error("PDF bulunamadı.");

  return requireMembership(document.organization_id, ["owner", "admin", "office"]);
}
