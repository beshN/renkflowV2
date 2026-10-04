import { z } from "zod";
import { normalizeOrderStatus } from "./workspace";
export const OrderFiltersSchema = z
  .object({
    q: z.string().max(200).default(""),
    status: z
      .enum([
        "",
        "new",
        "pending_approval",
        "approved",
        "preparing_materials",
        "ready_for_production",
        "in_production",
        "quality_check",
        "ready_for_shipment",
        "shipped",
        "completed",
        "on_hold",
        "cancelled",
      ])
      .default(""),
    stage: z
      .enum([
        "",
        "intake",
        "preparation",
        "production",
        "quality",
        "shipping",
        "completed",
      ])
      .default(""),
    view: z
      .enum(["all", "active", "overdue", "today", "completed"])
      .default("all"),
    sort: z
      .enum(["newest", "oldest", "delivery", "customer"])
      .default("newest"),
  })
  .strict();
export type OrderFilters = z.infer<typeof OrderFiltersSchema>;
export type SavedOrderView = {
  id: string;
  name: string;
  filters: OrderFilters;
  pinned: boolean;
  version: number;
};
export const ViewCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      commandId: z.uuid(),
      action: z.literal("create"),
      name: z.string().trim().min(2).max(80),
      filters: OrderFiltersSchema,
      pinned: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      commandId: z.uuid(),
      action: z.literal("update"),
      id: z.uuid(),
      version: z.number().int().positive(),
      name: z.string().trim().min(2).max(80),
      filters: OrderFiltersSchema,
      pinned: z.boolean(),
    })
    .strict(),
  z
    .object({
      commandId: z.uuid(),
      action: z.literal("delete"),
      id: z.uuid(),
      version: z.number().int().positive(),
    })
    .strict(),
]);
export function readOrderFilters(params: {
  get: (key: string) => string | null;
}): OrderFilters {
  const values: Record<string, string> = {};
  for (const key of Object.keys(OrderFiltersSchema.shape)) {
    let value = params.get(key);
    if (key === "status" && value) value = normalizeOrderStatus(value);
    const parsed = OrderFiltersSchema.shape[
      key as keyof typeof OrderFiltersSchema.shape
    ].safeParse(value ?? undefined);
    values[key] = parsed.success
      ? parsed.data
      : OrderFiltersSchema.shape[
          key as keyof typeof OrderFiltersSchema.shape
        ].parse(undefined);
  }
  return OrderFiltersSchema.parse(values);
}
export function orderFiltersQuery(filters: OrderFilters) {
  const checked = OrderFiltersSchema.parse(filters),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(checked))
    if (
      value &&
      !(key === "view" && value === "all") &&
      !(key === "sort" && value === "newest")
    )
      params.set(key, value);
  return params.toString();
}
export const sameOrderFilters = (a: OrderFilters, b: OrderFilters) =>
  orderFiltersQuery(a) === orderFiltersQuery(b);
