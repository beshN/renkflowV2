/** @jest-environment node */
import { pilotReadinessReport } from "@/lib/features/manufacturing/pilot-readiness.service";
import {
  pilotColumns,
  type Row,
} from "@/lib/features/manufacturing/pilot-readiness";
import { effectiveAccess } from "@/lib/security/access-matrix";
import type { WorkOrderActor } from "@/lib/features/work-orders/security";
import { getVisibleNavGroups } from "@/lib/core/dashboard-nav";
import { canAccessRoute, type UserRole } from "@/lib/features/auth/permissions";

jest.mock("server-only", () => ({}));
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
jest.mock("@/lib/db", () => ({
  sql: { begin: (...args: unknown[]) => mockBegin(...args) },
}));

const mockBegin = jest.fn();
const actor: WorkOrderActor = {
  userId: "user-a",
  tenantId: "tenant-a",
  role: "admin",
};

beforeEach(() => mockBegin.mockReset());

it.each(["office", "worker", "member", "accountant"] as UserRole[])(
  "refuses %s before opening a transaction",
  async (role) => {
    await expect(
      pilotReadinessReport({ ...actor, role }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockBegin).not.toHaveBeenCalled();
  },
);

it("refuses missing tenant and narrowed production access before reading", async () => {
  await expect(
    pilotReadinessReport({ ...actor, tenantId: "" }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    pilotReadinessReport({
      ...actor,
      access: effectiveAccess("admin", {
        key: "limited",
        name: "Limited",
        permissions: {},
        hidden: [],
      }),
    }),
  ).rejects.toMatchObject({ status: 403 });
  expect(mockBegin).not.toHaveBeenCalled();
});

// This fake SQL executor refuses every non-SELECT statement, missing tenant predicate,
// or unbound tenant value. Both tenants exist together; the real reader/evaluator run.
function database() {
  const source: Record<string, Row[]> = Object.fromEntries(
    Object.keys(pilotColumns).map((table) => [table, []]),
  );
  source.product_family_recipes = ["tenant-a", "tenant-b"].map((tenant_id) => ({
    tenant_id,
    family: "makasli",
    recipe_code: `${tenant_id}-PRIVATE`,
  }));
  const queries: string[] = [];
  const tx = (
    strings: TemplateStringsArray | unknown,
    ...values: unknown[]
  ): unknown => {
    if (!Array.isArray(strings) || !("raw" in strings))
      return { identifier: strings };
    const query = (strings as unknown as TemplateStringsArray).join("?");
    queries.push(query);
    expect(query.trim()).toMatch(/^SELECT /);
    if (query.includes("information_schema.tables"))
      return Object.keys(pilotColumns).map((table_name) => ({ table_name }));
    if (query.includes("information_schema.columns"))
      return Object.entries(pilotColumns).flatMap(([table_name, columns]) =>
        columns.map((column_name) => ({ table_name, column_name })),
      );
    expect(query).toContain("WHERE tenant_id = ?");
    expect(values[2]).toBe("tenant-a");
    const table = (values[1] as { identifier: string }).identifier;
    return source[table].filter((row) => row.tenant_id === values[2]);
  };
  mockBegin.mockImplementation(async (mode, callback) => {
    expect(mode).toBe("read only");
    return callback(tx);
  });
  return { source, queries };
}

it.each(["owner", "admin"] as UserRole[])(
  "reads only actor tenant in READ ONLY mode for %s",
  async (role) => {
    const { queries } = database();
    const report = await pilotReadinessReport({ ...actor, role });
    expect(JSON.stringify(report)).toContain("tenant-a-PRIVATE");
    expect(JSON.stringify(report)).not.toContain("tenant-b-PRIVATE");
    expect(report.empty).toBe(false);
    expect(queries).toHaveLength(10); // two metadata reads plus all eight scoped data reads
  },
);

it("does not borrow another tenant family when actor tenant is empty", async () => {
  const { source } = database();
  source.product_family_recipes = source.product_family_recipes.filter(
    (row) => row.tenant_id === "tenant-b",
  );
  const report = await pilotReadinessReport(actor);
  expect(report.empty).toBe(true);
  expect(report.findings).toContainEqual(
    expect.objectContaining({ code: "RECIPE_MISSING" }),
  );
  expect(JSON.stringify(report)).not.toContain("tenant-b-PRIVATE");
});

it("propagates database failure instead of manufacturing an empty successful report", async () => {
  mockBegin.mockRejectedValue(new Error("read failed"));
  await expect(pilotReadinessReport(actor)).rejects.toThrow("read failed");
});

it.each([
  "owner",
  "admin",
  "office",
  "worker",
  "member",
  "accountant",
] as UserRole[])("matches menu and route policy for %s", (role) => {
  const links = getVisibleNavGroups(role)
    .flatMap((group) => group.items)
    .filter((item) => item.href === "/production/pilot-readiness");
  const allowed = ["owner", "admin"].includes(role);
  expect(links).toHaveLength(allowed ? 1 : 0);
  expect(canAccessRoute(role, "/production/pilot-readiness")).toBe(allowed);
});
