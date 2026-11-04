import "server-only";
import { sql } from "@/lib/db";
import { cutPlanSheet } from "@/lib/features/manufacturing/platform.service";
import { labelRecord } from "@/lib/features/warehouse/service";
import { requireCap } from "@/lib/features/field/common.server";
import { hidesAny } from "@/lib/security/field-access.server";
import { WorkOrderApiError, type WorkOrderActor } from "@/lib/features/work-orders/security";
import { generateZpl, type ZplLabel } from "./zpl";
export type DownloadKind = "cut" | "job" | "shipment" | "location";

export async function downloadLabels(actor: WorkOrderActor, kind: DownloadKind, id: string): Promise<string> {
  if (!["owner", "admin", "office"].includes(actor.role)) throw new WorkOrderApiError("Etiket indirme yetkiniz yok", 403);
  await requireCap(actor, kind === "location" ? "inventory" : "production", "view", "ZPL indirme");
  const t = actor.tenantId;
  const labels: ZplLabel[] = [];
  if (kind === "location") {
    const record = await labelRecord(actor, "location", id);
    const [existing] = await sql`SELECT code FROM factory_labels WHERE tenant_id=${t} AND kind='location' AND record_id=${id}`;
    labels.push({ kind, locationCode: record.title, code: existing?.code ?? id });
  } else if (kind === "shipment") {
    if (await hidesAny(["customer_contact"])) throw new WorkOrderApiError("Müşteri alanını indirme yetkiniz yok", 403);
    const [record] = await sql`SELECT o.customer_name,o.order_number,w.title,w.production_uom,s.quantity FROM production_shipments s JOIN orders o ON o.id=s.order_id AND o.tenant_id=s.tenant_id JOIN work_orders w ON w.id=s.work_order_id AND w.tenant_id=s.tenant_id WHERE s.tenant_id=${t} AND s.id=${id}`;
    if (!record) throw new WorkOrderApiError("Sevkiyat bulunamadı", 404);
    labels.push({ kind, customer: record.customer_name ?? "", orderNumber: record.order_number ?? "", packageNumber: "", packageTotal: "", summary: `${record.title ?? ""} · ${record.quantity} ${record.production_uom ?? ""}` });
  } else {
    let planId = id;
    if (kind === "job") {
      const [job] = await sql`SELECT cut_plan_id FROM work_orders WHERE tenant_id=${t} AND id=${id}`;
      if (!job?.cut_plan_id) throw new WorkOrderApiError("İş emrinin kesim planı bulunamadı", 404);
      planId = job.cut_plan_id;
    }
    const sheet = await cutPlanSheet(actor, planId);
    if (!["approved", "completed"].includes(sheet.status)) throw new WorkOrderApiError("Önce kesim planını onaylayın", 409);
    for (const bar of sheet.bars) for (const piece of bar.pieces) {
      if (kind === "job" && piece.job?.id !== id) continue;
      labels.push({ kind: "cut", orderNumber: piece.job?.orderNumber ?? "", profileCode: bar.item?.profileCode ?? "", lengthMm: piece.lengthMm, quantity: 1, workOrder: piece.job?.id ?? "", code: piece.job?.id ?? planId, notice: sheet.notice ? "Ölçüleri kesmeden önce doğrulayın" : undefined });
    }
  }
  if (!labels.length) throw new WorkOrderApiError("Etiketlenecek kayıt bulunamadı", 404);
  if (labels.length > 2000) throw new WorkOrderApiError("Bir indirmede en fazla 2000 etiket", 422);
  try { return labels.map((label) => generateZpl(label)).join("\n"); }
  catch { throw new WorkOrderApiError("Etiket verisi boyuta sığmıyor veya geçersiz; kaydı kontrol edin", 422); }
}
