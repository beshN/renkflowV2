export const organizationRoles = ["owner", "admin", "office", "production"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const orderStatuses = [
  "draft",
  "awaiting_review",
  "approved",
  "in_production",
  "ready",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const analysisStatuses = ["queued", "running", "needs_review", "completed", "failed"] as const;
export type AnalysisStatus = (typeof analysisStatuses)[number];

export interface ExtractedField<T> {
  value: T | null;
  confidence: number;
  sourcePage: number | null;
  sourceText?: string | null;
}

export interface ExtractedOrderLine {
  quantity: ExtractedField<number>;
  widthMm: ExtractedField<number>;
  heightMm: ExtractedField<number>;
  lightColor: ExtractedField<string>;
  profileType: ExtractedField<string>;
  motorType: ExtractedField<string>;
  notes: ExtractedField<string>;
}

export interface ExtractedOrderFields {
  customerName: ExtractedField<string>;
  projectName: ExtractedField<string>;
  orderReference: ExtractedField<string>;
  notes: ExtractedField<string>;
  items: ExtractedOrderLine[];
  documentLanguage: string;
  warnings: string[];
}

export interface ProductionStage {
  id: string;
  organizationId: string;
  name: string;
  position: number;
  color: string;
  isActive: boolean;
}

export type RuleValue = string | number | boolean | null | RuleValue[] | { [key: string]: RuleValue };

export type RuleExpression =
  | { type: "literal"; value: number | string | boolean | null }
  | { type: "input"; path: string }
  | { type: "binary"; op: "add" | "subtract" | "multiply" | "divide" | "min" | "max"; left: RuleExpression; right: RuleExpression }
  | { type: "round"; mode: "nearest" | "up" | "down"; digits: number; value: RuleExpression }
  | { type: "if"; condition: RuleCondition; then: RuleExpression; else: RuleExpression }
  | { type: "list"; values: RuleExpression[] };

export type RuleCondition =
  | { type: "compare"; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; left: RuleExpression; right: RuleExpression }
  | { type: "in"; value: RuleExpression; options: RuleExpression[] }
  | { type: "all" | "any"; conditions: RuleCondition[] }
  | { type: "not"; condition: RuleCondition };

export interface RuleDefinition {
  key: string;
  label: string;
  expression: RuleExpression;
  validations?: RuleCondition[];
}

export interface RuleSet {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  status: "draft" | "active" | "archived";
  rules: RuleDefinition[];
}

export interface CalculationResult {
  outputs: Record<string, RuleValue>;
  errors: Array<{ rule: string; message: string }>;
  ruleSetId: string;
  ruleSetVersion: number;
}
