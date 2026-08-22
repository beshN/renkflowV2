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
