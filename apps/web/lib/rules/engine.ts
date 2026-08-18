import type {
  CalculationResult,
  RuleCondition,
  RuleDefinition,
  RuleExpression,
  RuleSet,
  RuleValue,
} from "@/lib/types";
import { ruleAstSchema } from "@/lib/rules/schema";

class RuleEngineError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "RuleEngineError";
  }
}

function getInput(input: Record<string, unknown>, path: string): RuleValue {
  const segments = path.split(".");
  let value: unknown = input;

  for (const segment of segments) {
    if (segment === "__proto__" || segment === "prototype" || segment === "constructor") {
      throw new RuleEngineError("Güvenli olmayan girdi yolu.", "UNSAFE_PATH");
    }
    if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, segment)) {
      throw new RuleEngineError(`Girdi bulunamadı: ${path}`, "MISSING_INPUT");
    }
    value = (value as Record<string, unknown>)[segment];
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value)
  ) {
    return value as RuleValue;
  }
  return value as RuleValue;
}

function finiteNumber(value: RuleValue, operation: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RuleEngineError(`${operation} için sonlu sayı gerekli.`, "INVALID_NUMBER");
  }
  return value;
}

function evaluateExpression(expression: RuleExpression, input: Record<string, unknown>): RuleValue {
  switch (expression.type) {
    case "literal":
      return expression.value;
    case "input":
      return getInput(input, expression.path);
    case "list":
      return expression.values.map((value) => evaluateExpression(value, input));
    case "if":
      return evaluateCondition(expression.condition, input)
        ? evaluateExpression(expression.then, input)
        : evaluateExpression(expression.else, input);
    case "round": {
      const value = finiteNumber(evaluateExpression(expression.value, input), "Yuvarlama");
      const factor = 10 ** expression.digits;
      const operation = expression.mode === "up" ? Math.ceil : expression.mode === "down" ? Math.floor : Math.round;
      return operation((value + Number.EPSILON) * factor) / factor;
    }
    case "binary": {
      const left = finiteNumber(evaluateExpression(expression.left, input), expression.op);
      const right = finiteNumber(evaluateExpression(expression.right, input), expression.op);
      let result: number;
      switch (expression.op) {
        case "add": result = left + right; break;
        case "subtract": result = left - right; break;
        case "multiply": result = left * right; break;
        case "divide":
          if (right === 0) throw new RuleEngineError("Sıfıra bölme yapılamaz.", "DIVISION_BY_ZERO");
          result = left / right;
          break;
        case "min": result = Math.min(left, right); break;
        case "max": result = Math.max(left, right); break;
      }
      if (!Number.isFinite(result)) throw new RuleEngineError("Hesap sonucu sonlu değil.", "NON_FINITE_RESULT");
      return result;
    }
  }
}

function evaluateCondition(condition: RuleCondition, input: Record<string, unknown>): boolean {
  switch (condition.type) {
    case "all": return condition.conditions.every((item) => evaluateCondition(item, input));
    case "any": return condition.conditions.some((item) => evaluateCondition(item, input));
    case "not": return !evaluateCondition(condition.condition, input);
    case "in": {
      const value = evaluateExpression(condition.value, input);
      return condition.options.some((option) => Object.is(evaluateExpression(option, input), value));
    }
    case "compare": {
      const left = evaluateExpression(condition.left, input);
      const right = evaluateExpression(condition.right, input);
      switch (condition.op) {
        case "eq": return Object.is(left, right);
        case "neq": return !Object.is(left, right);
        case "gt": return finiteNumber(left, "Karşılaştırma") > finiteNumber(right, "Karşılaştırma");
        case "gte": return finiteNumber(left, "Karşılaştırma") >= finiteNumber(right, "Karşılaştırma");
        case "lt": return finiteNumber(left, "Karşılaştırma") < finiteNumber(right, "Karşılaştırma");
        case "lte": return finiteNumber(left, "Karşılaştırma") <= finiteNumber(right, "Karşılaştırma");
      }
    }
  }
}

export function validateRuleAst(value: unknown) {
  return ruleAstSchema.safeParse(value);
}

export function runRuleSet(
  ruleSet: RuleSet,
  input: Record<string, unknown>,
): CalculationResult {
  const outputs: Record<string, RuleValue> = {};
  const errors: CalculationResult["errors"] = [];

  for (const rule of ruleSet.rules) {
    try {
      const valid = rule.validations?.every((condition) => evaluateCondition(condition, input)) ?? true;
      if (!valid) {
        errors.push({ rule: rule.key, message: `${rule.label}: doğrulama koşulu sağlanmadı.` });
        continue;
      }
      outputs[rule.key] = evaluateExpression(rule.expression, { ...input, outputs });
    } catch (error) {
      errors.push({
        rule: rule.key,
        message: error instanceof Error ? error.message : "Bilinmeyen hesap hatası.",
      });
    }
  }

  return {
    outputs,
    errors,
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
  };
}

export type { RuleEngineError, RuleDefinition };
