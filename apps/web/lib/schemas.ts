import { z } from "zod";
import { analysisStatuses, orderStatuses, organizationRoles } from "@/lib/types";
import { extractedOrderFieldsSchema } from "@/lib/ai/extraction-schema";

export const organizationRoleSchema = z.enum(organizationRoles);
export const orderStatusSchema = z.enum(orderStatuses);
export const analysisStatusSchema = z.enum(analysisStatuses);

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Şirket adı en az 2 karakter olmalı.").max(120),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(10, "Parola en az 10 karakter olmalı.").max(128),
  next: z.string().max(2000).optional(),
});

export const signInSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  next: z.string().max(2000).optional(),
});

export const createOrderSchema = z.object({
  organizationId: z.uuid(),
  customerName: z.string().trim().max(160).optional().default(""),
  projectName: z.string().trim().max(160).optional().default(""),
  customerReference: z.string().trim().max(120).optional().default(""),
  plannedDeliveryDate: z.union([z.literal(""), z.iso.date()]).optional().default(""),
  notes: z.string().trim().max(5000).optional().default(""),
});

export const updateOrderSchema = createOrderSchema.extend({
  orderId: z.uuid(),
});

export const inviteMemberSchema = z.object({
  organizationId: z.uuid(),
  email: z.email().transform((value) => value.toLowerCase()),
  role: organizationRoleSchema.exclude(["owner"]),
});

export const advanceStageSchema = z.object({
  organizationId: z.uuid(),
  orderId: z.uuid(),
  stageId: z.uuid(),
  eventType: z.enum(["started", "completed", "reopened", "note"]),
  note: z.string().trim().max(1000).optional().default(""),
});

export const reviewAnalysisSchema = z.object({
  organizationId: z.uuid(),
  analysisId: z.uuid(),
  orderId: z.uuid(),
  normalizedOutput: extractedOrderFieldsSchema,
});

export const analyzeDocumentSchema = z.object({
  documentId: z.uuid(),
});
