import type { ExtractedOrderFieldsOutput } from "@/lib/ai/extraction-schema";

export function needsEscalation(
  output: ExtractedOrderFieldsOutput,
  threshold = Number(process.env.AI_CONFIDENCE_THRESHOLD ?? 0.72),
) {
  if (!output.items.length) return true;

  return output.items.some((item) =>
    [item.quantity, item.widthMm, item.heightMm].some(
      (field) => field.value === null || field.confidence < threshold,
    ),
  );
}
