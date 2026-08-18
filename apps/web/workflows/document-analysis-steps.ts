import { gateway, generateText, Output } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  extractedOrderFieldsSchema,
  extractionInstructions,
  type ExtractedOrderFieldsOutput,
} from "@/lib/ai/extraction-schema";
import { needsEscalation } from "@/lib/ai/confidence";

interface ExtractionAttempt {
  ok: boolean;
  model: string;
  output?: ExtractedOrderFieldsOutput;
  needsEscalation: boolean;
  generationId?: string;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
  errorCode?: string;
  errorMessage?: string;
}

async function markRunning(analysisId: string) {
  "use step";
  const admin = createAdminClient();
  const { error } = await admin
    .from("document_analyses")
    .update({ status: "running", started_at: new Date().toISOString(), error_code: null, error_message: null })
    .eq("id", analysisId);
  if (error) throw error;
}

async function extract(analysisId: string, escalated: boolean): Promise<ExtractionAttempt> {
  "use step";
  const admin = createAdminClient();
  const { data: analysis, error: analysisError } = await admin
    .from("document_analyses")
    .select("id, organization_id, document_id, documents(storage_path, original_name)")
    .eq("id", analysisId)
    .single();

  if (analysisError || !analysis) throw analysisError ?? new Error("Analysis not found.");
  const document = Array.isArray(analysis.documents) ? analysis.documents[0] : analysis.documents;
  if (!document) throw new Error("Document not found.");

  const { data: pdf, error: downloadError } = await admin.storage
    .from("order-documents")
    .download(document.storage_path);
  if (downloadError || !pdf) throw downloadError ?? new Error("PDF download failed.");

  const model = escalated
    ? process.env.AI_ESCALATION_MODEL ?? "openai/gpt-5.4-mini"
    : process.env.AI_PRIMARY_MODEL ?? "google/gemini-3.1-flash-lite";

  try {
    const result = await generateText({
      model: gateway(model),
      instructions: extractionInstructions,
      output: Output.object({
        name: "RenkFlowOrderExtraction",
        description: "Üretim siparişi PDF alanları ve alan bazlı güven bilgileri",
        schema: extractedOrderFieldsSchema,
      }),
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Bu PDF'yi şemaya göre analiz et. Yalnızca belgede görülen sipariş verisini çıkar." },
          {
            type: "file",
            data: new Uint8Array(await pdf.arrayBuffer()),
            mediaType: "application/pdf",
            filename: document.original_name,
          },
        ],
      }],
      providerOptions: {
        gateway: {
          user: String(analysis.organization_id),
          tags: ["renkflow", "pdf-order-extraction", escalated ? "escalation" : "primary"],
        },
      },
    });

    const generationId = result.providerMetadata?.gateway?.generationId as string | undefined;
    let costUsd: number | undefined;
    if (generationId) {
      try {
        const info = await gateway.getGenerationInfo({ id: generationId });
        costUsd = info.totalCost;
      } catch {
        // Generation metadata can arrive after the model response; usage is still stored.
      }
    }

    const attempt: ExtractionAttempt = {
      ok: true,
      model,
      output: result.output,
      needsEscalation: needsEscalation(result.output),
      generationId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      reasoningTokens: result.usage.outputTokenDetails.reasoningTokens,
      costUsd,
    };

    await admin.from("analysis_generations").insert({
      organization_id: analysis.organization_id,
      analysis_id: analysisId,
      model,
      prompt_version: EXTRACTION_PROMPT_VERSION,
      schema_version: EXTRACTION_SCHEMA_VERSION,
      provider_generation_id: generationId,
      raw_output: result.output,
      normalized_output: result.output,
      input_tokens: attempt.inputTokens,
      output_tokens: attempt.outputTokens,
      reasoning_tokens: attempt.reasoningTokens,
      cost_usd: costUsd,
    });

    return attempt;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown extraction error";
    await admin.from("analysis_generations").insert({
      organization_id: analysis.organization_id,
      analysis_id: analysisId,
      model,
      prompt_version: EXTRACTION_PROMPT_VERSION,
      schema_version: EXTRACTION_SCHEMA_VERSION,
      error_code: error instanceof Error ? error.name : "ANALYSIS_ERROR",
      error_message: errorMessage.slice(0, 2000),
    });
    return {
      ok: false,
      model,
      needsEscalation: true,
      errorCode: error instanceof Error ? error.name : "ANALYSIS_ERROR",
      errorMessage,
    };
  }
}

async function persistSuccess(analysisId: string, attempt: ExtractionAttempt) {
  "use step";
  if (!attempt.output) throw new Error("Extraction output is missing.");
  const admin = createAdminClient();
  const { error } = await admin.from("document_analyses").update({
    status: "needs_review",
    model_used: attempt.model,
    escalated: attempt.model === (process.env.AI_ESCALATION_MODEL ?? "openai/gpt-5.4-mini"),
    raw_output: attempt.output,
    normalized_output: attempt.output,
    provider_generation_id: attempt.generationId,
    input_tokens: attempt.inputTokens,
    output_tokens: attempt.outputTokens,
    reasoning_tokens: attempt.reasoningTokens,
    cost_usd: attempt.costUsd,
    completed_at: new Date().toISOString(),
  }).eq("id", analysisId);
  if (error) throw error;
}

async function persistFailure(analysisId: string, code: string, message: string) {
  "use step";
  const admin = createAdminClient();
  await admin.from("document_analyses").update({
    status: "failed",
    error_code: code.slice(0, 160),
    error_message: message.slice(0, 2000),
    completed_at: new Date().toISOString(),
  }).eq("id", analysisId);
}

export const documentAnalysisSteps = { markRunning, extract, persistSuccess, persistFailure };
