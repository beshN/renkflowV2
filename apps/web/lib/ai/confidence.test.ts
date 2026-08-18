import { describe, expect, it } from "vitest";
import { needsEscalation } from "@/lib/ai/confidence";
import type { ExtractedOrderFieldsOutput } from "@/lib/ai/extraction-schema";

const field = <T>(value: T, confidence = 0.95) => ({ value, confidence, sourcePage: 1, sourceText: null });

function output(confidence = 0.95): ExtractedOrderFieldsOutput {
  return {
    customerName: field("Örnek"),
    projectName: field("Proje"),
    orderReference: field("RF-1"),
    notes: field(""),
    documentLanguage: "tr",
    warnings: [],
    items: [{
      quantity: field(1, confidence),
      widthMm: field(1200, confidence),
      heightMm: field(1800, confidence),
      lightColor: field("3000K"),
      profileType: field("P-1"),
      motorType: field("M-1"),
      notes: field(""),
    }],
  };
}

describe("analysis confidence gate", () => {
  it("accepts complete high-confidence critical fields", () => {
    expect(needsEscalation(output(), 0.72)).toBe(false);
  });

  it("escalates a low-confidence critical dimension", () => {
    expect(needsEscalation(output(0.5), 0.72)).toBe(true);
  });

  it("escalates missing items", () => {
    const value = output();
    value.items = [];
    expect(needsEscalation(value, 0.72)).toBe(true);
  });

  it("escalates a missing production field", () => {
    const value = output();
    value.items[0].motorType.value = null;
    expect(needsEscalation(value, 0.72)).toBe(true);
  });

  it("falls back to the safe threshold when configuration is invalid", () => {
    expect(needsEscalation(output(0.6), Number.NaN)).toBe(true);
  });
});
