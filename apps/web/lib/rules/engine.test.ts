import { describe, expect, it } from "vitest";
import { runRuleSet, validateRuleAst } from "@/lib/rules/engine";
import type { RuleSet } from "@/lib/types";

function makeRuleSet(expression: RuleSet["rules"][number]["expression"]): RuleSet {
  return {
    id: "rule-set-1",
    organizationId: "org-1",
    name: "Test",
    version: 3,
    status: "active",
    rules: [{ key: "result", label: "Sonuç", expression }],
  };
}

describe("rule engine", () => {
  it("performs deterministic arithmetic", () => {
    const result = runRuleSet(makeRuleSet({
      type: "binary",
      op: "multiply",
      left: { type: "input", path: "widthMm" },
      right: { type: "literal", value: 2 },
    }), { widthMm: 1250 });
    expect(result.outputs.result).toBe(2500);
  });

  it("rejects division by zero without crashing the run", () => {
    const result = runRuleSet(makeRuleSet({
      type: "binary",
      op: "divide",
      left: { type: "literal", value: 5 },
      right: { type: "literal", value: 0 },
    }), {});
    expect(result.errors[0]?.message).toContain("Sıfıra");
  });

  it("supports explicit rounding modes", () => {
    const result = runRuleSet(makeRuleSet({
      type: "round",
      mode: "up",
      digits: 1,
      value: { type: "literal", value: 1.21 },
    }), {});
    expect(result.outputs.result).toBe(1.3);
  });

  it("supports conditional expressions and ranges", () => {
    const result = runRuleSet(makeRuleSet({
      type: "if",
      condition: {
        type: "compare",
        op: "gte",
        left: { type: "input", path: "widthMm" },
        right: { type: "literal", value: 2000 },
      },
      then: { type: "literal", value: "large" },
      else: { type: "literal", value: "standard" },
    }), { widthMm: 2400 });
    expect(result.outputs.result).toBe("large");
  });

  it("blocks prototype traversal", () => {
    const result = runRuleSet(makeRuleSet({ type: "input", path: "constructor.name" }), {});
    expect(result.errors[0]?.message).toContain("Güvenli olmayan");
  });

  it("validates the JSON AST shape", () => {
    expect(validateRuleAst({ version: 1, rules: [] }).success).toBe(false);
    expect(validateRuleAst({
      version: 1,
      rules: [{ key: "ledCount", label: "LED", expression: { type: "literal", value: 1 } }],
    }).success).toBe(true);
  });

  it("keeps rule version in immutable result snapshot", () => {
    const result = runRuleSet(makeRuleSet({ type: "literal", value: 42 }), {});
    expect(result.ruleSetVersion).toBe(3);
  });
});
