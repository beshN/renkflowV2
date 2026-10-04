import {
  createOrderAction,
  deleteOrderAction,
  getOrdersAction,
  updateOrderAction,
} from "@/app/actions/order.actions";
import { requireTenantContext } from "@/lib/auth/serverAuth";
import { orderService } from "@/lib/services/orderService.server";
import { sql } from "@/lib/db";
import { createOrder } from "../helpers/factories";
jest.mock("@/lib/auth/serverAuth", () => ({ requireTenantContext: jest.fn() }));
jest.mock("@/lib/services/orderService.server", () => ({
  orderService: {
    createOrder: jest.fn(),
    deleteOrder: jest.fn(),
    getOrders: jest.fn(),
    updateOrder: jest.fn(),
  },
}));
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/utils/metrics", () => ({
  withServerActionTiming: (_name: string, callback: () => unknown) =>
    callback(),
}));
jest.mock("@/lib/cache/enterprise", () => ({
  withCache: (_key: string, callback: () => unknown) => callback(),
  invalidateCache: jest.fn(),
  cacheKeys: {
    orders: {
      list: () => "shared-list",
      stats: () => "stats",
      detail: () => "detail",
    },
  },
}));
let log: jest.SpyInstance;
beforeEach(() => {
  log = jest.spyOn(console, "error").mockImplementation(() => {});
  (requireTenantContext as jest.Mock).mockResolvedValue({
    tenantId: "tenant",
    userId: "worker",
    role: "worker",
  });
});
afterEach(() => log.mockRestore());
it("blocks worker writes before reaching an order service, including direct server-action invocation", async () => {
  await expect(deleteOrderAction("id")).rejects.toThrow("yetkiniz");
  await expect(updateOrderAction("id", { totalAmount: 9999 })).rejects.toThrow(
    "yetkiniz",
  );
  await expect(createOrderAction(new FormData())).rejects.toThrow("yetkiniz");
  expect(orderService.deleteOrder).not.toHaveBeenCalled();
  expect(orderService.updateOrder).not.toHaveBeenCalled();
  expect(orderService.createOrder).not.toHaveBeenCalled();
});
it("sanitizes the current list after checking the caller assignment", async () => {
  const assigned = createOrder({ totalAmount: 9999 }),
    other = createOrder();
  (orderService.getOrders as jest.Mock).mockResolvedValue([assigned, other]);
  (sql as unknown as jest.Mock).mockResolvedValue([{ order_id: assigned.id }]);
  const orders = await getOrdersAction();
  expect(orders).toHaveLength(1);
  expect(orders[0]).not.toHaveProperty("totalAmount");
  expect(orders[0].financialHidden).toBe(true);
});
it("retains each product configuration and negotiated price through the server-action creation path", async () => {
  (requireTenantContext as jest.Mock).mockResolvedValue({
    tenantId: "tenant",
    userId: "office",
    role: "office",
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({
    customerName: "TEST company",
    productName: "TEST awning",
    quantity: "2",
    totalAmount: "246",
    currency: "TRY",
  }))
    form.append(key, value);
  form.append(
    "items",
    JSON.stringify([
      {
        productName: "TEST awning",
        quantity: 2,
        unitPrice: 123,
        totalPrice: 246,
        widthMm: 4200,
        heightMm: 1700,
        projectionMm: 2500,
        mountingHeightMm: 3000,
      },
    ]),
  );
  (orderService.createOrder as jest.Mock).mockResolvedValue(createOrder());
  await createOrderAction(form);
  expect(orderService.createOrder).toHaveBeenCalledWith(
    "tenant",
    expect.objectContaining({
      items: [
        expect.objectContaining({
          unitPrice: 123,
          totalPrice: 246,
          heightMm: 1700,
          projectionMm: 2500,
          mountingHeightMm: 3000,
        }),
      ],
    }),
    [],
  );
});
