import {
  technicalOrder,
  visibleOrdersForActor,
} from "@/lib/features/orders/access";
import { sql } from "@/lib/db";
import { ordersCsv } from "@/lib/features/orders/workspace";
import { createOrder } from "../helpers/factories";
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
it("strips commercial values, private contacts, documents and custom fields from the worker DTO", () => {
  const order = createOrder({
    totalAmount: 999,
    email: "private@example.invalid",
    notes: "Private price",
    customFields: { discount: "99" },
    items: [
      {
        id: "item",
        productName: "Tente",
        quantity: 1,
        unitPrice: 999,
        totalPrice: 999,
        widthMm: 4200,
      },
    ],
    documents: [
      {
        id: "doc" as any,
        name: "Commercial PDF",
        url: "https://example.invalid/private",
        size: 1,
        uploadedAt: new Date().toISOString(),
      },
    ],
  });
  Object.assign(order, { internalMargin: 999999 });
  const dto = technicalOrder(order);
  expect(dto).toMatchObject({
    financialHidden: true,
    documents: [],
    items: [{ widthMm: 4200 }],
  });
  for (const field of [
    "totalAmount",
    "currency",
    "email",
    "phone",
    "notes",
    "customFields",
  ])
    expect(dto).not.toHaveProperty(field);
  expect(dto.items![0]).not.toHaveProperty("unitPrice");
  expect(dto.items![0]).not.toHaveProperty("totalPrice");
  expect(dto).not.toHaveProperty("internalMargin");
  expect(order.totalAmount).toBe(999);
  expect(ordersCsv([dto], false)).not.toContain("Tutar");
  expect(ordersCsv([dto], false)).not.toContain("Para birimi");
});
it("limits workers to orders connected to their assigned work", async () => {
  const one = createOrder(),
    two = createOrder();
  (sql as unknown as jest.Mock).mockResolvedValue([{ order_id: one.id }]);
  const actor = {
    tenantId: "tenant",
    userId: "worker",
    role: "worker" as const,
  };
  expect(
    (await visibleOrdersForActor([one, two], actor)).map((o) => o.id),
  ).toEqual([one.id]);
});
it("preserves commercial fields for sales accounts", async () => {
  const order = createOrder();
  expect(
    await visibleOrdersForActor([order], {
      tenantId: "tenant",
      userId: "office",
      role: "office",
    }),
  ).toEqual([order]);
  expect(sql).not.toHaveBeenCalled();
});
