import { z } from "zod";
import {
  advanceStageSchema,
  createOrderSchema,
  inviteMemberSchema,
  reviewAnalysisSchema,
  updateOrderSchema,
} from "@/lib/schemas";

export { advanceStageSchema, createOrderSchema, inviteMemberSchema, reviewAnalysisSchema, updateOrderSchema };

export const createRuleSetSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  rulesAst: z.string().min(2).max(100_000),
});

export const activateRuleSetSchema = z.object({
  organizationId: z.uuid(),
  ruleSetId: z.uuid(),
});

export const calculationRunSchema = z.object({
  organizationId: z.uuid(),
  orderId: z.uuid(),
});

export const productionStagesSchema = z.object({
  organizationId: z.uuid(),
  stages: z.array(z.object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    position: z.number().int().min(1).max(50),
  })).min(1).max(50),
});

export const manageMemberSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  role: z.enum(["admin", "office", "production"]),
});

export const removeMemberSchema = manageMemberSchema.pick({
  organizationId: true,
  userId: true,
});

export const revokeInviteSchema = z.object({
  organizationId: z.uuid(),
  inviteId: z.uuid(),
});

export const organizationSettingsSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(2).max(120),
});

export const manualOrderItemSchema = z.object({
  quantity: z.number().int().min(1).max(1_000_000),
  widthMm: z.number().positive().max(9_999_999_999.99).nullable(),
  heightMm: z.number().positive().max(9_999_999_999.99).nullable(),
  lightColor: z.string().trim().max(120),
  profileType: z.string().trim().max(120),
  motorType: z.string().trim().max(120),
  notes: z.string().trim().max(2000),
});

export const saveManualOrderItemsSchema = z.object({
  organizationId: z.uuid(),
  orderId: z.uuid(),
  items: z.array(manualOrderItemSchema).min(1).max(250),
  approve: z.boolean(),
});

export const markOrderDeliveredSchema = z.object({
  organizationId: z.uuid(),
  orderId: z.uuid(),
  note: z.string().trim().max(1000).optional().default(""),
});
