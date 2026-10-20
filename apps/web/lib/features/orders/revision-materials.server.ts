import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { recordAudit } from "@/lib/audit/audit-log";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { postStockEntryInTransaction } from "../manufacturing/inventory.service";
import { stableJson } from "../products/configuration";
import { needTechnical } from "./technical.server";
import {
  FinishedDecision,
  resolveFinishedProducts,
} from "./finished-revision.server";
import { releaseRevisionCutPlans } from "./shared-cut-revision.server";

const Input = z
  .object({
    commandId: z.uuid(),
    revisionId: z.uuid(),
    reason: z.string().trim().min(5).max(1000),
    decisions: z
      .array(
        z
          .object({
            partId: z.uuid(),
            disposition: z.enum(["reuse", "scrap"]),
            actualLengthMm: z.number().positive().finite().optional(),
          })
          .strict(),
      )
      .max(20000),
    finishedProducts: z.array(FinishedDecision).max(1000).default([]),
    sharedPlans: z
      .array(
        z
          .object({ planId: z.uuid(), version: z.number().int().positive() })
          .strict(),
      )
      .max(1000)
      .default([]),
  })
  .strict();
const fail = (message: string): never => {
  throw new WorkOrderApiError(message, 409);
};

/** A critical decision, separate from daily entries. Never reverse an actual cut or delete history. */
export async function resolveRevisionMaterials(
  a: WorkOrderActor,
  orderId: string,
  raw: unknown,
) {
  await needTechnical(a, true, true);
  z.uuid().parse(orderId);
  const d = Input.parse(raw);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [prior] =
      await tx`SELECT * FROM technical_material_decisions WHERE tenant_id=${a.tenantId} AND command_id=${d.commandId}`;
    if (prior) {
      if (
        prior.approved_by !== a.userId ||
        stableJson(prior.input) !== stableJson({ ...d, orderId })
      )
        fail("İşlem anahtarı farklı içerikte kullanıldı");
      return { ...prior.result, replayed: true };
    }
    const [r] =
      await tx`SELECT * FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${orderId} AND id=${d.revisionId} FOR UPDATE`;
    if (
      !r ||
      r.status !== "draft" ||
      !r.replaces_id ||
      r.impact?.keepsCuts ||
      r.impact?.materialsResolved
    )
      fail("Malzeme kararı bekleyen kontrollü revizyon bulunamadı");
    const [latest] =
      await tx`SELECT id FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${orderId} ORDER BY revision DESC LIMIT 1`;
    if (latest?.id !== r.id) fail("Teknik sürüm değişti; güncel dosyayı açın");
    const jobs =
      await tx`SELECT * FROM work_orders WHERE tenant_id=${a.tenantId} AND order_id=${orderId} AND status<>'cancelled' FOR UPDATE`;
    if (!jobs.length) fail("Revize edilecek üretim listesi bulunamadı");
    const ids = jobs.map((j: any) => j.id);
    const parts =
      await tx`SELECT p.*,l.metadata AS source_metadata FROM production_parts p JOIN stock_lots l ON l.id=p.source_lot_id AND l.tenant_id=p.tenant_id WHERE p.tenant_id=${a.tenantId} AND p.work_order_id=ANY(${ids}::uuid[]) FOR UPDATE OF p`;
    if (parts.some((p: any) => p.state === "paint_sent"))
      fail(
        "Boyadaki parçalar geri gelmeden veya tamamlanmış ürünler çözülmeden malzeme kararı uygulanamaz",
      );
    const finished = await resolveFinishedProducts(
      tx,
      a,
      jobs,
      parts,
      d.finishedProducts,
      r.id,
    );
    const physical = parts.filter(
      (p: any) =>
        ["cut", "paint_waiting", "paint_returned"].includes(p.state) ||
        (p.state === "assembled" && finished.disassembled.has(p.work_order_id)),
    );
    if (
      d.decisions.length !== physical.length ||
      new Set(d.decisions.map((x) => x.partId)).size !== physical.length ||
      d.decisions.some((x) => !physical.some((p: any) => p.id === x.partId))
    )
      fail("Her kesilmiş parça için yeniden kullanım veya hurda kararı seçin");
    const [warehouse] =
      await tx`SELECT id FROM warehouses WHERE tenant_id=${a.tenantId} AND active AND warehouse_type='REUSABLE_REMNANTS' ORDER BY code LIMIT 1`;
    if (physical.length && !warehouse)
      fail("Kullanılabilir artık deposu gerekli");
    const lines: any[] = [...finished.lines],
      returned: any[] = [],
      scrapped: any[] = [];
    for (const p of physical) {
      const decision = d.decisions.find((x) => x.partId === p.id)!,
        job = jobs.find((j: any) => j.id === p.work_order_id)!;
      const qty = Number(p.length_mm) / 1000,
        meta = {
          technicalRevisionId: r.id,
          partId: p.id,
          decision: decision.disposition,
        };
      lines.push({
        itemId: p.item_id,
        warehouseId: job.wip_warehouse_id,
        quantityDelta: -qty,
        uom: "m",
        metadata: meta,
      });
      const weight =
        p.weight_per_meter_kg == null
          ? null
          : qty * Number(p.weight_per_meter_kg);
      const cost =
        p.source_metadata?.unitCost == null
          ? null
          : qty * Number(p.source_metadata.unitCost);
      if (decision.disposition === "reuse") {
        if (p.state === "assembled" && decision.actualLengthMm === undefined)
          fail(
            "Sökülen her profilin kullanılabilir gerçek boyunu ölçüp kaydedin",
          );
        const returnedLength = decision.actualLengthMm ?? Number(p.length_mm);
        if (returnedLength > Number(p.length_mm))
          fail("Kullanılabilir parça boyu kesilmiş boyu aşamaz");
        const returnedQty = returnedLength / 1000;
        const color = p.paint_returned_at
          ? p.target_color
          : p.source_metadata?.color;
        if (!color)
          fail("Yeniden kullanılacak parçanın fiziksel rengi doğrulanmalı");
        const [lot] =
          await tx`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,length_m,weight_kg,metadata) VALUES(${a.tenantId},${p.item_id},${warehouse.id},${"REV-" + randomUUID().slice(0, 12)},${returnedQty},${returnedQty},${returnedQty},${p.weight_per_meter_kg == null ? null : returnedQty * Number(p.weight_per_meter_kg)},${JSON.stringify({ ...p.source_metadata, color, isRemnant: true, revisionPartId: p.id, technicalRevisionId: r.id })}::text::jsonb) RETURNING id`;
        lines.push({
          itemId: p.item_id,
          warehouseId: warehouse.id,
          lotId: lot.id,
          quantityDelta: returnedQty,
          uom: "m",
          metadata: meta,
        });
        returned.push({
          partId: p.id,
          lotId: lot.id,
          lengthMm: returnedLength,
          color,
          weightKg:
            p.weight_per_meter_kg == null
              ? null
              : returnedQty * Number(p.weight_per_meter_kg),
          cost:
            p.source_metadata?.unitCost == null
              ? null
              : returnedQty * Number(p.source_metadata.unitCost),
        });
        if (returnedLength < Number(p.length_mm))
          scrapped.push({
            partId: p.id,
            lengthMm: Number(p.length_mm) - returnedLength,
            weightKg:
              p.weight_per_meter_kg == null
                ? null
                : (qty - returnedQty) * Number(p.weight_per_meter_kg),
            cost:
              p.source_metadata?.unitCost == null
                ? null
                : (qty - returnedQty) * Number(p.source_metadata.unitCost),
          });
      } else
        scrapped.push({
          partId: p.id,
          lengthMm: Number(p.length_mm),
          weightKg: weight,
          cost,
        });
      await tx`UPDATE production_parts SET state=${decision.disposition === "reuse" ? "returned_to_stock" : "scrapped"},updated_by=${a.userId} WHERE tenant_id=${a.tenantId} AND id=${p.id}`;
    }
    // Any transferred accessories remain physical stock too. Return only the unconsumed quantities.
    const materials =
      await tx`SELECT m.*,i.stock_uom FROM work_order_materials m JOIN inventory_items i ON i.id=m.item_id AND i.tenant_id=m.tenant_id WHERE m.tenant_id=${a.tenantId} AND m.work_order_id=ANY(${ids}::uuid[])`;
    for (const m of materials) {
      const accounted = physical
        .filter(
          (p: any) =>
            p.work_order_id === m.work_order_id && p.item_id === m.item_id,
        )
        .reduce((sum: number, p: any) => sum + Number(p.length_mm) / 1000, 0);
      const qty =
        Number(m.transferred_qty) -
        Number(m.consumed_qty) +
        (finished.recovered.get(m.id) || 0) -
        accounted;
      if (qty < -0.000001) fail("Kesilmiş parça ve WIP miktarları uyuşmuyor");
      if (qty <= 0.000001) continue;
      if (m.stock_uom === "m")
        fail(
          "Parça kaydı olmayan fiziksel WIP profili teknik kontrolden geçmeli",
        );
      const job = jobs.find((j: any) => j.id === m.work_order_id)!;
      lines.push(
        {
          itemId: m.item_id,
          warehouseId: job.wip_warehouse_id,
          quantityDelta: -qty,
          uom: m.uom,
          metadata: { technicalRevisionId: r.id, returnedAccessory: true },
        },
        {
          itemId: m.item_id,
          warehouseId: m.source_warehouse_id,
          quantityDelta: qty,
          uom: m.uom,
          metadata: { technicalRevisionId: r.id, returnedAccessory: true },
        },
      );
    }
    const entries: string[] = [];
    // The stock service validates balances and units. Batches stay in this same transaction.
    for (let i = 0; i < lines.length; i += 400) {
      const entry = await postStockEntryInTransaction(tx, a, {
        entryType: "MATERIAL_TRANSFER",
        referenceType: "technical_revision",
        referenceId: r.id,
        idempotencyKey: "revision:" + d.commandId + ":" + i,
        lines: lines.slice(i, i + 400),
      });
      entries.push(entry.id);
    }
    const sharedSuccessors = await releaseRevisionCutPlans(
      tx,
      a,
      ids,
      d.sharedPlans,
      r.id,
    );
    await tx`UPDATE stock_reservation_lines SET released_qty=reserved_qty-consumed_qty WHERE tenant_id=${a.tenantId} AND reservation_id IN(SELECT id FROM stock_reservations WHERE tenant_id=${a.tenantId} AND work_order_id=ANY(${ids}::uuid[]) AND status='active')`;
    await tx`UPDATE stock_reservations SET status='released',updated_at=now() WHERE tenant_id=${a.tenantId} AND work_order_id=ANY(${ids}::uuid[]) AND status='active'`;
    await tx`UPDATE work_orders SET status='cancelled',updated_at=now(),revision=revision+1 WHERE tenant_id=${a.tenantId} AND id=ANY(${ids}::uuid[])`;
    await tx`UPDATE production_operations SET status='cancelled',active_since=NULL,version=version+1,updated_at=now() WHERE tenant_id=${a.tenantId} AND work_order_id=ANY(${ids}::uuid[]) AND status<>'done'`;
    await tx`UPDATE order_technical_revisions SET status='superseded' WHERE tenant_id=${a.tenantId} AND id=${r.replaces_id}`;
    await tx`UPDATE order_technical_revisions SET impact=impact||${JSON.stringify({ materialsResolved: true })}::text::jsonb WHERE tenant_id=${a.tenantId} AND id=${r.id}`;
    const result = {
      returned,
      scrapped,
      stockEntryIds: entries,
      previousJobs: ids,
      requiresReplan: true,
      finishedProducts: finished.results,
      sharedSuccessors,
    };
    await tx`INSERT INTO technical_material_decisions(tenant_id,technical_revision_id,command_id,input,result,approved_by) VALUES(${a.tenantId},${r.id},${d.commandId},${JSON.stringify({ ...d, orderId })}::text::jsonb,${JSON.stringify(result)}::text::jsonb,${a.userId})`;
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "order",
      entityId: orderId,
      action: "revision_materials_resolved",
      note: d.reason,
      metadata: { technicalRevisionId: r.id, ...result },
    });
    return result;
  });
}
