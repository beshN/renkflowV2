import { z } from 'zod';

const precision = (value: number, digits = 6) => Number(value.toFixed(digits));

export function calculateScrapWeight(lengthM: number, weightPerMeterKg: number): number {
  if (!Number.isFinite(lengthM) || lengthM < 0) throw new Error('Hurda uzunluğu geçersiz');
  if (!Number.isFinite(weightPerMeterKg) || weightPerMeterKg < 0) {
    throw new Error('Profil kg/metre değeri geçersiz');
  }
  return precision(lengthM * weightPerMeterKg);
}

export const RectangularFrameInputSchema = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  quantity: z.number().int().positive(),
  allowanceMmPerFrame: z.number().min(0).default(0),
});

export function calculateRectangularFrameProfileMeters(
  input: z.infer<typeof RectangularFrameInputSchema>
): number {
  const value = RectangularFrameInputSchema.parse(input);
  const perimeterMm = 2 * (value.widthMm + value.heightMm) + value.allowanceMmPerFrame;
  return precision((perimeterMm * value.quantity) / 1000);
}

export function scaleBomQuantity(componentQty: number, outputQty: number, plannedQty: number): number {
  if (componentQty <= 0 || outputQty <= 0 || plannedQty <= 0) {
    throw new Error('BOM miktarları pozitif olmalıdır');
  }
  return precision((componentQty / outputQty) * plannedQty);
}

