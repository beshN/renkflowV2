import type { ExtractedOrderFields } from "@/lib/types";

type Correction = { fieldPath: string; aiValue: unknown; correctedValue: unknown };

export function collectAnalysisCorrections(
  original: ExtractedOrderFields,
  verified: ExtractedOrderFields,
): Correction[] {
  const corrections: Correction[] = [];
  const topFields = ["customerName", "projectName", "orderReference", "notes"] as const;
  const itemFields = ["quantity", "widthMm", "heightMm", "lightColor", "profileType", "motorType", "notes"] as const;

  for (const field of topFields) {
    if (!Object.is(original[field].value, verified[field].value)) {
      corrections.push({ fieldPath: field, aiValue: original[field].value, correctedValue: verified[field].value });
    }
  }

  verified.items.forEach((item, index) => {
    for (const field of itemFields) {
      const aiValue = original.items[index]?.[field].value ?? null;
      if (!Object.is(aiValue, item[field].value)) {
        corrections.push({ fieldPath: `items.${index}.${field}`, aiValue, correctedValue: item[field].value });
      }
    }
  });

  original.items.slice(verified.items.length).forEach((item, index) => {
    corrections.push({
      fieldPath: `items.${verified.items.length + index}`,
      aiValue: item,
      correctedValue: null,
    });
  });

  return corrections;
}
