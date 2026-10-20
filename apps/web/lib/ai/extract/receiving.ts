import { z } from "zod";
export const ReceivingExtractionSchema = z.object({
  lines: z
    .array(
      z.object({
        profileCode: z.string().nullable(),
        description: z.string(),
        quantity: z.number().finite().nonnegative().nullable(),
        unit: z.enum(["m", "adet", "boy", "kg", "takim"]).nullable(),
        color: z.string().nullable(),
        lengthMm: z.number().finite().positive().nullable(),
        page: z.number().int().positive(),
      }),
    )
    .max(200),
  warnings: z.array(z.string()).max(30),
});
