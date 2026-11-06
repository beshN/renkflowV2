import { z } from "zod";

export const SupplierReturnInput = z
  .object({
    sourceLineId: z.string().uuid(),
    quantity: z
      .number()
      .finite()
      .positive()
      .max(1000000)
      .refine(
        (n) => Math.abs(n * 1e6 - Math.round(n * 1e6)) < 0.0001,
        "En fazla altı ondalık basamak kullanın",
      ),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const SupplierReturnTransition = z
  .object({ status: z.enum(["sent", "closed"]) })
  .strict();
export function nextSupplierReturnStatus(current: string, next: string) {
  return (
    (current === "draft" && next === "sent") ||
    (current === "sent" && next === "closed")
  );
}
