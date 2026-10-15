import "server-only";
import { z } from "zod";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
export const FinishedDecision = z
  .object({
    workOrderId: z.uuid(),
    revision: z.number().int().positive(),
    quantity: z.number().int().positive(),
    disposition: z.enum(["keep_stock", "scrap", "disassemble"]),
    photos: z.array(z.string().max(500)).min(1).max(6),
    reuseAccessories: z.boolean().default(false),
  })
  .strict();
const fail = (message: string): never => {
  throw new WorkOrderApiError(message, 409);
};
/** All units of one completed run stay together: the old engine did not assign parts to serials. */
export async function resolveFinishedProducts(
  tx: any,
  a: WorkOrderActor,
  jobs: any[],
  parts: any[],
  decisions: z.infer<typeof FinishedDecision>[],
  revisionId: string,
) {
  const finished = jobs.filter((j) => Number(j.produced_qty) > 0),
    lines: any[] = [],
    results: any[] = [],
    recovered = new Map<string, number>(),
    disassembled = new Set<string>();
  if (
    decisions.length !== finished.length ||
    new Set(decisions.map((d) => d.workOrderId)).size !== finished.length ||
    decisions.some((d) => !finished.some((j) => j.id === d.workOrderId))
  )
    fail("Tamamlanmış her üretim listesi için fiziksel ürün kararı gerekli.");
  for (const job of finished) {
    const d = decisions.find((d) => d.workOrderId === job.id)!;
    if (d.revision !== job.revision || d.quantity !== Number(job.produced_qty))
      fail(
        "Tamamlanmış ürün miktarı veya sürümü değişti; güncel dosyayı açın.",
      );
    if (
      (
        await tx`SELECT 1 FROM production_shipments WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id} LIMIT 1`
      ).length
    )
      fail(
        "Araca yüklenen veya teslim edilen ürün revizyonda stoğa döndürülemez; önce iade işlemi gerekli.",
      );
    const units =
      await tx`SELECT id FROM production_units WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id} FOR UPDATE`;
    if (units.length !== d.quantity)
      fail("Tamamlanmış ürünlerin seri kayıtları miktarla uyuşmuyor.");
    const [balance] =
      await tx`SELECT on_hand_qty FROM stock_balances WHERE tenant_id=${a.tenantId} AND item_id=${job.production_item_id} AND warehouse_id=${job.target_warehouse_id} FOR UPDATE`;
    const required = finished
      .filter(
        (j) =>
          j.production_item_id === job.production_item_id &&
          j.target_warehouse_id === job.target_warehouse_id,
      )
      .reduce((n, j) => n + Number(j.produced_qty), 0);
    if (Number(balance?.on_hand_qty || 0) < required)
      fail(
        "Karar verilecek tamamlanmış ürünlerin fiziksel stok miktarı yetersiz.",
      );
    for (const path of d.photos) {
      const prefix = `/api/v1/production/files/${a.tenantId}/`,
        id = path.slice(prefix.length);
      if (
        !path.startsWith(prefix) ||
        !z.uuid().safeParse(id).success ||
        !(
          await tx`SELECT id FROM production_files WHERE tenant_id=${a.tenantId} AND id=${id} AND work_order_id=${job.id} AND mime LIKE 'image/%'`
        ).length
      )
        fail("Ürün kararı fotoğrafı ilgili üretim listesine ait olmalı.");
    }
    const materials =
      await tx`SELECT * FROM work_order_materials WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id}`;
    if (d.disposition !== "keep_stock")
      lines.push({
        itemId: job.production_item_id,
        warehouseId: job.target_warehouse_id,
        quantityDelta: -d.quantity,
        uom: job.production_uom,
        metadata: {
          technicalRevisionId: revisionId,
          workOrderId: job.id,
          disposition: d.disposition,
        },
      });
    if (d.disposition === "disassemble") {
      disassembled.add(job.id);
      for (const m of materials) {
        const qty = Number(m.consumed_qty);
        if (!qty) continue;
        if (m.uom === "m") {
          const actual = parts
            .filter(
              (p) =>
                p.work_order_id === job.id &&
                p.item_id === m.item_id &&
                p.state === "assembled",
            )
            .reduce((n, p) => n + Number(p.length_mm) / 1000, 0);
          if (Math.abs(actual - qty) > 0.000001)
            fail(
              "Sökülen ürünün fiziksel profil kayıtları tüketimle uyuşmuyor.",
            );
        } else if (!d.reuseAccessories) continue;
        recovered.set(m.id, qty);
        lines.push({
          itemId: m.item_id,
          warehouseId: job.wip_warehouse_id,
          quantityDelta: qty,
          uom: m.uom,
          metadata: {
            technicalRevisionId: revisionId,
            workOrderId: job.id,
            disassembled: true,
          },
        });
      }
    }
    if (d.disposition === "scrap")
      await tx`UPDATE production_parts SET state='scrapped',updated_by=${a.userId} WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id} AND state='assembled'`;
    results.push({
      ...d,
      unitIds: units.map((u: any) => u.id),
      warehouseId: job.target_warehouse_id,
      itemId: job.production_item_id,
      consumedMaterials: materials.map((m: any) => ({
        itemId: m.item_id,
        quantity: Number(m.consumed_qty),
        uom: m.uom,
        recovered: recovered.get(m.id) || 0,
      })),
    });
  }
  return { lines, results, recovered, disassembled };
}
