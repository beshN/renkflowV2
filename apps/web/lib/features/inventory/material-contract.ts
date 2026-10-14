import { z } from 'zod';
import { COUNT_UNITS, PROCESSED_STATES, STOCK_UNITS, unitLabel } from './vocabulary';

/** Card validation shared by manual creation and CSV imports. Quantities belong to stock entries. */
export const MaterialInputSchema = z.object({
  sku: z.string().trim().min(1).max(180),
  name: z.string().trim().min(1).max(180),
  itemType: z.enum(['raw_material', 'finished_good', 'consumable']),
  uom: z.enum(STOCK_UNITS),
  standardLengthMm: z.number().int().nonnegative().max(30000).default(0),
  weightPerMeterKg: z.number().nonnegative().finite().max(10000).default(0),
  minStock: z.number().nonnegative().finite().max(1000000).default(0),
  profileCode: z.string().trim().max(40).nullish().transform((v) => v || null),
  sizeLabel: z.string().trim().max(40).nullish().transform((v) => v || null),
  processedStates: z.array(z.enum(PROCESSED_STATES)).max(5).default([]),
  pieceLengthMm: z.number().int().positive().max(30000).nullish(),
}).superRefine((d, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (d.uom === 'm' && (!d.standardLengthMm || !d.weightPerMeterKg)) issue('standardLengthMm', 'Profilin boyunu ve kg/m bilgisini doğrulayın');
  if (COUNT_UNITS.has(d.uom) && !Number.isInteger(d.minStock)) issue('minStock', `Minimum stok ${unitLabel(d.uom)} biriminde tam sayı olmalı`);
  if (d.uom === 'm' && d.pieceLengthMm) issue('pieceLengthMm', 'Metre ile tutulan profilde boy her çubukta girilir, kartta değil');
  if (d.processedStates.includes('boyali') && d.processedStates.includes('boyasiz')) issue('processedStates', 'Boyalı ve boyasız aynı kartta olamaz');
});
export type MaterialInput = z.infer<typeof MaterialInputSchema>;
