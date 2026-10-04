import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "@/lib/features/work-orders/security";
import { postStockEntryInTransaction } from "@/lib/features/manufacturing/inventory.service";
import {
  FactoryCommandSchema,
  parseScanCode,
  assertQuantityPrecision,
  type LabelKind,
} from "./contracts";
const fail = (message: string, status = 409): never => {
  throw new WorkOrderApiError(message, status);
};
async function postWarehouseEntry(
  ...args: Parameters<typeof postStockEntryInTransaction>
) {
  try {
    return await postStockEntryInTransaction(...args);
  } catch (e) {
    const message = (e as Error).message;
    if (
      /Yetersiz kullanılabilir stok|Rafta yeterli stok yok|Raf depoya veya firmaya ait değil|Raf bakiyeleri depo bakiyesiyle uyuşmuyor/.test(
        message,
      )
    )
      fail(message);
    throw e;
  }
}
export function requireWarehouseRole(a: WorkOrderActor, write = false) {
  if (
    !(
      write
        ? ["owner", "admin", "office"]
        : ["owner", "admin", "office", "accountant", "worker"]
    ).includes(a.role)
  )
    fail("Depo işlemine erişim yetkiniz yok", 403);
}
function manager(a: WorkOrderActor) {
  if (!["owner", "admin"].includes(a.role))
    fail("Sayım onayı için yönetici yetkisi gerekli", 403);
}
export async function warehouseOverview(a: WorkOrderActor) {
  requireWarehouseRole(a);
  const t = a.tenantId;
  const [locations, items, balances, lots, moves, counts, warehouses] =
    await Promise.all([
      sql`SELECT l.*,w.name AS warehouse_name,w.code AS warehouse_code,w.warehouse_type,f.code AS label_code FROM warehouse_locations l JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id LEFT JOIN factory_labels f ON f.tenant_id=l.tenant_id AND f.record_id=l.id AND f.kind='location' WHERE l.tenant_id=${t} AND l.active AND w.active ORDER BY w.code,l.code`,
      sql`SELECT id,sku,name,stock_uom,item_type,standard_length_m FROM inventory_items WHERE tenant_id=${t} AND active ORDER BY name LIMIT 2000`,
      sql`SELECT b.*,i.name,i.sku,i.stock_uom,l.code AS location_code,l.warehouse_id FROM warehouse_location_balances b JOIN inventory_items i ON i.id=b.item_id AND i.tenant_id=b.tenant_id JOIN warehouse_locations l ON l.id=b.location_id AND l.tenant_id=b.tenant_id WHERE b.tenant_id=${t} ORDER BY i.name,l.code LIMIT 3000`,
      sql`SELECT l.id,l.item_id,l.warehouse_id,COALESCE(l.location_id,x.id) AS location_id,l.lot_number,l.remaining_qty,l.status,l.metadata->>'color' AS color,l.metadata->>'isRemnant' AS is_remnant,i.name,i.sku,i.stock_uom,f.code AS label_code FROM stock_lots l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id LEFT JOIN warehouse_locations x ON x.tenant_id=l.tenant_id AND x.warehouse_id=l.warehouse_id AND x.location_type='unassigned' LEFT JOIN factory_labels f ON f.tenant_id=l.tenant_id AND f.record_id=l.id AND f.kind='lot' WHERE l.tenant_id=${t} AND l.remaining_qty>0 ORDER BY l.created_at DESC LIMIT 2000`,
      a.role === "worker"
        ? Promise.resolve([])
        : sql`SELECT m.id,m.quantity_delta,m.created_at,l.code AS location_code,w.code AS warehouse_code,i.name,i.stock_uom,e.entry_number,e.entry_type,e.note,u.name AS actor_name FROM warehouse_location_moves m JOIN warehouse_locations l ON l.id=m.location_id AND l.tenant_id=m.tenant_id JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id JOIN stock_entry_lines s ON s.id=m.stock_entry_line_id AND s.tenant_id=m.tenant_id JOIN inventory_items i ON i.id=s.item_id AND i.tenant_id=m.tenant_id JOIN stock_entries e ON e.id=s.stock_entry_id AND e.tenant_id=m.tenant_id LEFT JOIN users u ON u.id=e.submitted_by WHERE m.tenant_id=${t} ORDER BY m.id DESC LIMIT 100`,
      a.role === "worker"
        ? Promise.resolve([])
        : sql`SELECT c.*,i.name,i.stock_uom,l.code AS location_code,u.name AS counted_by_name FROM warehouse_counts c JOIN inventory_items i ON i.id=c.item_id AND i.tenant_id=c.tenant_id JOIN warehouse_locations l ON l.id=c.location_id AND l.tenant_id=c.tenant_id LEFT JOIN users u ON u.id=c.counted_by WHERE c.tenant_id=${t} ORDER BY c.created_at DESC LIMIT 100`,
      sql`SELECT id,code,name,warehouse_type FROM warehouses WHERE tenant_id=${t} AND active ORDER BY code`,
    ]);
  return {
    actor: a,
    locations,
    items,
    balances,
    lots,
    moves,
    counts,
    warehouses,
    limits: { items: 2000, balances: 3000, lots: 2000 },
  };
}
export async function labelRecord(
  a: WorkOrderActor,
  kind: LabelKind,
  id: string,
  db: any = sql,
): Promise<any> {
  requireWarehouseRole(a);
  const t = a.tenantId;
  if (kind === "item") {
    const [r] =
      await db`SELECT id,sku,name,stock_uom,item_type FROM inventory_items WHERE tenant_id=${t} AND id=${id} AND active`;
    if (!r) fail("Malzeme bulunamadı", 404);
    return {
      kind,
      id,
      title: r.name,
      subtitle: r.sku,
      uom: r.stock_uom,
      itemId: id,
      href: a.role === "worker" ? undefined : "/inventory/" + id,
    };
  }
  if (kind === "location") {
    const [r] =
      await db`SELECT l.*,w.name AS warehouse_name,w.code AS warehouse_code,w.warehouse_type FROM warehouse_locations l JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND l.id=${id} AND l.active AND w.active`;
    if (!r) fail("Raf bulunamadı", 404);
    return {
      kind,
      id,
      title: r.code,
      subtitle: r.warehouse_name + " · " + r.name,
      warehouseId: r.warehouse_id,
    };
  }
  if (kind === "lot") {
    const [r] =
      await db`SELECT l.id,l.item_id,l.lot_number,l.status,l.remaining_qty,COALESCE(l.location_id,x.id) AS location_id,l.metadata->>'color' AS color,i.name,i.stock_uom FROM stock_lots l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id LEFT JOIN warehouse_locations x ON x.tenant_id=l.tenant_id AND x.warehouse_id=l.warehouse_id AND x.location_type='unassigned' WHERE l.tenant_id=${t} AND l.id=${id}`;
    if (!r) fail("Lot bulunamadı", 404);
    return {
      kind,
      id,
      title: r.lot_number,
      subtitle: r.name,
      quantity: Number(r.remaining_qty),
      uom: r.stock_uom,
      color: r.color,
      status: r.status,
      itemId: r.item_id,
      locationId: r.location_id,
    };
  }
  let unit: any = null;
  if (kind === "product") {
    [unit] =
      await db`SELECT serial FROM production_units WHERE tenant_id=${t} AND id=${id}`;
    if (!unit) fail("Mamul bulunamadı", 404);
  }
  if (
    kind === "job" &&
    !(await db`SELECT id FROM work_orders WHERE tenant_id=${t} AND id=${id}`)
      .length
  )
    fail("Üretim emri bulunamadı", 404);
  const { lookupProductionLabel } =
    await import("@/lib/features/manufacturing/platform.service");
  const result = await lookupProductionLabel(a, id);
  if (
    (kind === "job" && result.kind !== "job") ||
    (kind === "product" && (!result.workOrderId || result.id !== id)) ||
    (kind === "cut" && result.kind !== "cut")
  )
    fail("Etiket türü kayıtla uyuşmuyor", 400);
  return {
    ...result,
    kind,
    id,
    title: unit ? result.title + " · Ürün " + unit.serial : result.title,
    subtitle: unit ? "Mamul · " + result.summary : result.summary,
  };
}
export async function resolveLabel(a: WorkOrderActor, raw: string) {
  requireWarehouseRole(a);
  let code = "";
  try {
    code = parseScanCode(raw);
  } catch (e) {
    fail((e as Error).message, 400);
  }
  const rows =
    await sql`SELECT kind,record_id,code FROM factory_labels WHERE tenant_id=${a.tenantId} AND code=${code}`;
  if (rows[0])
    return {
      ...(await labelRecord(a, rows[0].kind, rows[0].record_id)),
      code: rows[0].code,
    };
  // Printed legacy short IDs are accepted only when the tenant has one exact prefix match.
  const legacy = /^RF-(JOB|CUT|LOT|PRODUCT)-([A-F0-9]{8})$/i.exec(code);
  if (legacy) {
    const prefix = legacy[2].toLowerCase() + "%",
      kind = { JOB: "job", CUT: "cut", LOT: "lot", PRODUCT: "product" }[
        legacy[1].toUpperCase()
      ] as LabelKind;
    const records =
      kind === "job"
        ? await sql`SELECT id FROM work_orders WHERE tenant_id=${a.tenantId} AND id::text LIKE ${prefix} LIMIT 2`
        : kind === "cut"
          ? await sql`SELECT id FROM cutting_plans WHERE tenant_id=${a.tenantId} AND id::text LIKE ${prefix} LIMIT 2`
          : kind === "lot"
            ? await sql`SELECT id FROM stock_lots WHERE tenant_id=${a.tenantId} AND id::text LIKE ${prefix} LIMIT 2`
            : await sql`SELECT id FROM production_units WHERE tenant_id=${a.tenantId} AND id::text LIKE ${prefix} LIMIT 2`;
    if (records.length !== 1)
      fail(
        "Eski kısa etiket eşleşmedi veya birden fazla kayda ait. Tam barkodu okutun",
        409,
      );
    return labelRecord(a, kind, records[0].id);
  }
  // Legacy UUIDs and factory QR links remain valid.
  if (/^[a-f0-9-]{36}$/i.test(code)) {
    const [lot] =
      await sql`SELECT id FROM stock_lots WHERE tenant_id=${a.tenantId} AND id=${code}`;
    if (lot) return labelRecord(a, "lot", lot.id);
    const [loc] =
      await sql`SELECT id FROM warehouse_locations WHERE tenant_id=${a.tenantId} AND id=${code}`;
    if (loc) return labelRecord(a, "location", loc.id);
    const [item] =
      await sql`SELECT id FROM inventory_items WHERE tenant_id=${a.tenantId} AND id=${code}`;
    if (item) return labelRecord(a, "item", item.id);
    const { lookupProductionLabel } =
      await import("@/lib/features/manufacturing/platform.service");
    return lookupProductionLabel(a, code);
  }
  const [items, lots, locations] = await Promise.all([
    sql`SELECT id FROM inventory_items WHERE tenant_id=${a.tenantId} AND sku=${code} AND active`,
    sql`SELECT id FROM stock_lots WHERE tenant_id=${a.tenantId} AND lot_number=${code}`,
    sql`SELECT id FROM warehouse_locations WHERE tenant_id=${a.tenantId} AND code=${code} AND active`,
  ]);
  const matches = [
    ...items.map((r: any) => ({ kind: "item" as const, id: r.id })),
    ...lots.map((r: any) => ({ kind: "lot" as const, id: r.id })),
    ...locations.map((r: any) => ({ kind: "location" as const, id: r.id })),
  ];
  if (matches.length > 1)
    fail("Kod birden fazla kayıtla eşleşiyor. RenkFlow etiketini okutun", 409);
  if (!matches[0])
    fail("Etiket bulunamadı veya bu kayda erişim yetkiniz yok", 404);
  return labelRecord(a, matches[0].kind, matches[0].id);
}
export async function executeWarehouse(
  tx: any,
  a: WorkOrderActor,
  action: string,
  data: Record<string, unknown>,
  key: string,
) {
  const c = FactoryCommandSchema.parse({
    action: action.replace(/^warehouse\./, ""),
    data,
  });
  const t = a.tenantId;
  if (c.action === "label.issue") {
    await labelRecord(a, c.data.kind, c.data.id, tx);
    const prefix = {
      item: "I",
      location: "R",
      lot: "L",
      job: "J",
      cut: "C",
      product: "P",
    }[c.data.kind];
    const code =
      "RF-" + prefix + "-" + randomBytes(6).toString("hex").toUpperCase();
    const [row] =
      await tx`INSERT INTO factory_labels(tenant_id,kind,record_id,code,created_by)VALUES(${t},${c.data.kind},${c.data.id},${code},${a.userId}) ON CONFLICT(tenant_id,kind,record_id) DO UPDATE SET record_id=EXCLUDED.record_id RETURNING *`;
    return {
      ...row,
      record: await labelRecord(a, row.kind, row.record_id, tx),
    };
  }
  if (c.action === "label.print") {
    requireWarehouseRole(a);
    for (const id of c.data.ids) {
      const [r] =
        await tx`SELECT kind,record_id FROM factory_labels WHERE tenant_id=${t} AND id=${id}`;
      if (!r) fail("Etiket bulunamadı", 404);
      await labelRecord(a, r.kind, r.record_id, tx);
    }
    await tx`UPDATE factory_labels SET print_count=print_count+1,last_printed_at=now() WHERE tenant_id=${t} AND id=ANY(${c.data.ids}::uuid[])`;
    return { ok: true };
  }
  requireWarehouseRole(a, true);
  if (c.action === "location.create") {
    const d = c.data;
    if (d.code.toUpperCase() === "UNASSIGNED")
      fail("Bu raf kodu sistem tarafından ayrılmış", 400);
    if (
      !(
        await tx`SELECT id FROM warehouses WHERE tenant_id=${t} AND id=${d.warehouseId} AND active`
      ).length
    )
      fail("Depo bulunamadı", 404);
    if (
      (
        await tx`SELECT id FROM warehouse_locations WHERE tenant_id=${t} AND warehouse_id=${d.warehouseId} AND code=${d.code.toUpperCase()}`
      ).length
    )
      fail("Bu depoda raf kodu zaten kullanılıyor");
    const [r] =
      await tx`INSERT INTO warehouse_locations(tenant_id,warehouse_id,code,name,location_type)VALUES(${t},${d.warehouseId},${d.code.toUpperCase()},${d.name},${d.type}) RETURNING *`;
    return r;
  }
  if (c.action === "count.review") {
    manager(a);
    const d = c.data;
    const [count] =
      await tx`SELECT * FROM warehouse_counts WHERE tenant_id=${t} AND id=${d.id} FOR UPDATE`;
    if (!count || count.status !== "pending")
      fail("Sayım daha önce incelendi veya bulunamadı");
    let stockId = null;
    if (d.approve) {
      const [balance] =
        await tx`SELECT * FROM warehouse_location_balances WHERE tenant_id=${t} AND item_id=${count.item_id} AND location_id=${count.location_id} FOR UPDATE`;
      if (
        !balance ||
        balance.version !== count.balance_version ||
        Number(balance.quantity) !== Number(count.expected_qty)
      )
        fail("Sayım sonrası stok değişti. Güncel miktarla yeniden sayım yapın");
      const [item] =
        await tx`SELECT * FROM inventory_items WHERE tenant_id=${t} AND id=${count.item_id}`;
      const [loc] =
        await tx`SELECT l.*,w.warehouse_type FROM warehouse_locations l JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND l.id=${count.location_id}`;
      const delta = Number(count.counted_qty) - Number(count.expected_qty);
      if (delta !== 0) {
        if (
          !["RAW", "REUSABLE_REMNANTS"].includes(loc.warehouse_type) ||
          item.item_type === "finished_good" ||
          (
            await tx`SELECT id FROM stock_lots WHERE tenant_id=${t} AND item_id=${item.id} AND warehouse_id=${loc.warehouse_id} LIMIT 1`
          ).length
        )
          fail(
            "Fiziksel lot veya mamul farkını miktar yazarak düzeltmeyin. Lot/üretim kaydını inceleyip yeniden sayın",
          );
        const entry = await postWarehouseEntry(tx, a, {
          entryType: "STOCK_RECONCILIATION",
          idempotencyKey: "warehouse:" + key,
          referenceType: "warehouse_count",
          referenceId: count.id,
          note: count.reason + " · " + d.note,
          lines: [
            {
              itemId: item.id,
              warehouseId: loc.warehouse_id,
              quantityDelta: delta,
              uom: item.stock_uom,
              metadata: { locationId: loc.id, countId: count.id },
            },
          ],
        });
        stockId = entry.id;
      }
    }
    const [r] =
      await tx`UPDATE warehouse_counts SET status=${d.approve ? "approved" : "rejected"},reviewed_by=${a.userId},review_note=${d.note},stock_entry_id=${stockId},reviewed_at=now() WHERE tenant_id=${t} AND id=${count.id} RETURNING *`;
    return r;
  }
  const d = c.data;
  const locId = c.action === "transfer" ? c.data.sourceId : c.data.locationId;
  const [item] =
    await tx`SELECT * FROM inventory_items WHERE tenant_id=${t} AND id=${d.itemId} AND active`;
  const [loc] =
    await tx`SELECT l.*,w.warehouse_type FROM warehouse_locations l JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND l.id=${locId} AND l.active AND w.active`;
  if (!item || !loc) fail("Malzeme veya raf bulunamadı", 404);
  try {
    assertQuantityPrecision(d.quantity, item.stock_uom);
  } catch (e) {
    fail((e as Error).message, 400);
  }
  const [balance] =
    await tx`SELECT * FROM warehouse_location_balances WHERE tenant_id=${t} AND item_id=${item.id} AND location_id=${loc.id} FOR UPDATE`;
  if (!balance || balance.version !== d.version)
    fail("Raf stoğu değişti. Güncel kaydı okuyup tekrar deneyin");
  if (c.action === "count.submit") {
    const [row] =
      await tx`INSERT INTO warehouse_counts(tenant_id,item_id,location_id,expected_qty,counted_qty,balance_version,reason,counted_by)VALUES(${t},${item.id},${loc.id},${balance.quantity},${d.quantity},${balance.version},${c.data.reason},${a.userId}) RETURNING *`;
    return row;
  }
  const transfer = c.data;
  const [target] =
    await tx`SELECT l.*,w.warehouse_type FROM warehouse_locations l JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND l.id=${transfer.targetId} AND l.active AND w.active`;
  if (!target) fail("Hedef raf bulunamadı", 404);
  if (
    !["RAW", "REUSABLE_REMNANTS"].includes(loc.warehouse_type) ||
    loc.warehouse_type !== target.warehouse_type ||
    item.item_type === "finished_good"
  )
    fail(
      "Üretim, karantina ve sevkiyat hareketlerini ilgili iş emrinden yapın",
    );
  if (Number(balance.quantity) < transfer.quantity)
    fail("Kaynak rafta yeterli stok yok");
  let lot: any = null;
  let destinationLot: any = null;
  if (transfer.lotId) {
    [lot] =
      await tx`SELECT * FROM stock_lots WHERE tenant_id=${t} AND id=${transfer.lotId} AND item_id=${item.id} AND warehouse_id=${loc.warehouse_id} FOR UPDATE`;
    if (
      !lot ||
      (lot.location_id ||
        (loc.location_type === "unassigned" ? loc.id : null)) !== loc.id ||
      lot.status !== "available"
    )
      fail("Lot kaynak rafta değil veya rezerve edilmiş");
    if (Number(lot.remaining_qty) < transfer.quantity) fail("Lot miktarı yetersiz");
    if (Number(lot.remaining_qty) !== transfer.quantity) {
      if (item.stock_uom === "m") fail("Fiziksel lotu tam boyuyla taşıyın; parçalama kesim ekranından yapılır");
      const metadata={...lot.metadata,parentLotId:lot.id,batchLotNumber:lot.metadata.batchLotNumber || lot.lot_number,splitCommandId:key};
      [destinationLot]=await tx`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,location_id,lot_number,original_qty,remaining_qty,metadata)VALUES(${t},${item.id},${target.warehouse_id},${target.id},${lot.lot_number+"-S-"+randomUUID().slice(0,8)},${transfer.quantity},${transfer.quantity},${JSON.stringify(metadata)}::text::jsonb) RETURNING *`;
      await tx`UPDATE stock_lots SET remaining_qty=remaining_qty-${transfer.quantity},updated_at=now() WHERE tenant_id=${t} AND id=${lot.id}`;
    }

  } else if (
    (
      await tx`SELECT id FROM stock_lots WHERE tenant_id=${t} AND item_id=${item.id} AND warehouse_id=${loc.warehouse_id} LIMIT 1`
    ).length
  )
    fail("Bu malzemede fiziksel lot etiketini seçin");
  const entry = await postWarehouseEntry(
    tx,
    a,
    {
      entryType: "MATERIAL_TRANSFER",
      idempotencyKey: "warehouse:" + key,
      referenceType: "warehouse_transfer",
      note: transfer.note,
      lines: [
        {
          itemId: item.id,
          warehouseId: loc.warehouse_id,
          lotId: lot?.id,
          quantityDelta: -transfer.quantity,
          uom: item.stock_uom,
          metadata: { locationId: loc.id, targetLocationId: target.id },
        },
        {
          itemId: item.id,
          warehouseId: target.warehouse_id,
          lotId: destinationLot?.id || lot?.id,
          quantityDelta: transfer.quantity,
          uom: item.stock_uom,
          metadata: { locationId: target.id, sourceLocationId: loc.id },
        },
      ],
    },
    { allowPhysicalTransfer: true },
  );
  if (lot && !destinationLot)
    await tx`UPDATE stock_lots SET warehouse_id=${target.warehouse_id},location_id=${target.id},updated_at=now() WHERE tenant_id=${t} AND id=${lot.id}`;
  return { entryId: entry.id, entryNumber: entry.entry_number };
}
