/** @jest-environment node */
import { GET as candidates } from "@/app/api/v1/production/paint-dispatches/candidates/route";
import { GET as detail } from "@/app/api/v1/production/paint-dispatches/[id]/route";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { sql } from "@/lib/db";
import { requireCap } from "@/lib/features/field/common.server";
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
jest.mock("@/lib/features/field/common.server", () => ({
  requireCap: jest.fn(),
}));
jest.mock("@/lib/features/orders/quote-file.server", () => ({
  requireCommercialApproval: jest.fn(),
}));
jest.mock("@/lib/features/manufacturing/daily-progress.server", () => ({
  syncDailyStages: jest.fn(),
}));
jest.mock("@/lib/security/field-access.server", () => ({
  redactedJson: (data: unknown, init?: ResponseInit) =>
    Response.json(data, init),
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
const id = "11111111-1111-4111-8111-111111111111";
const actor = { userId: "u", tenantId: "tenant-a", role: "owner" as const };
const req = new Request("http://localhost");
const callDetail = (value = id) =>
  detail(req, { params: Promise.resolve({ id: value }) });
beforeEach(() => {
  jest.mocked(sql).mockReset();
  jest.mocked(requireWorkOrderActor).mockReset().mockResolvedValue(actor);
  jest
    .mocked(requireCap)
    .mockReset()
    .mockResolvedValue({ base: "owner" } as never);
});
test.each([() => candidates(req), () => callDetail()])(
  "authentication and no-store on errors",
  async (call) => {
    jest
      .mocked(requireWorkOrderActor)
      .mockRejectedValue(new WorkOrderApiError("Unauthorized", 401));
    const r = await call();
    expect(r.status).toBe(401);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(sql).not.toHaveBeenCalled();
  },
);
test.each([() => candidates(req), () => callDetail()])(
  "worker cannot read dispatches",
  async (call) => {
    jest.mocked(requireCap).mockResolvedValue({ base: "worker" } as never);
    expect((await call()).status).toBe(403);
    expect(sql).not.toHaveBeenCalled();
  },
);
test("candidates group exact colours with private, no-store", async () => {
  jest
    .mocked(sql)
    .mockResolvedValueOnce([
      { id: "a", target_color: "RAL 7016", weight_kg: null },
      { id: "b", target_color: "RAL 9005", weight_kg: "2" },
      { id: "c", target_color: "RAL 7016", weight_kg: "3" },
    ] as never)
    .mockResolvedValueOnce([{ id: "supplier", name: "Boyahane" }] as never);
  const r = await candidates(req);
  expect(r.status).toBe(200);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await r.json()).toEqual({
    data: {
      groups: [
        {
          target_color: "RAL 7016",
          parts: [
            { id: "a", target_color: "RAL 7016", weight_kg: null },
            { id: "c", target_color: "RAL 7016", weight_kg: "3" },
          ],
        },
        {
          target_color: "RAL 9005",
          parts: [{ id: "b", target_color: "RAL 9005", weight_kg: "2" }],
        },
      ],
      suppliers: [{ id: "supplier", name: "Boyahane" }],
    },
  });
  expect(requireCap).toHaveBeenCalledWith(
    actor,
    "production",
    "view",
    expect.any(String),
  );
  for (const call of jest.mocked(sql).mock.calls)
    expect(call).toContain(actor.tenantId);
});
test("detail awaits route params and preserves return outcomes", async () => {
  jest
    .mocked(sql)
    .mockResolvedValueOnce([{ id, supplier_name: "Boyahane" }] as never)
    .mockResolvedValueOnce([
      {
        id: "p",
        outcome: "rejected",
        reject_reason: "Renk",
        returned_at: "2026-01-01",
      },
    ] as never);
  const r = await callDetail();
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await r.json()).toEqual({
    data: {
      id,
      supplier_name: "Boyahane",
      parts: [
        {
          id: "p",
          outcome: "rejected",
          reject_reason: "Renk",
          returned_at: "2026-01-01",
        },
      ],
    },
  });
  for (const call of jest.mocked(sql).mock.calls) {
    expect(call).toContain(actor.tenantId);
    expect(call).toContain(id);
  }
});
test("foreign or absent detail is 404; malformed ID is 400", async () => {
  jest.mocked(sql).mockResolvedValueOnce([] as never);
  expect((await callDetail()).status).toBe(404);
  jest.mocked(sql).mockClear();
  expect((await callDetail("invalid")).status).toBe(400);
  expect(sql).not.toHaveBeenCalled();
});
