import { describe, expect, it } from "vitest";
import { markOrderDeliveredSchema, saveManualOrderItemsSchema } from "@/lib/server-schemas";

const organizationId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";

describe("manual order item schema", () => {
  it("accepts a bounded production line", () => {
    const result = saveManualOrderItemsSchema.safeParse({
      organizationId,
      orderId,
      approve: true,
      items: [{
        quantity: 2,
        widthMm: 1250.5,
        heightMm: 2100,
        lightColor: "3000K",
        profileType: "Slim",
        motorType: "Somfy",
        notes: "Sağ motor",
      }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing lines and invalid dimensions", () => {
    expect(saveManualOrderItemsSchema.safeParse({ organizationId, orderId, approve: false, items: [] }).success).toBe(false);
    expect(saveManualOrderItemsSchema.safeParse({
      organizationId,
      orderId,
      approve: false,
      items: [{ quantity: 1, widthMm: -1, heightMm: null, lightColor: "", profileType: "", motorType: "", notes: "" }],
    }).success).toBe(false);
  });
});

describe("delivery confirmation schema", () => {
  it("limits delivery notes", () => {
    expect(markOrderDeliveredSchema.safeParse({ organizationId, orderId, note: "Teslim alan: Ahmet" }).success).toBe(true);
    expect(markOrderDeliveredSchema.safeParse({ organizationId, orderId, note: "x".repeat(1001) }).success).toBe(false);
  });
});
