/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
jest.mock("@/lib/db/transaction", () => ({ withTransaction: jest.fn() }));
jest.mock("@/lib/db/schema-guard", () => ({ tableExists: jest.fn() }));
jest.mock("@/lib/features/field/common.server", () => ({
  requireCap: jest.fn(),
}));
jest.mock("@/lib/features/manufacturing/purchasing.service", () => ({
  requireProcurementRead: jest.fn(),
  requireProcurementWrite: jest.fn(),
}));
jest.mock("@/lib/features/manufacturing/inventory.service", () => ({
  postStockEntryInTransaction: jest.fn(),
}));
jest.mock("@/lib/features/work-orders/security", () => ({
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
import { withTransaction } from "@/lib/db/transaction";
import { tableExists } from "@/lib/db/schema-guard";
import { requireProcurementWrite } from "@/lib/features/manufacturing/purchasing.service";
import {
  createSupplierReturn,
  supplierReturns,
  supplierReturnsReady,
  transitionSupplierReturn,
} from "@/lib/features/manufacturing/supplier-return.service";

const PENDING = "Tedarikçi iadesi için veritabanı güncellemesi bekleniyor";
const actor = { tenantId: "tenant-a", userId: "u", role: "owner" as const };
const id = "00000000-0000-4000-8000-000000000003";
const input = {
  sourceLineId: "00000000-0000-4000-8000-000000000001",
  idempotencyKey: "00000000-0000-4000-8000-000000000002",
  quantity: 1,
};
const tables = (present: string[]) =>
  jest
    .mocked(tableExists)
    .mockImplementation(async (name: string) => present.includes(name));

beforeEach(() => {
  jest.mocked(sql).mockReset();
  jest.mocked(withTransaction).mockReset();
  jest.mocked(tableExists).mockReset();
  jest.mocked(requireProcurementWrite).mockReset();
});

describe("before migration 086 (tableExists = false)", () => {
  beforeEach(() => tables([]));
  it("is not ready, and needs both tables", async () => {
    expect(await supplierReturnsReady()).toBe(false);
    tables(["supplier_returns"]);
    expect(await supplierReturnsReady()).toBe(false);
  });
  it("lists nothing without querying", async () => {
    await expect(supplierReturns(actor)).resolves.toEqual([]);
    expect(sql).not.toHaveBeenCalled();
  });
  it("answers a single document with 409", async () => {
    await expect(supplierReturns(actor, id)).rejects.toMatchObject({
      status: 409,
      message: PENDING,
    });
    expect(sql).not.toHaveBeenCalled();
  });
  it("refuses create and transition with 409, before any transaction", async () => {
    await expect(createSupplierReturn(actor, input)).rejects.toMatchObject({
      status: 409,
      message: PENDING,
    });
    await expect(
      transitionSupplierReturn(actor, id, { status: "sent" }),
    ).rejects.toMatchObject({ status: 409, message: PENDING });
    expect(withTransaction).not.toHaveBeenCalled();
  });
  it("keeps permission errors ahead of schema state", async () => {
    jest.mocked(requireProcurementWrite).mockImplementation(() => {
      throw Object.assign(new Error("Yetkiniz yok"), { status: 403 });
    });
    await expect(createSupplierReturn(actor, input)).rejects.toMatchObject({
      status: 403,
    });
    expect(tableExists).not.toHaveBeenCalled();
  });
});

describe("after migration 086 (tableExists = true)", () => {
  beforeEach(() => tables(["supplier_returns", "supplier_return_lines"]));
  it("queries the documents", async () => {
    const rows = [{ id, status: "draft", lines: [] }];
    jest.mocked(sql).mockResolvedValueOnce(rows as never);
    await expect(supplierReturns(actor)).resolves.toEqual(rows);
    expect(sql).toHaveBeenCalledTimes(1);
  });
  it("runs create and transition in a transaction", async () => {
    jest.mocked(withTransaction).mockResolvedValue({ id } as never);
    await expect(createSupplierReturn(actor, input)).resolves.toEqual({ id });
    await expect(
      transitionSupplierReturn(actor, id, { status: "sent" }),
    ).resolves.toEqual({ id });
    expect(withTransaction).toHaveBeenCalledTimes(2);
  });
});
