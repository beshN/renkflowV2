/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
jest.mock("@/lib/features/orders/technical.server", () => ({
  needTechnical: jest.fn(),
}));
jest.mock("@/lib/features/work-orders/security", () => ({
  requireWorkOrderActor: jest.fn(),
  WorkOrderApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
import { sql } from "@/lib/db";
import { needTechnical } from "@/lib/features/orders/technical.server";
import {
  WorkOrderApiError,
  requireWorkOrderActor,
} from "@/lib/features/work-orders/security";
import { GET } from "@/app/api/v1/orders/[id]/drawing/route";
const orderA = "00000000-0000-4000-8000-000000000001";
const orderB = "00000000-0000-4000-8000-000000000002";
let tenant = "A";
beforeEach(() => {
  jest.resetAllMocks();
  (requireWorkOrderActor as jest.Mock).mockImplementation(async () => ({
    tenantId: tenant,
    userId: "synthetic",
    role: "office",
  }));
  (sql as unknown as jest.Mock).mockImplementation(
    async (strings: TemplateStringsArray, ...values: string[]) => {
      const query = strings.join("?");
      expect(query).toMatch(/tenant_id=\?/);
      const id = values[values.length - 1];
      const own =
        (values[0] === "A" && id === orderA) ||
        (values[0] === "B" && id === orderB);
      if (query.includes("FROM work_orders")) return [];
      if (query.includes("JOIN")) {
        expect(query).toContain("o.id=i.order_id AND o.tenant_id=?");
        expect(query).toContain("WHERE o.tenant_id=?");
        expect(values.slice(0, 2)).toEqual([tenant, tenant]);
        return own
          ? [
              {
                id: "synthetic-line",
                product_name: "Makaslı tente",
                width_mm: 5001,
                projection_mm: 3002,
                mounting_height_mm: 2803,
              },
            ]
          : [];
      }
      return own ? [{ id, order_number: `TEST-${tenant}` }] : [];
    },
  );
});
const get = (id: string) =>
  GET(new Request("http://localhost"), { params: Promise.resolve({ id }) });
test.each([
  ["A", orderA, orderB],
  ["B", orderB, orderA],
])("session tenant %s can read only its order", async (t, own, foreign) => {
  tenant = t;
  const response = await get(own);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await response.json()).lines[0].svg).toContain("5001 mm");
  (sql as unknown as jest.Mock).mockClear();
  expect((await get(foreign)).status).toBe(404);
  expect(sql).toHaveBeenCalledTimes(1);
});
test("permission failure stops reads", async () => {
  (needTechnical as jest.Mock).mockRejectedValue(
    new WorkOrderApiError("Forbidden", 403),
  );
  expect((await get(orderA)).status).toBe(403);
  expect(sql).not.toHaveBeenCalled();
});

test("unassigned worker receives 404 before any item read", async () => {
  tenant = "A";
  (requireWorkOrderActor as jest.Mock).mockResolvedValue({
    tenantId: "A",
    userId: "worker",
    role: "worker",
  });
  expect((await get(orderA)).status).toBe(404);
  expect(sql).toHaveBeenCalledTimes(2);
  expect(
    (sql as unknown as jest.Mock).mock.calls.some(([query]) =>
      query.join("").includes("FROM order_items"),
    ),
  ).toBe(false);
});
