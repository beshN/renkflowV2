import { z } from "zod";
export const CustomerRmaInput = z.object({
  sourceLineId: z.string().uuid(),
  quantity: z.number().positive().max(1e9).multipleOf(0.000001),
  reason: z.string().trim().min(1).max(2000),
  photoAttachmentId: z.string().uuid().optional(),
  serviceTicketId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid(),
});
export const CustomerRmaDecision = z.object({
  decision: z.enum(["repair", "replace", "reject"]),
});
