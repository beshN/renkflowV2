/**
 * warehouse.label.print validates every label with a fixed number of queries (one for the labels,
 * one per item/location/lot kind) instead of two per id, and keeps the old per-id error order.
 */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
jest.mock("@/lib/features/field/common.server", () => ({ requireCap: jest.fn(async () => undefined) }));
jest.mock("@/lib/features/manufacturing/inventory.service", () => ({ postStockEntryInTransaction: jest.fn() }));
jest.mock("@/lib/features/work-orders/security", () => ({
  WorkOrderApiError: class extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));

import { executeWarehouse } from "@/lib/features/warehouse/service";

const tenantId = "00000000-0000-4000-8000-0000000000aa";
const actor = { userId: "00000000-0000-4000-8000-0000000000bb", tenantId, role: "office" } as any;
const L1 = "00000000-0000-4000-8000-000000000001";
const L2 = "00000000-0000-4000-8000-000000000002";
const L3 = "00000000-0000-4000-8000-000000000003";
const ITEM = "00000000-0000-4000-8000-0000000000c1";
const LOT = "00000000-0000-4000-8000-0000000000c2";

type Row = Record<string, unknown>;
/** A tagged-template tx that answers by table and records each statement. */
function fakeTx(tables: { labels: Row[]; items?: Row[]; lots?: Row[] }) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const tx = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("$");
    calls.push({ text, values });
    if (text.includes("FROM factory_labels")) {
      const ids = (values[1] as string[]).map((v) => v.toLowerCase());
      return tables.labels.filter((l) => ids.includes(String(l.id)));
    }
    if (text.includes("FROM inventory_items")) return tables.items || [];
    if (text.includes("FROM stock_lots")) return tables.lots || [];
    if (text.startsWith("UPDATE factory_labels")) return [];
    throw new Error("unexpected query: " + text);
  });
  return { tx, calls };
}

describe("warehouse.label.print", () => {
  it("checks many labels in one label query plus one query per kind, then counts the print", async () => {
    const { tx, calls } = fakeTx({
      labels: [
        { id: L1, kind: "item", record_id: ITEM },
        { id: L2, kind: "lot", record_id: LOT },
        { id: L3, kind: "item", record_id: ITEM },
      ],
      items: [{ id: ITEM, sku: "S", name: "Profil", stock_uom: "m", item_type: "raw" }],
      lots: [{ id: LOT, lot_number: "LOT-1", name: "Profil", remaining_qty: "6" }],
    });
    await expect(executeWarehouse(tx, actor, "warehouse.label.print", { ids: [L1, L2, L3] }, "k")).resolves.toEqual({ ok: true });
    expect(calls.map((c) => c.text.split(" ")[0] + " " + (/FROM (\w+)|UPDATE (\w+)/.exec(c.text)?.slice(1).find(Boolean)))).toEqual([
      "SELECT factory_labels",
      "SELECT inventory_items",
      "SELECT stock_lots",
      "UPDATE factory_labels",
    ]);
    // Every lookup stays inside the actor's firm.
    for (const c of calls) expect(c.values).toContain(tenantId);
  });

  it("accepts ids in any letter case, as the uuid comparison in SQL does", async () => {
    const { tx } = fakeTx({
      labels: [{ id: L1, kind: "item", record_id: ITEM }],
      items: [{ id: ITEM, sku: "S", name: "Profil", stock_uom: "m", item_type: "raw" }],
    });
    await expect(executeWarehouse(tx, actor, "warehouse.label.print", { ids: [L1.toUpperCase()] }, "k")).resolves.toEqual({ ok: true });
  });

  it("rejects an unknown label before printing anything", async () => {
    const { tx, calls } = fakeTx({ labels: [{ id: L1, kind: "item", record_id: ITEM }], items: [{ id: ITEM, name: "P" }] });
    await expect(executeWarehouse(tx, actor, "warehouse.label.print", { ids: [L1, L2] }, "k")).rejects.toMatchObject({ message: "Etiket bulunamadı", status: 404 });
    expect(calls.some((c) => c.text.startsWith("UPDATE"))).toBe(false);
  });

  it("reports the first failing id in request order, as the per-id loop did", async () => {
    const { tx } = fakeTx({
      labels: [
        { id: L1, kind: "lot", record_id: LOT },
        { id: L2, kind: "item", record_id: ITEM },
      ],
      items: [],
      lots: [],
    });
    // L1 (lot, missing) comes first, so the lot message wins over the item one.
    await expect(executeWarehouse(tx, actor, "warehouse.label.print", { ids: [L1, L2] }, "k")).rejects.toMatchObject({ message: "Lot bulunamadı", status: 404 });
    // An unknown label after a missing record still reports the record first.
    const second = fakeTx({ labels: [{ id: L2, kind: "item", record_id: ITEM }], items: [] });
    await expect(executeWarehouse(second.tx, actor, "warehouse.label.print", { ids: [L2, L3] }, "k")).rejects.toMatchObject({ message: "Malzeme bulunamadı" });
  });
});
