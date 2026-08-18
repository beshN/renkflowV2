import { describe, expect, it } from "vitest";
import { collectAnalysisCorrections } from "@/lib/ai/corrections";
import type { ExtractedOrderFields } from "@/lib/types";

const field = <T>(value: T) => ({ value, confidence: 0.9, sourcePage: 1 });

function output(): ExtractedOrderFields {
  return {
    customerName: field("Renk Yapı"),
    projectName: field("Kuzey"),
    orderReference: field("RF-1"),
    notes: field(""),
    documentLanguage: "tr",
    warnings: [],
    items: [{
      quantity: field(1), widthMm: field(1000), heightMm: field(2000),
      lightColor: field("3000K"), profileType: field("ZIP"), motorType: field("Somfy"), notes: field(""),
    }],
  };
}

describe("analysis corrections", () => {
  it("records only values changed by the reviewer", () => {
    const original = output();
    const verified = structuredClone(original);
    verified.customerName.value = "Renk AŞ";
    verified.items[0].widthMm.value = 1200;
    expect(collectAnalysisCorrections(original, verified)).toEqual([
      { fieldPath: "customerName", aiValue: "Renk Yapı", correctedValue: "Renk AŞ" },
      { fieldPath: "items.0.widthMm", aiValue: 1000, correctedValue: 1200 },
    ]);
  });

  it("records removed item rows", () => {
    const original = output();
    const verified = output();
    verified.items = [];
    expect(collectAnalysisCorrections(original, verified)[0]).toMatchObject({
      fieldPath: "items.0",
      correctedValue: null,
    });
  });
});
