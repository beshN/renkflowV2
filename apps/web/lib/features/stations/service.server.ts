import { storeProductionFile } from "@/lib/features/manufacturing/files.service";
import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { assertCompanyHostTenant } from "@/lib/features/company/host.server";
import { WorkOrderApiError } from "@/lib/features/work-orders/security";
import { productionCommand } from "@/lib/features/manufacturing/platform.service";
import { cutView } from "@/lib/features/manufacturing/cut-view";
import { recordAudit } from "@/lib/audit/audit-log";
import { readFile } from "@/lib/storage";
import { STATION_LABELS } from "./contract";
import {
  stationActor,
  stationHash,
  assertStationOperation,
  type StationDevice,
} from "./security.server";
import { stationChecks, StationCheckInputSchema } from "./checklists.server";
export async function pairStation(req: NextRequest, raw: unknown) {
  const { code } = z
    .object({
      code: z
        .string()
        .trim()
        .toLowerCase()
        .regex(
          /^[a-f0-9]{32}$/,
          "Yöneticiden aldığınız eşleştirme kodunu girin.",
        ),
    })
    .parse(raw);
  return sql.begin(async (tx: any) => {
    const [d] =
      await tx`SELECT s.* FROM station_devices s JOIN tenant_members m ON m.tenant_id=s.tenant_id AND m.user_id=s.created_by WHERE s.pairing_hash=${stationHash(code)} AND s.pairing_expires_at>now() AND s.revoked_at IS NULL AND m.role IN('owner','admin') AND (to_jsonb(m)->>'deactivated_at') IS NULL FOR UPDATE OF s`;
    if (!d)
      throw new WorkOrderApiError(
        "Eşleştirme kodu geçersiz, kullanılmış veya süresi dolmuş.",
        401,
      );
    await assertCompanyHostTenant(
      d.tenant_id,
      req.headers.get("host") || req.nextUrl.host,
    );
    const secret = randomBytes(32).toString("hex"),
      expires = new Date(Date.now() + 90 * 24 * 60 * 60_000);
    await tx`UPDATE station_devices SET token_hash=${stationHash(secret)},pairing_hash=NULL,pairing_expires_at=NULL,expires_at=${expires},last_seen_at=now(),version=version+1 WHERE id=${d.id} AND tenant_id=${d.tenant_id}`;
    await recordAudit(tx, {
      tenantId: d.tenant_id,
      actorId: d.created_by,
      entityType: "station_device",
      entityId: d.id,
      action: "station_paired",
      metadata: { deviceName: d.name },
    });
    return { secret, expires };
  });
}
function configuration(raw: any) {
  const c = raw ?? {};
  const numeric = (value: unknown) =>
    Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
  return {
    family: typeof c.family === "string" ? c.family : "pergola",
    widthMm: numeric(c.widthMm),
    projectionMm: numeric(c.projectionMm),
    heightMm: numeric(c.heightMm),
    mountingHeightMm: numeric(c.mountingHeightMm),
    bodyName: typeof c.bodyName === "string" ? c.bodyName.slice(0, 120) : null,
    motor: Boolean(c.motor),
    led: Boolean(c.led),
  };
}
export async function stationOverview(device: StationDevice, query = "") {
  const q = z.string().trim().max(120).parse(query),
    t = device.tenant_id;
  const info = {
    id: device.id,
    name: device.name,
    kind: device.kind,
    label: STATION_LABELS[device.kind],
    workCenterCode: device.work_center_code,
    warehouseId: device.warehouse_id,
  };
  if (device.kind === "warehouse") {
    const balances =
      await sql`SELECT i.id,i.sku,i.name,i.stock_uom,l.code AS location_code,l.name AS location_name,b.quantity FROM warehouse_location_balances b JOIN inventory_items i ON i.id=b.item_id AND i.tenant_id=b.tenant_id JOIN warehouse_locations l ON l.id=b.location_id AND l.tenant_id=b.tenant_id WHERE b.tenant_id=${t} AND l.warehouse_id=${device.warehouse_id} AND i.active AND l.active AND (${q}='' OR i.name ILIKE ${"%" + q + "%"} OR i.sku ILIKE ${"%" + q + "%"} OR l.code ILIKE ${"%" + q + "%"}) ORDER BY i.name,l.code LIMIT 200`;
    const moves =
      await sql`SELECT m.id,m.quantity_delta,m.created_at,i.name,i.sku,i.stock_uom,l.code AS location_code,e.entry_type FROM warehouse_location_moves m JOIN warehouse_locations l ON l.id=m.location_id AND l.tenant_id=m.tenant_id JOIN stock_entry_lines s ON s.id=m.stock_entry_line_id AND s.tenant_id=m.tenant_id JOIN stock_entries e ON e.id=s.stock_entry_id AND e.tenant_id=m.tenant_id JOIN inventory_items i ON i.id=s.item_id AND i.tenant_id=m.tenant_id WHERE m.tenant_id=${t} AND l.warehouse_id=${device.warehouse_id} AND (${q}='' OR i.name ILIKE ${"%" + q + "%"} OR i.sku ILIKE ${"%" + q + "%"} OR l.code ILIKE ${"%" + q + "%"}) ORDER BY m.id DESC LIMIT 50`;
    return {
      device: info,
      balances,
      moves,
      operations: [],
      instructions: [],
      files: [],
      cutPlans: [],
    };
  }
  const rows =
    await sql`SELECT p.id,p.work_order_id,p.name,p.position,p.status,p.version,p.attempt,p.planned_qty,p.completed_qty,p.quality_checks,w.configuration,w.description,w.order_id,COALESCE(o.order_number,'İE-' || left(w.id::text,8)) AS order_number,COALESCE(oi.product_name,fi.name) AS product_name FROM production_operations p JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id LEFT JOIN orders o ON o.id=w.order_id AND o.tenant_id=w.tenant_id LEFT JOIN order_items oi ON oi.id=w.order_item_id AND oi.order_id=o.id LEFT JOIN inventory_items fi ON fi.id=w.production_item_id AND fi.tenant_id=w.tenant_id WHERE p.tenant_id=${t} AND p.work_center_code=${device.work_center_code} AND w.status NOT IN('cancelled','done') AND p.status NOT IN('done','cancelled') AND (${q}='' OR o.order_number ILIKE ${"%" + q + "%"} OR COALESCE(oi.product_name,fi.name) ILIKE ${"%" + q + "%"}) ORDER BY CASE p.status WHEN 'running' THEN 0 WHEN 'ready' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,w.due_at NULLS LAST,p.created_at LIMIT 100`;
  const operations = await Promise.all(
    rows.map(async (r: any) => ({
      id: r.id,
      workOrderId: r.work_order_id,
      name: r.name,
      status: r.status,
      version: r.version,
      plannedQty: Number(r.planned_qty),
      completedQty: Number(r.completed_qty),
      orderNumber: r.order_number,
      productName: r.product_name,
      configuration: configuration(r.configuration),
      qualityChecks: r.quality_checks,
      checklist: await stationChecks(sql, device, r),
    })),
  );
  const jobIds = rows.map((r: any) => r.work_order_id);
  const files =
    await sql`SELECT id,name,mime,work_order_id FROM production_files WHERE tenant_id=${t} AND work_order_id=ANY(${jobIds}::uuid[]) ORDER BY created_at DESC LIMIT 150`;
  const instructions =
    await sql`SELECT d.id,d.title,d.content,d.version,r.file_name,r.mime FROM knowledge_documents d JOIN knowledge_revisions r ON r.document_id=d.id AND r.tenant_id=d.tenant_id AND r.version=d.version WHERE d.tenant_id=${t} AND d.id=ANY(${device.instruction_ids}::uuid[]) AND d.visibility='company' AND NOT d.archived ORDER BY d.title`;
  const plans =
    device.kind === "cutting"
      ? await sql`SELECT id,status,result FROM cutting_plans WHERE tenant_id=${t} AND work_order_ids && ${jobIds}::uuid[] AND status IN('approved','completed') ORDER BY created_at DESC LIMIT 20`
      : [];
  return {
    device: info,
    operations,
    files,
    instructions,
    cutPlans: plans.map((p: any) => cutView(p, new Set<string>(jobIds))),
    balances: [],
    moves: [],
  };
}
export async function stationOperate(device: StationDevice, raw: unknown) {
  const c = z
    .object({
      commandId: z.string().uuid(),
      data: z.record(z.string(), z.unknown()),
    })
    .parse(raw);
  const r = await productionCommand(stationActor(device), {
    commandId: c.commandId,
    action: "operation",
    data: c.data,
  });
  return {
    ok: true,
    status: r.status,
    version: r.version,
    qualityRejected: Boolean(r.qualityRejected),
  };
}
export async function saveStationCheck(device: StationDevice, raw: unknown) {
  const d = StationCheckInputSchema.parse(raw),
    a = stationActor(device);
  return sql.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${device.tenant_id},0))`;
    await assertStationOperation(tx, a, "operation", {
      operationId: d.operationId,
      version: d.operationVersion,
      action: "pause",
    });
    const [op] =
      await tx`SELECT * FROM production_operations WHERE tenant_id=${device.tenant_id} AND id=${d.operationId} FOR UPDATE`;
    if (
      !op ||
      op.version !== d.operationVersion ||
      ["done", "cancelled", "waiting"].includes(op.status)
    )
      throw new WorkOrderApiError("İşin durumu değişti. Yenileyin.", 409);
    const checks = await stationChecks(tx, device, op),
      check = checks.find((c) => c.key === d.key);
    if (!check) throw new WorkOrderApiError("Kontrol maddesi bulunamadı.", 404);
    if (check.checked === d.checked) return check;
    if (check.version !== d.version)
      throw new WorkOrderApiError(
        "Kontrol başka tablette değişti. Yenileyin.",
        409,
      );
    const [r] =
      await tx`INSERT INTO station_checklist_checks(tenant_id,operation_id,check_key,checked,device_id) VALUES(${device.tenant_id},${d.operationId},${d.key},${d.checked},${device.id}) ON CONFLICT(tenant_id,operation_id,check_key) DO UPDATE SET checked=EXCLUDED.checked,device_id=EXCLUDED.device_id,version=station_checklist_checks.version+1,updated_at=now() RETURNING checked,version`;
    await recordAudit(tx, {
      tenantId: device.tenant_id,
      actorId: device.created_by,
      entityType: "production_operation",
      entityId: op.id,
      action: "station_check_changed",
      metadata: { deviceId: device.id, key: d.key, checked: d.checked },
    });
    return r;
  });
}
export async function stationFile(
  device: StationDevice,
  kind: "production" | "knowledge",
  id: string,
) {
  z.string().uuid().parse(id);
  let f: any;
  if (kind === "production") {
    [f] =
      await sql`SELECT f.* FROM production_files f WHERE f.tenant_id=${device.tenant_id} AND f.id=${id} AND EXISTS(SELECT 1 FROM production_operations p JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id WHERE p.tenant_id=f.tenant_id AND p.work_order_id=f.work_order_id AND p.work_center_code=${device.work_center_code} AND w.status NOT IN('cancelled','done'))`;
  } else {
    [f] =
      await sql`SELECT r.file_path,r.file_name AS name,r.mime FROM knowledge_documents d JOIN knowledge_revisions r ON r.tenant_id=d.tenant_id AND r.document_id=d.id AND r.version=d.version WHERE d.tenant_id=${device.tenant_id} AND d.id=${id} AND d.id=ANY(${device.instruction_ids}::uuid[]) AND d.visibility='company' AND NOT d.archived`;
  }
  if (device.kind === "warehouse" || !f || !f.mime || (!f.file_path && !f.body))
    throw new WorkOrderApiError("Dosya bu istasyona açık değil.", 404);
  const body = f.file_path
    ? (await readFile(f.file_path)).body
    : new Uint8Array(f.body);
  return { body, mime: f.mime as string, name: f.name as string };
}

export async function stationPhoto(device: StationDevice, raw: unknown) {
  const d = z
      .object({
        operationId: z.string().uuid(),
        version: z.number().int().positive(),
        name: z.string().min(1).max(180),
        base64: z.string().min(1).max(3_000_000),
      })
      .parse(raw),
    a = stationActor(device);
  await assertStationOperation(sql, a, "operation", {
    operationId: d.operationId,
    version: d.version,
    action: "note",
    reason: "Fotoğraf yüklendi",
  });
  const [op] =
    await sql`SELECT work_order_id,version FROM production_operations WHERE tenant_id=${device.tenant_id} AND id=${d.operationId} AND work_center_code=${device.work_center_code}`;
  if (!op || op.version !== d.version)
    throw new WorkOrderApiError("İşin durumu değişti. Yenileyin.", 409);
  return storeProductionFile(a, {
    name: d.name,
    mime: "image/jpeg",
    base64: d.base64,
    workOrderId: op.work_order_id,
  });
}
