import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
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
    .eq("organization_id", document.organization_id)
    .eq("document_id", document.id)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existing && existing.status !== "failed") {
    if (existing.status !== "completed") await markOrderAwaitingReview(supabase, document);
    return { analysisId: existing.id, status: existing.status, reused: true, runId: existing.workflow_run_id };
  }

  if (!existing) {
    const { data: reusable } = await supabase
      .from("document_analyses")
      .select("id, model_requested, model_used, escalation_model, escalated, raw_output, normalized_output, provider_generation_id")
      .eq("organization_id", document.organization_id)
      .eq("dedupe_key", dedupeKey)
      .in("status", ["needs_review", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reusable?.normalized_output) {
      const now = new Date().toISOString();
      await markOrderAwaitingReview(supabase, document);
      const { data: cloned, error: cloneError } = await supabase.from("document_analyses").insert({
        organization_id: document.organization_id,
        order_id: document.order_id,
        document_id: document.id,
        status: "needs_review",
        dedupe_key: dedupeKey,
        model_requested: reusable.model_requested,
        model_used: reusable.model_used,
        escalation_model: reusable.escalation_model,
        escalated: reusable.escalated,
        prompt_version: EXTRACTION_PROMPT_VERSION,
        schema_version: EXTRACTION_SCHEMA_VERSION,
        raw_output: reusable.raw_output,
        normalized_output: reusable.normalized_output,
        provider_generation_id: reusable.provider_generation_id,
        input_tokens: 0,
        output_tokens: 0,
        reasoning_tokens: 0,
        cost_usd: 0,
        reused_from_analysis_id: reusable.id,
        started_at: now,
        completed_at: now,
        created_by: user.id,
      }).select("id").single();

      if (cloneError || !cloned) throw cloneError ?? new Error("Önceki analiz sonucu kullanılamadı.");
      return { analysisId: cloned.id, status: "needs_review", reused: true, runId: null };
    }
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
  await markOrderAwaitingReview(supabase, document);
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
  const { data: order } = await supabase.from("orders")
    .select("status")
    .eq("id", document.order_id)
    .eq("organization_id", document.organization_id)
    .maybeSingle();
  if (!order || !["draft", "awaiting_review", "approved"].includes(order.status)) {
    throw new Error("Üretime alınmış, teslim edilmiş veya iptal edilmiş sipariş yeniden analiz edilemez.");
  }
  return { supabase, user, document };
}

async function markOrderAwaitingReview(
  supabase: SupabaseClient,
  document: { organization_id: string; order_id: string },
) {
  const { data, error } = await supabase.from("orders")
    .update({ status: "awaiting_review" })
    .eq("id", document.order_id)
    .eq("organization_id", document.organization_id)
    .in("status", ["draft", "awaiting_review", "approved"])
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Sipariş durumu değişti. Sayfayı yenileyip tekrar deneyin.");
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
