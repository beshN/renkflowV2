import { documentAnalysisSteps } from "@/workflows/document-analysis-steps";

export async function documentAnalysisWorkflow(analysisId: string) {
  "use workflow";

  await documentAnalysisSteps.markRunning(analysisId);
  const primary = await documentAnalysisSteps.extract(analysisId, false);

  if (primary.ok && !primary.needsEscalation) {
    await documentAnalysisSteps.persistSuccess(analysisId, primary, false);
    return { analysisId, status: "needs_review", escalated: false };
  }

  const escalation = await documentAnalysisSteps.extract(analysisId, true);
  if (escalation.ok) {
    await documentAnalysisSteps.persistSuccess(analysisId, escalation, true);
    return { analysisId, status: "needs_review", escalated: true };
  }

  if (primary.ok) {
    await documentAnalysisSteps.persistSuccess(analysisId, primary, true);
    return { analysisId, status: "needs_review", escalated: true, usedPrimaryFallback: true };
  }

  await documentAnalysisSteps.persistFailure(
    analysisId,
    escalation.errorCode ?? primary.errorCode ?? "ANALYSIS_FAILED",
    escalation.errorMessage ?? primary.errorMessage ?? "PDF analizi tamamlanamadı.",
  );
  return { analysisId, status: "failed", escalated: true };
}
