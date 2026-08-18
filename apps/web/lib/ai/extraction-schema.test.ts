import { describe, expect, it } from "vitest";
import { extractedOrderFieldsSchema } from "@/lib/ai/extraction-schema";

const field = (value: unknown, confidence = 0.9) => ({ value, confidence, sourcePage: 1, sourceText: null });

describe("PDF extraction schema", () => {
  it("accepts normalized order fields with source and confidence", () => {
    const result = extractedOrderFieldsSchema.safeParse({
      customerName: field("Renk Yapı"),
      projectName: field("Kuzey Cephe"),
      orderReference: field("RF-15"),
      notes: field(""),
      documentLanguage: "tr",
      warnings: [],
      items: [{
        quantity: field(2),
        widthMm: field(2400),
        heightMm: field(1800),
        lightColor: field("3000K"),
        profileType: field("ZIP-125"),
        motorType: field("Somfy"),
        notes: field(""),
      }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects confidence outside 0-1 and invalid page numbers", () => {
    const invalid = field("x", 1.4);
    expect(extractedOrderFieldsSchema.safeParse({
      customerName: invalid, projectName: invalid, orderReference: invalid, notes: invalid,
      documentLanguage: "tr", warnings: [], items: [],
    }).success).toBe(false);
  });
});
