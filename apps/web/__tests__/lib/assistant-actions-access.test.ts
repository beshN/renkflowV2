/** @jest-environment node */
jest.mock("server-only", () => ({}));
const actor = { tenantId: "tenant", userId: "user", role: "owner" };
const tx = jest.fn(async (...args:unknown[]) => {void args;return [];});
jest.mock("@/lib/db", () => ({
  sql: jest.fn(),
  withTransaction: async (fn: any) => fn(tx),
}));
jest.mock("@/lib/features/work-orders/security", () => ({
  requireWorkOrderActor: jest.fn(async () => actor),
  WorkOrderApiError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
jest.mock("@/lib/security/member-access.server", () => ({
  resolveMemberAccess: jest.fn(async () => ({
    deactivated: false,
    permissions: { orders: ["view"] },
  })),
}));
import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/actions/route";
import { diffQuotes } from "@/lib/features/sales/engine";

test.each(["orderNote", "orderDraft"] as const)(
  "a restricted owner cannot use %s to bypass the custom role",
  async (kind) => {
    tx.mockClear();
    const response = await POST(
      new NextRequest("http://localhost/api/ai/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          commandId: "336d35f9-86a1-47ed-8e8a-d5077fef659f",
          action: {
            kind,
            title: "Test",
            href: null,
            orderId: "b8c5a4c7-5579-4e60-8e57-d744657c1185",
            note: "Test",
            draft: null,
          },
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(tx.mock.calls.map((c) => String(c[0])).join(" ")).not.toMatch(
      /INSERT|UPDATE/,
    );
  },
);
test("quote history reports a changed 3D selection without changing money or measures", () => {
  const quote = {
    revision: 1,
    currency: "TRY",
    discountPercent: 0,
    vatPercent: 20,
    validUntil: null,
    totalAmount: 1200,
    items: [
      {
        productName: "Pergola",
        quantity: 1,
        unitPrice: 1000,
        discountPercent: 0,
        visualization: "old",
      },
    ],
  };
  const diff = diffQuotes(quote, {
    ...quote,
    revision: 2,
    items: [{ ...quote.items[0], visualization: "new" }],
  });
  expect(JSON.stringify(diff)).toContain("3D ürün seçimi");
  expect(JSON.stringify(diff)).not.toContain("Birim fiyat");
});
