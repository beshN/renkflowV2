import { z } from 'zod';

const text = z.string().max(4000).nullable();
const measurement = z.number().positive().finite().nullable();
export const ExtractionEvidenceSchema = z.object({
  field: z.string().min(1).max(100),
  value: z.union([z.string().max(4000), z.number().finite(), z.boolean()]).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  sourcePage: z.number().int().positive().nullable(),
  sourceText: text,
  needsReview: z.boolean(),
});
export const CustomParameterSchema = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/),
  value: z.union([z.string().max(500), z.number().finite(), z.boolean()]).nullable(),
  unit: z.string().max(24).nullable(),
});
const item = z.object({
  productName: text, quantity: z.number().int().positive().nullable(),
  widthMm: measurement, heightMm: measurement, projectionMm: measurement,
  mountingHeightMm: measurement, color: text, motorType: text, ledType: text,
  fabricType: text, notes: text,
  sourcePage: z.number().int().positive().nullable(),
  evidence: z.string().max(4000), uncertainFields: z.array(z.string().max(100)).max(50),
  unit: z.string().max(24).nullable().optional(),
  customParameters: z.array(CustomParameterSchema).max(30).optional(),
  fieldEvidence: z.array(ExtractionEvidenceSchema).max(80).optional(),
});
/** Legacy drafts remain readable; new model output has every provenance property required. */
export const DocumentExtractionSchema = z.object({
  customerName: text, email: text, phone: text, deliveryDate: text, notes: text,
  items: z.array(item).max(100), warnings: z.array(z.string().max(2000)).max(50),
  fieldEvidence: z.array(ExtractionEvidenceSchema).max(30).optional(),
});
export const DocumentExtractionModelSchema = DocumentExtractionSchema.extend({
  fieldEvidence: z.array(ExtractionEvidenceSchema).max(30),
  items: z.array(item.extend({
    unit: z.string().max(24).nullable(),
    customParameters: z.array(CustomParameterSchema).max(30),
    fieldEvidence: z.array(ExtractionEvidenceSchema).max(80),
  })).max(100),
});
export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;
export type ExtractionEvidence = z.infer<typeof ExtractionEvidenceSchema>;

/** Confidence is the model's self assessment, not a calibrated probability. Missing evidence requires review. */
export function normalizeExtraction(raw: unknown): DocumentExtraction {
  const d = DocumentExtractionSchema.parse(raw);
  const normalize = (rows: ExtractionEvidence[] = []) => rows.map(e => ({...e,
    needsReview: e.needsReview || e.value === null || e.confidence === null || e.confidence < 0.85 || !e.sourceText?.trim(),
  }));
  return {...d, fieldEvidence: normalize(d.fieldEvidence), items: d.items.map(i => ({...i,
    customParameters: i.customParameters || [], fieldEvidence: normalize(i.fieldEvidence),
  }))};
}
export function intakeReviewFields(raw: unknown): string[] {
  const d = raw as Partial<DocumentExtraction> | null;
  const fields = new Set<string>();
  for (const e of d?.fieldEvidence || []) if (e.needsReview) fields.add(e.field);
  for (const [index, item] of (d?.items || []).entries()) {
    for (const field of item.uncertainFields || []) fields.add(`items.${index}.${field}`);
    for (const e of item.fieldEvidence || []) if (e.needsReview) fields.add(`items.${index}.${e.field}`);
  }
  return [...fields].sort();
}
