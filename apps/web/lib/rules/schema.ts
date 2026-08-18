import { z } from "zod";

const literalSchema = z.object({
  type: z.literal("literal"),
  value: z.union([z.number().finite(), z.string(), z.boolean(), z.null()]),
});

const inputSchema = z.object({
  type: z.literal("input"),
  path: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_.]*$/),
});

export const expressionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("type", [
    literalSchema,
    inputSchema,
    z.object({
      type: z.literal("binary"),
      op: z.enum(["add", "subtract", "multiply", "divide", "min", "max"]),
      left: expressionSchema,
      right: expressionSchema,
    }),
    z.object({
      type: z.literal("round"),
      mode: z.enum(["nearest", "up", "down"]),
      digits: z.number().int().min(0).max(6),
      value: expressionSchema,
    }),
    z.object({
      type: z.literal("if"),
      condition: conditionSchema,
      then: expressionSchema,
      else: expressionSchema,
    }),
    z.object({
      type: z.literal("list"),
      values: z.array(expressionSchema).max(500),
    }),
  ]),
);

export const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("compare"),
      op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
      left: expressionSchema,
      right: expressionSchema,
    }),
    z.object({
      type: z.literal("in"),
      value: expressionSchema,
      options: z.array(expressionSchema).max(500),
    }),
    z.object({
      type: z.enum(["all", "any"]),
      conditions: z.array(conditionSchema).max(100),
    }),
    z.object({ type: z.literal("not"), condition: conditionSchema }),
  ]),
);

export const ruleDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(120),
  expression: expressionSchema,
  validations: z.array(conditionSchema).max(50).optional(),
});

export const ruleAstSchema = z.object({
  version: z.literal(1),
  rules: z.array(ruleDefinitionSchema).min(1).max(200),
}).superRefine((value, context) => {
  const keys = new Set<string>();
  value.rules.forEach((rule, index) => {
    if (keys.has(rule.key)) {
      context.addIssue({
        code: "custom",
        path: ["rules", index, "key"],
        message: `Kural anahtarı benzersiz olmalı: ${rule.key}`,
      });
    }
    keys.add(rule.key);
  });
});
