import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import {
  WorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import {
  RecipeSchema,
  calculateRecipe,
  validateRecipeExamples,
} from "./recipe-engine";
import {
  CuttingParametersSchema,
  optimizeCuts,
  planPurchase,
  CutDemand,
} from "./cutting-engine";
import { CUTTING_DEFAULTS, cuttingEstimateNotice, firmCuttingParameters, type CuttingParameterSource } from "./cutting-defaults";
import { COUNT_UNITS, normalizeStates, PROCESSED_STATES, STOCK_UNITS, unitLabel } from "../inventory/vocabulary";
import { schedulingSnapshot, scheduleSnapshot } from "./planning.service";
import {allocateMaterialLots,qualityContext} from "./traceability.service";
import {executeQuality,qualityAnalytics} from "./quality.service";
import { productionAnalytics } from "./analytics.service";
import {
  CenterSchema, ResourceSchema,
  OperationCommandSchema,
  transitionOperation,
} from "./platform-contract";
import { postStockEntryInTransaction } from "./inventory.service";
import { AwningConfigurationSchema } from "../awning/configuration";
import { columnExists } from "@/lib/db/schema-guard";
import { PRODUCTION_LEAD_ROLES, productionLead } from "../settings/production-settings.service";
import type { ProductConfiguration } from "../products/configuration";
import { evaluateQuality, QualityChecksSchema } from "./quality";
import { executeWarehouse } from "../warehouse/service";
import { executeFinance } from "../finance/workspace.service";
import { executeProcurement } from "./purchasing.service";
import { recordAudit, UUID_PATTERN } from "@/lib/audit/audit-log";
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(180);
const num = (v: unknown) => Number(v || 0);
function fail(message: string, status = 409): never {
  throw new WorkOrderApiError(message, status);
}
function office(a: WorkOrderActor) {
  if (!["owner", "admin", "office"].includes(a.role))
    fail("Yönetim yetkisi gerekli", 403);
}
function manager(a: WorkOrderActor) {
  if (!["owner", "admin"].includes(a.role))
    fail("Yönetici yetkisi gerekli", 403);
}
const js = (v: unknown) => JSON.stringify(v);
let standardLengthColumn: { ok: boolean; at: number } | null = null;
/**
 * True once 030_cutting_defaults.sql is applied (migrations run at release, not on deploy). A
 * missing column is re-checked every five minutes so an applied migration is noticed without a restart.
 */
async function hasStandardLengthColumn(db: any) {
  if (standardLengthColumn && (standardLengthColumn.ok || Date.now() - standardLengthColumn.at < 300_000)) return standardLengthColumn.ok;
  const [row] = await db`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='manufacturing_preferences' AND column_name='standard_length_mm') AS ok`;
  standardLengthColumn = { ok: Boolean(row?.ok), at: Date.now() };
  return standardLengthColumn.ok;
}
export function recipe(row: any) {
  return RecipeSchema.parse({
    code: row.code,
    name: row.name,
    version: row.version,
    finishedItemId: row.finished_item_id,
    rules: row.rules,
    operations: row.operations,
    limits: row.limits,
    examples: row.examples,
    parameterDefinitions:row.parameter_definitions || [], constraints:row.constraints || [], editRevision:row.edit_revision,
  });
}
export async function productionOverview(actor: WorkOrderActor) {
  const t = actor.tenantId,
    worker = actor.role === "worker";
  if (!["owner", "admin", "office", "worker"].includes(actor.role))
    fail("Üretim erişimi yok", 403);
  const jobs =
    await sql`SELECT w.*,o.order_number,${worker ? sql`NULL::text` : sql`o.customer_name`} AS customer_name FROM work_orders w JOIN orders o ON o.id=w.order_id AND o.tenant_id=w.tenant_id WHERE w.tenant_id=${t} AND w.recipe_id IS NOT NULL AND (${!worker} OR w.assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.work_order_id=w.id AND p.tenant_id=${t} AND p.assigned_to=${actor.userId})) ORDER BY w.created_at DESC LIMIT 300`;
  const ids = jobs.map((j: any) => j.id);
  const operations =
    await sql`SELECT p.*,u.name AS operator_name FROM production_operations p LEFT JOIN users u ON u.id=p.assigned_to WHERE p.tenant_id=${t} AND p.work_order_id=ANY(${ids}::uuid[]) ORDER BY p.work_order_id,p.position`;
  const events =
    await sql`SELECT e.*,u.name AS actor_name FROM production_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.tenant_id=${t} AND e.work_order_id=ANY(${ids}::uuid[]) ORDER BY e.id DESC LIMIT 300`;
  const rework =
    await sql`SELECT * FROM production_rework WHERE tenant_id=${t} AND work_order_id=ANY(${ids}::uuid[]) ORDER BY created_at DESC LIMIT 200`;
  const qualityInspections = await sql`SELECT q.*,u.name AS inspector_name FROM quality_inspections q LEFT JOIN users u ON u.id=q.inspector_id WHERE q.tenant_id=${t} AND q.work_order_id=ANY(${ids}::uuid[]) ORDER BY q.created_at DESC LIMIT 300`;
  const units =
    await sql`SELECT * FROM production_units WHERE tenant_id=${t} AND work_order_id=ANY(${ids}::uuid[]) ORDER BY serial`;
  const materialCards =
    await sql`SELECT id,name,stock_uom FROM inventory_items WHERE tenant_id=${t} AND active=true AND item_type<>'finished_good'`;
  const base = {
    actor,
    jobs,
    operations,
    events,
    rework: worker
      ? rework.map(({ profile_cost: _cost,cost_snapshot:_snapshot, ...row }: any) => row)
      : rework,
    units,
    qualityInspections,
    materialCards,
  };
  if (worker) return base;
  const [
    recipes,
    items,
    warehouses,
    lots,
    balances,
    centers,
    plans,
    schedules,
    resources,
    orders,
    members,
    preferences,
    notifications,
    drafts,
    tracking,
    shipments,
    losses,
    stockEntries,
    notificationAttempts,
    inboundMessages,
    standardLengthEditable,
  ] = await Promise.all([
    sql`SELECT * FROM production_recipes WHERE tenant_id=${t} ORDER BY code,version DESC`,
    sql`SELECT * FROM inventory_items WHERE tenant_id=${t} AND active=true ORDER BY name`,
    sql`SELECT * FROM warehouses WHERE tenant_id=${t} AND active=true ORDER BY code`,
    sql`SELECT l.*,i.name,i.sku,w.warehouse_type FROM stock_lots l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.tenant_id=${t} ORDER BY l.created_at DESC LIMIT 1000`,
    sql`SELECT * FROM stock_balances WHERE tenant_id=${t}`,
    sql`SELECT * FROM work_centers WHERE tenant_id=${t} AND active=true ORDER BY code`,
    sql`SELECT * FROM cutting_plans WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT * FROM production_schedules WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 30`,
    sql`SELECT * FROM production_resources WHERE tenant_id=${t} AND active=true ORDER BY code`,
    sql`SELECT oi.*,o.order_number,o.customer_name,o.delivery_date FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.tenant_id=${t} AND o.status NOT IN('cancelled','delivered','completed') ORDER BY o.created_at DESC LIMIT 500`,
    sql`SELECT u.id,u.name,u.email,m.role FROM tenant_members m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=${t}`,
    sql`SELECT * FROM manufacturing_preferences WHERE tenant_id=${t}`,
    sql`SELECT * FROM notification_outbox WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT * FROM intake_drafts WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT id,order_id,expires_at,revoked_at FROM customer_tracking_links WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT * FROM production_shipments WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT * FROM cutting_losses WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 300`,
    sql`SELECT * FROM stock_entries WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT a.* FROM notification_attempts a JOIN notification_outbox n ON n.id=a.notification_id WHERE n.tenant_id=${t} ORDER BY a.created_at DESC LIMIT 200`,
    sql`SELECT id,provider,status,draft_id,attempts,last_error,created_at FROM inbound_messages WHERE tenant_id=${t} ORDER BY created_at DESC LIMIT 100`,
    hasStandardLengthColumn(sql),
  ]);
  return {
    ...base,
    analytics:await productionAnalytics(actor).catch(()=>({unavailable:true})),
    qualityAnalytics:await qualityAnalytics(actor),
    recipes,
    items,
    warehouses,
    lots,
    balances,
    centers,
    plans,
    schedules,
    resources,
    orders,
    members,
    preferences: preferences[0] || null,
    cutting: {
      ...firmCuttingParameters(preferences[0]),
      defaults: CUTTING_DEFAULTS,
      standardLengthEditable,
    },
    notifications,
    drafts,
    tracking,
    shipments,
    losses,
    stockEntries,
    notificationAttempts,
    inboundMessages,
    providers: {
      ai: !!process.env.OPENAI_API_KEY,
      email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      whatsapp: !!(
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_API_VERSION
      ),
    },
  };
}
async function event(
  tx: any,
  a: WorkOrderActor,
  kind: string,
  payload: unknown,
  workOrderId?: string,
  operationId?: string,
) {
  await tx`INSERT INTO production_events(tenant_id,work_order_id,operation_id,event_type,payload,actor_id)VALUES(${a.tenantId},${workOrderId || null},${operationId || null},${kind},${js(payload)}::text::jsonb,${a.userId})`;
}
export async function enqueueOrderNotice(
  tx: any,
  a: WorkOrderActor,
  orderId: string,
  status: string,
  key: string,
) {
  const [order] =
    await tx`SELECT * FROM orders WHERE tenant_id=${a.tenantId} AND id=${orderId}`;
  const [prefs] =
    await tx`SELECT * FROM manufacturing_preferences WHERE tenant_id=${a.tenantId}`;
  if (!order || !prefs) return;
  for (const channel of ["email", "whatsapp"]) {
    const recipient = channel === "email" ? order.email : order.phone;
    if (!recipient || !prefs[`${channel}_enabled`]) continue;
    await tx`INSERT INTO notification_outbox(tenant_id,order_id,event_key,channel,recipient,payload)VALUES(${a.tenantId},${orderId},${key},${channel},${recipient},${js({ orderNumber: order.order_number, customerName: order.customer_name, status, template: prefs.whatsapp_template })}::text::jsonb)ON CONFLICT DO NOTHING`;
  }
}
export async function productionCommand(a: WorkOrderActor, raw: unknown) {
  const command = z
    .object({
      commandId: z.string().uuid(),
      action: z.string().min(1).max(60),
      data: z.record(z.string(), z.unknown()),
    })
    .parse(raw);
  const hash = createHash("sha256").update(js(command)).digest("hex");
  return sql.begin(async (tx: any) => {
    // One pilot tenant's stock and operation commands are serialized, including first insertion.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [old] =
      await tx`SELECT * FROM production_commands WHERE tenant_id=${a.tenantId} AND command_id=${command.commandId}`;
    if (old) {
      if (old.actor_id !== a.userId || old.request_hash !== hash)
        fail("Komut anahtarı başka bir işlemde kullanılmış");
      return old.result;
    }
    const result = await execute(
      tx,
      a,
      command.action,
      command.data,
      command.commandId,
    );
    await tx`INSERT INTO production_commands(tenant_id,command_id,actor_id,request_hash,result)VALUES(${a.tenantId},${command.commandId},${a.userId},${hash},${js(result || { ok: true })}::text::jsonb)`;
    await event(tx, a, command.action, { commandId: command.commandId });
    // Money movements also go to the firm audit trail; a replayed command returned above without a second record.
    if (command.action.startsWith("finance.")) await recordFinanceAudit(tx, a, command, result);
    return result || { ok: true };
  });
}
const FINANCE_AUDIT_ENTITY: Record<string, string> = { payment: "payment", employee: "employee", ledger: "employee_ledger_entry" };
const FINANCE_AUDIT_FIELDS = ["id", "orderId", "employeeId", "amount", "currency", "method", "paidAt", "kind", "entryDate", "fullName", "active"];

/** finance.payment.create → payment / payment.create: the same vocabulary as AuditLogService. */
async function recordFinanceAudit(tx: any, a: WorkOrderActor, command: { action: string; commandId: string; data: Record<string, unknown> }, result: unknown) {
  const action = command.action.slice("finance.".length);
  const id = (result as { id?: unknown } | undefined)?.id;
  const details: Record<string, unknown> = {};
  for (const key of FINANCE_AUDIT_FIELDS) {
    const value = command.data[key];
    if (["string", "number", "boolean"].includes(typeof value)) details[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  await recordAudit(tx, {
    tenantId: a.tenantId,
    actorId: a.userId,
    entityType: FINANCE_AUDIT_ENTITY[action.split(".")[0]] || "finance",
    entityId: typeof id === "string" && UUID_PATTERN.test(id) ? id : a.tenantId,
    action,
    metadata: { ...details, commandId: command.commandId },
  });
}
async function execute(
  tx: any,
  a: WorkOrderActor,
  action: string,
  data: Record<string, unknown>,
  key: string,
): Promise<any> {
  const t = a.tenantId;
  if (action.startsWith("warehouse.") && action !== "warehouse.save") return executeWarehouse(tx,a,action,data,key);
  if (action.startsWith("finance.")) return executeFinance(tx,a,action,data);
  if (action.startsWith("procurement.")) return executeProcurement(tx, a, action, data, key);
  if(action.startsWith("quality.") || action==="rework.resolve")return executeQuality(tx,a,action,data);
  if (action === "operation") return operation(tx, a, data, key);
  if (action === "operation.assign") {
    office(a);
    const d = z
      .object({
        operationId: uuid,
        version: z.number().int().positive(),
        assignedTo: uuid,
        machineId:uuid.nullable().optional(),teamId:uuid.nullable().optional(),
      })
      .parse(data);
    const [op] =
      await tx`SELECT * FROM production_operations WHERE tenant_id=${t} AND id=${d.operationId} FOR UPDATE`;
    if (
      !op ||
      op.version !== d.version ||
      ["running", "done", "cancelled"].includes(op.status)
    )
      fail("Operasyon değişti veya ataması değiştirilemez");
    if (
      !(
        await tx`SELECT 1 FROM tenant_members WHERE tenant_id=${t} AND user_id=${d.assignedTo} AND role IN('owner','admin','office','worker')`
      ).length
    )
      fail("Çalışan firmaya ait değil", 400);
    const machineId=d.machineId === undefined ? op.machine_id : d.machineId,teamId=d.teamId === undefined ? op.team_id : d.teamId;
    for(const [id,kind] of [[machineId,"machine"],[teamId,"team"]])if(id){
      const [resource]=await tx`SELECT * FROM production_resources WHERE tenant_id=${t} AND id=${id} AND kind=${kind} AND active=true`;
      if(!resource)fail("Atanacak kaynak bu firmada bulunamadı",400);
      if(resource.work_center_codes.length && !resource.work_center_codes.includes(op.work_center_code))fail("Kaynak bu iş merkezine uygun değil",400);
      if(kind==="team" && !resource.member_ids.includes(d.assignedTo))fail("Çalışan seçilen ekipte değil",400);
    }
    await tx`UPDATE production_operations SET assigned_to=${d.assignedTo},machine_id=${machineId},team_id=${teamId},version=version+1,updated_at=now()WHERE tenant_id=${t} AND id=${op.id}`;
    await event(
      tx,
      a,
      "operation.assigned",
      { assignedTo: d.assignedTo },
      op.work_order_id,
      op.id,
    );
    return { ok: true };
  }

  office(a);
  if (action === "material.save") {
    manager(a);
    const d = z
      .object({
        sku: text,
        name: text,
        itemType: z.enum(["raw_material", "finished_good", "consumable"]),
        uom: z.enum(STOCK_UNITS),
        standardLengthMm: z.number().nonnegative().default(0),
        weightPerMeterKg: z.number().nonnegative().default(0),
        minStock: z.number().nonnegative().finite().max(1000000).default(0),
        // Identity: profile code + size + processed states (+ piece length for counted pieces).
        profileCode: z.string().trim().max(40).optional().transform((v) => v || null),
        sizeLabel: z.string().trim().max(40).optional().transform((v) => v || null),
        processedStates: z.array(z.enum(PROCESSED_STATES)).max(5).default([]),
        pieceLengthMm: z.number().int().positive().max(30000).nullish(),
      })
      .parse(data);
    if (d.uom === "m" && (!d.standardLengthMm || !d.weightPerMeterKg))
      fail("Profilin boyunu ve kg/m bilgisini doğrulayın", 400);
    if (COUNT_UNITS.has(d.uom) && !Number.isInteger(d.minStock))
      fail(`Minimum stok ${unitLabel(d.uom)} biriminde tam sayı olmalı`, 400);
    if (d.uom === "m" && d.pieceLengthMm)
      fail("Metre ile tutulan profilde boy her çubukta girilir, kartta değil", 400);
    const states = normalizeStates(d.processedStates);
    if (d.profileCode) {
      const [same] = await tx`SELECT sku FROM inventory_items WHERE tenant_id=${t} AND lower(profile_code)=lower(${d.profileCode}) AND lower(coalesce(size_label,''))=lower(${d.sizeLabel ?? ""}) AND processed_states=${states}::text[] AND coalesce(piece_length_mm,0)=${d.pieceLengthMm ?? 0}`;
      if (same) fail(`Bu kod, ölçü ve işlem hâli zaten kayıtlı (${same.sku})`, 409);
    }
    try {
      const [row] =
        await tx`INSERT INTO inventory_items(tenant_id,sku,name,unit,item_type,stock_uom,standard_length_m,weight_per_meter_kg,min_stock,profile_code,size_label,processed_states,piece_length_mm)VALUES(${t},${d.sku},${d.name},${d.uom},${d.itemType},${d.uom},${d.standardLengthMm / 1000},${d.weightPerMeterKg},${d.minStock},${d.profileCode},${d.sizeLabel},${states}::text[],${d.pieceLengthMm ?? null}) RETURNING *`;
      return row;
    } catch (error) {
      // Two saves of the same item at once: the second meets the unique index, not a server error.
      const pg = error as { code?: string; constraint_name?: string };
      if (pg.code === "23505")
        fail(pg.constraint_name === "inventory_items_identity_idx" ? "Bu kod, ölçü ve işlem hâli zaten kayıtlı" : "Bu stok kodu zaten kayıtlı", 409);
      throw error;
    }
  }
  if (action === "warehouse.save") {
    manager(a);
    const d = z
      .object({
        code: text,
        name: text,
        type: z.enum(["RAW", "WIP", "FINISHED", "REUSABLE_REMNANTS", "SCRAP", "REJECTED"]),
      })
      .parse(data);
    return (
      await tx`INSERT INTO warehouses(tenant_id,code,name,warehouse_type)VALUES(${t},${d.code},${d.name},${d.type})RETURNING *`
    )[0];
  }
  if (action === "center.save" || action === "resource.save") {
    manager(a);
    const resource=action==='resource.save', d=resource ? ResourceSchema.parse(data) : CenterSchema.parse(data);
    const [existing]=resource ? await tx`SELECT * FROM production_resources WHERE tenant_id=${t} AND code=${d.code}` : await tx`SELECT * FROM work_centers WHERE tenant_id=${t} AND code=${d.code}`;
    if(existing){
      const [running]=resource ? await tx`SELECT COUNT(*)AS n FROM production_operations WHERE tenant_id=${t} AND status='running' AND (machine_id=${existing.id} OR team_id=${existing.id} OR (${existing.kind==='employee'} AND assigned_to=${existing.user_id || null}))` : await tx`SELECT COUNT(*)AS n FROM production_operations WHERE tenant_id=${t} AND status='running' AND work_center_code=${d.code}`;
      if(num(running.n)>d.parallelCapacity)fail("Kapasite çalışan iş sayısının altına indirilemez");
    }
    if(existing && existing.revision !== (d.revision || 1))fail("Kapasite kaydı değişti; güncel kaydı açın");
    if(resource){
      const r=ResourceSchema.parse(data);
      const users=[...r.memberIds,...(r.userId?[r.userId]:[])];
      const members=await tx`SELECT user_id FROM tenant_members WHERE tenant_id=${t} AND user_id=ANY(${users}::uuid[]) AND role IN('owner','admin','office','worker')`;
      if(users.some(id=>!members.some((m:any)=>m.user_id===id)))fail("Kaynak çalışanları firmaya ait olmalı",400);
      const codes=await tx`SELECT code FROM work_centers WHERE tenant_id=${t} AND active=true AND code=ANY(${r.workCenterCodes}::text[])`;
      if(r.workCenterCodes.some(code=>!codes.some((c:any)=>c.code===code)))fail("Kaynak iş merkezi firmaya ait değil",400);
      if(existing && (existing.kind!==r.kind || existing.user_id!==(r.userId || null)))fail("Kaynak türü ve çalışan kimliği değiştirilemez; yeni kaynak oluşturun");
      return (await tx`INSERT INTO production_resources(tenant_id,code,name,kind,parallel_capacity,shift_start,shift_end,work_days,maintenance,user_id,member_ids,work_center_codes)VALUES(${t},${r.code},${r.name},${r.kind},${r.parallelCapacity},${r.shiftStart},${r.shiftEnd},${r.workDays},${js(r.maintenance)}::text::jsonb,${r.userId || null},${r.memberIds},${r.workCenterCodes})ON CONFLICT(tenant_id,code)DO UPDATE SET name=EXCLUDED.name,parallel_capacity=EXCLUDED.parallel_capacity,shift_start=EXCLUDED.shift_start,shift_end=EXCLUDED.shift_end,work_days=EXCLUDED.work_days,maintenance=EXCLUDED.maintenance,member_ids=EXCLUDED.member_ids,work_center_codes=EXCLUDED.work_center_codes,revision=production_resources.revision+1 RETURNING *`)[0];
    }
    return (await tx`INSERT INTO work_centers(tenant_id,code,name,parallel_capacity,shift_start,shift_end,work_days,maintenance,machine_required,team_required)VALUES(${t},${d.code},${d.name},${d.parallelCapacity},${d.shiftStart},${d.shiftEnd},${d.workDays},${js(d.maintenance)}::text::jsonb,${d.machineRequired},${d.teamRequired})ON CONFLICT(tenant_id,code)DO UPDATE SET name=EXCLUDED.name,parallel_capacity=EXCLUDED.parallel_capacity,shift_start=EXCLUDED.shift_start,shift_end=EXCLUDED.shift_end,work_days=EXCLUDED.work_days,maintenance=EXCLUDED.maintenance,machine_required=EXCLUDED.machine_required,team_required=EXCLUDED.team_required,revision=work_centers.revision+1 RETURNING *`)[0];
  }
  if(action==='job.material-ready'){
    manager(a);const d=z.object({id:uuid,revision:z.number().int().positive(),readyAt:z.string().datetime().nullable()}).parse(data);
    const [row]=await tx`UPDATE work_orders SET material_ready_at=${d.readyAt},revision=revision+1 WHERE tenant_id=${t} AND id=${d.id} AND revision=${d.revision} AND recipe_id IS NOT NULL AND status NOT IN('done','cancelled') RETURNING *`;
    if(!row)fail("Üretim emri değişti; güncel kaydı açın");return row;
  }
  if (action === "preferences.save") {
    manager(a);
    const d = CuttingParametersSchema.extend({
      // Ticked only when someone checked the values on the machine for this save. Unticked, the values
      // are kept and plans made with them are marked as estimates.
      cuttingConfirmed: z.boolean(),
      // Left out: the stored length stays as it is.
      standardLengthMm: z.number().int().min(1000).max(30000).optional(),
      emailEnabled: z.boolean(),
      whatsappEnabled: z.boolean(),
      whatsappTemplate: z.string().max(100).optional(),
    }).parse(data);
    if (d.whatsappEnabled && !d.whatsappTemplate)
      fail("Onaylı WhatsApp şablon adı gerekli", 400);
    // Saving other settings does not undo an earlier confirmation, as long as the cutting values
    // themselves are unchanged; changed values need a new tick.
    const [previous] = await tx`SELECT * FROM manufacturing_preferences WHERE tenant_id=${t} FOR UPDATE`;
    const columnReady = await hasStandardLengthColumn(tx);
    const unchanged =
      previous?.cutting_confirmed === true &&
      num(previous.kerf_mm) === d.kerfMm &&
      num(previous.trim_start_mm) === d.trimStartMm &&
      num(previous.trim_end_mm) === d.trimEndMm &&
      num(previous.minimum_remnant_mm) === d.minimumRemnantMm &&
      (d.standardLengthMm === undefined || !columnReady || num(previous.standard_length_mm) === d.standardLengthMm);
    const confirmed = d.cuttingConfirmed || unchanged;
    const [saved] =
      await tx`INSERT INTO manufacturing_preferences(tenant_id,kerf_mm,trim_start_mm,trim_end_mm,minimum_remnant_mm,cutting_confirmed,email_enabled,whatsapp_enabled,whatsapp_template)VALUES(${t},${d.kerfMm},${d.trimStartMm},${d.trimEndMm},${d.minimumRemnantMm},${confirmed},${d.emailEnabled},${d.whatsappEnabled},${d.whatsappTemplate || null})ON CONFLICT(tenant_id)DO UPDATE SET kerf_mm=EXCLUDED.kerf_mm,trim_start_mm=EXCLUDED.trim_start_mm,trim_end_mm=EXCLUDED.trim_end_mm,minimum_remnant_mm=EXCLUDED.minimum_remnant_mm,cutting_confirmed=EXCLUDED.cutting_confirmed,email_enabled=EXCLUDED.email_enabled,whatsapp_enabled=EXCLUDED.whatsapp_enabled,whatsapp_template=EXCLUDED.whatsapp_template RETURNING *`;
    // The standard bar length is stored once migration 030 is applied; until then the default is used.
    if (columnReady && d.standardLengthMm !== undefined)
      return (await tx`UPDATE manufacturing_preferences SET standard_length_mm=${d.standardLengthMm} WHERE tenant_id=${t} RETURNING *`)[0];
    return saved;
  }
  if (action === "stock.receive") {
    manager(a);
    const d = z
      .object({
        itemId: uuid,
        warehouseId: uuid,
        quantity: z.number().positive().finite().max(10000),
        lengthMm: z.number().nonnegative().optional(),
        color: z.string().trim().max(100).default(""),
        unitCost: z.number().nonnegative(),
        lotNumber: text,
        currency:z.enum(["TRY","EUR","USD","GBP"]).default("TRY"),
      })
      .parse(data);
    const [item] =
      await tx`SELECT * FROM inventory_items WHERE tenant_id=${t} AND id=${d.itemId} AND active=true`;
    if (!item) fail("Malzeme bulunamadı", 404);
    const lines: any[] = [];
    if (item.stock_uom === "m") {
      if (!d.lengthMm || !Number.isInteger(d.quantity))
        fail("Profilde çubuk adedi ve fiziksel boy gerekli", 400);
      // Every bar carries its colour ("Boyasız" for unpainted); the cutting engine matches on it.
      if (!d.color) fail("Profil çubuğunun rengini girin (boyasız için \"Boyasız\")", 400);
      for (let n = 0; n < d.quantity; n++) {
        const [lot] =
          await tx`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,length_m,weight_kg,metadata)VALUES(${t},${d.itemId},${d.warehouseId},${d.lotNumber + "-" + (n + 1)},${d.lengthMm / 1000},${d.lengthMm / 1000},${d.lengthMm / 1000},${(d.lengthMm / 1000) * num(item.weight_per_meter_kg)},${js({ color: d.color, unitCost: d.unitCost, currency:d.currency,isRemnant: false })}::text::jsonb)RETURNING *`;
        lines.push({
          itemId: d.itemId,
          warehouseId: d.warehouseId,
          lotId: lot.id,
          quantityDelta: d.lengthMm / 1000,
          uom: "m",
          unitCost: d.unitCost,
          metadata: { receipt: key },
        });
      }
    } else {
      if (COUNT_UNITS.has(item.stock_uom) && !Number.isInteger(d.quantity))
        fail(`${unitLabel(item.stock_uom)} biriminde tam sayı girin`, 400);
      const [lot]=await tx`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,metadata)VALUES(${t},${d.itemId},${d.warehouseId},${d.lotNumber},${d.quantity},${d.quantity},${js({unitCost:d.unitCost,currency:d.currency})}::text::jsonb)RETURNING id`;
      lines.push({
        lotId:lot.id,
        itemId: d.itemId,
        warehouseId: d.warehouseId,
        quantityDelta: d.quantity,
        uom: item.stock_uom,
        unitCost: d.unitCost,
        metadata: { receipt: key,currency:d.currency },
      });
    }
    return postStockEntryInTransaction(tx, a, {
      entryType: "MATERIAL_RECEIPT",
      idempotencyKey: key,
      lines,
    });
  }
  if (action === "stock.reverse") {
    manager(a);
    const d = z
      .object({ id: uuid, reason: z.string().trim().min(5).max(1000) })
      .parse(data);
    const [entry] =
      await tx`SELECT * FROM stock_entries WHERE tenant_id=${t} AND id=${d.id} AND status='submitted' FOR UPDATE`;
    if (!entry || entry.entry_type !== "MATERIAL_RECEIPT")
      fail(
        "Yalnız henüz tüketilmemiş malzeme girişleri bu ekrandan düzeltilebilir",
      );
    if (entry.reference_type === "goods_receipt")
      fail("Satın alma kabulünü mal kabul ekranından ters kayıtla düzeltin");
    const rows =
      await tx`SELECT * FROM stock_entry_lines WHERE tenant_id=${t} AND stock_entry_id=${entry.id}`;
    for (const line of rows)
      if (line.lot_id) {
        const [lot] =
          await tx`SELECT * FROM stock_lots WHERE tenant_id=${t} AND id=${line.lot_id} FOR UPDATE`;
        if (
          !lot ||
          lot.status !== "available" ||
          num(lot.remaining_qty) !== num(lot.original_qty)
        )
          fail("Tüketilmiş veya rezerve fiziksel lot geri alınamaz");
      }
    const result = await postStockEntryInTransaction(
      tx,
      a,
      {
        entryType: "REVERSAL",
        idempotencyKey: key,
        referenceType: "stock_entry_reversal",
        referenceId: entry.id,
        note: d.reason,
        lines: rows.map((r: any) => ({
          itemId: r.item_id,
          warehouseId: r.warehouse_id,
          lotId: r.lot_id || undefined,
          quantityDelta: -num(r.quantity_delta),
          uom: r.uom,
          unitCost: r.unit_cost == null ? undefined : num(r.unit_cost),
          metadata: { reversalOf: entry.id, reason: d.reason },
        })),
      },
      { reversalOfId: entry.id },
    );
    for (const line of rows)
      if (line.lot_id)
        await tx`UPDATE stock_lots SET remaining_qty=0,status='consumed',updated_at=now()WHERE tenant_id=${t} AND id=${line.lot_id}`;
    return result;
  }
  if (action === "recipe.save") {
    manager(a);
    const d = RecipeSchema.parse(data),
      ids = [d.finishedItemId, ...d.rules.map((r) => r.itemId)];
    const rows =
      await tx`SELECT id,stock_uom,item_type FROM inventory_items WHERE tenant_id=${t} AND active=true AND id=ANY(${ids}::uuid[])`;
    for (const id of ids)
      if (!rows.some((r: any) => r.id === id))
        fail("Reçetede başka firmaya ait veya eksik malzeme var", 400);
    if (
      rows.find((r: any) => r.id === d.finishedItemId).item_type !==
      "finished_good"
    )
      fail("Çıktı kartı mamul olmalı", 400);
    for (const rule of d.rules)
      if (rows.find((r: any) => r.id === rule.itemId).stock_uom !== rule.uom)
        fail("Reçete birimi malzeme kartıyla uyuşmuyor", 400);
    const centerCodes = d.operations.map((o) => o.workCenterCode),
      centers =
        await tx`SELECT code FROM work_centers WHERE tenant_id=${t} AND active=true AND code=ANY(${centerCodes}::text[])`;
    if (centerCodes.some((c) => !centers.some((r: any) => r.code === c)))
      fail("Operasyon için iş merkezi tanımlayın", 400);
    const [existing] =
      await tx`SELECT * FROM production_recipes WHERE tenant_id=${t} AND code=${d.code} AND version=${d.version}`;
    if (existing && existing.status !== "draft")
      fail("Yayınlanmış reçete değişmez; yeni sürüm oluşturun");
    if(existing && existing.edit_revision !== (d.editRevision || 1))fail("Reçete başka cihazda değişti; güncel sürümü açın");
    const [row] =
      await tx`INSERT INTO production_recipes(tenant_id,code,name,version,finished_item_id,rules,operations,limits,examples,parameter_definitions,constraints,created_by)VALUES(${t},${d.code},${d.name},${d.version},${d.finishedItemId},${js(d.rules)}::text::jsonb,${js(d.operations)}::text::jsonb,${js(d.limits)}::text::jsonb,${js(d.examples)}::text::jsonb,${js(d.parameterDefinitions || [])}::text::jsonb,${js(d.constraints || [])}::text::jsonb,${a.userId})ON CONFLICT(tenant_id,code,version)DO UPDATE SET name=EXCLUDED.name,finished_item_id=EXCLUDED.finished_item_id,rules=EXCLUDED.rules,operations=EXCLUDED.operations,limits=EXCLUDED.limits,examples=EXCLUDED.examples,parameter_definitions=EXCLUDED.parameter_definitions,constraints=EXCLUDED.constraints,edit_revision=production_recipes.edit_revision+1 RETURNING *`;
    return row;
  }
  if (action === "recipe.publish") {
    manager(a);
    const [row] =
      await tx`SELECT * FROM production_recipes WHERE tenant_id=${t} AND id=${uuid.parse(data.id)}`;
    if (!row) fail("Reçete bulunamadı", 404);
    if(row.edit_revision !== (data.editRevision || 1))fail("Reçete değişti; örnekleri yeniden kontrol edin");
    if(row.status !== "draft")fail("Yalnız taslak reçete yayınlanabilir");
    validateRecipeExamples(recipe(row));
    return (
      await tx`UPDATE production_recipes SET status='published',published_at=now()WHERE tenant_id=${t} AND id=${row.id} RETURNING *`
    )[0];
  }
  if (action === "job.create") return createJob(tx, a, data, key);
  if (action === "cut.preview") return previewCut(tx, a, data, key);
  if (["cut.approve", "cut.cancel", "cut.complete"].includes(action))
    return cutAction(tx, a, action, data, key);
  if (action === "schedule.preview") {
    manager(a);
    const startsAt = z.string().datetime().parse(data.startsAt);
    const inputs=await schedulingSnapshot(tx,t);
    const result=scheduleSnapshot(inputs,startsAt);
    return (
      await tx`INSERT INTO production_schedules(tenant_id,starts_at,tasks,inputs,created_by)VALUES(${t},${startsAt},${js(result)}::text::jsonb,${js(inputs)}::text::jsonb,${a.userId})RETURNING *`
    )[0];
  }
  if (action === "schedule.publish") {
    manager(a);
    const [row] =
      await tx`SELECT * FROM production_schedules WHERE tenant_id=${t} AND id=${uuid.parse(data.id)} AND status='draft'`;
    if (!row) fail("Taslak çizelge bulunamadı");
    const live=await schedulingSnapshot(tx,t);
    if(schedulingFingerprint(live)!==schedulingFingerprint(row.inputs))fail("Üretim, malzeme veya kaynak takvimi değişti; çizelgeyi yeniden hesaplayın");
    await tx`UPDATE production_schedules SET status='superseded'WHERE tenant_id=${t} AND status='published'`;
    return (
      await tx`UPDATE production_schedules SET status='published',published_at=now()WHERE id=${row.id} AND tenant_id=${t} RETURNING *`
    )[0];
  }
  if (action === "tracking.create") {
    const orderId = uuid.parse(data.orderId);
    if (
      !(await tx`SELECT id FROM orders WHERE id=${orderId} AND tenant_id=${t}`)
        .length
    )
      fail("Sipariş bulunamadı", 404);
    const token = randomBytes(32).toString("base64url"),
      hash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    const [row] =
      await tx`INSERT INTO customer_tracking_links(tenant_id,order_id,token_hash,expires_at,created_by)VALUES(${t},${orderId},${hash},${expiresAt},${a.userId})RETURNING id`;
    return { id: row.id, path: `/track/${token}`, expiresAt };
  }
  if (action === "tracking.revoke") {
    await tx`UPDATE customer_tracking_links SET revoked_at=now()WHERE tenant_id=${t} AND id=${uuid.parse(data.id)}`;
    return { ok: true };
  }
  if (action === "shipment.create") return ship(tx, a, data, key);
  if (action === "shipment.delivered") {
    const d = z
      .object({ id: uuid, version: z.number().int().positive() })
      .parse(data);
    const [shipment] =
      await tx`SELECT * FROM production_shipments WHERE tenant_id=${t} AND id=${d.id} FOR UPDATE`;
    if (
      !shipment ||
      shipment.version !== d.version ||
      shipment.status === "delivered"
    )
      fail("Sevkiyat değişti veya teslim edilmiş");
    await tx`UPDATE production_shipments SET status='delivered',version=version+1,delivered_at=now()WHERE tenant_id=${t} AND id=${shipment.id}`;
    if (shipment.erp_shipment_id)
      await tx`UPDATE shipments SET status='delivered',actual_date=CURRENT_DATE,updated_at=now()WHERE tenant_id=${t} AND id=${shipment.erp_shipment_id}`;
    const orderItems =
      await tx`SELECT oi.id,oi.quantity,COALESCE((SELECT SUM(s.quantity)FROM production_shipments s JOIN work_orders w ON w.id=s.work_order_id WHERE s.tenant_id=${t} AND w.order_item_id=oi.id AND s.status='delivered'),0)AS delivered FROM order_items oi WHERE oi.order_id=${shipment.order_id}`;
    if (
      orderItems.length &&
      orderItems.every((i: any) => num(i.delivered) >= num(i.quantity))
    ) {
      await tx`UPDATE orders SET status='completed',shipment_status='delivered',version=version+1 WHERE tenant_id=${t} AND id=${shipment.order_id}`;
      await enqueueOrderNotice(
        tx,
        a,
        shipment.order_id,
        "completed",
        "delivered:" + shipment.order_id,
      );
    }
    return { ok: true };
  }

  if (action === "inbound.retry") {
    manager(a);
    return (
      (
        await tx`UPDATE inbound_messages SET status='pending',next_attempt_at=now(),attempts=0,last_error=NULL WHERE tenant_id=${t} AND id=${uuid.parse(data.id)} AND status='failed' RETURNING id`
      )[0] || fail("Yeniden işlenecek içerik bulunamadı")
    );
  }
  if (action === "notification.retry") {
    manager(a);
    return (
      (
        await tx`UPDATE notification_outbox SET status='pending',next_attempt_at=now(),last_error=NULL WHERE tenant_id=${t} AND id=${uuid.parse(data.id)} AND status IN('failed','uncertain') RETURNING id`
      )[0] || fail("Yeniden denenecek kayıt bulunamadı")
    );
  }
  fail("Geçersiz üretim komutu", 400);
}
async function createJob(
  tx: any,
  a: WorkOrderActor,
  data: Record<string, unknown>,
  key: string,
) {
  const d = z
      .object({
        orderItemId: uuid,
        recipeId: uuid,
        sourceWarehouseId: uuid,
        wipWarehouseId: uuid,
        targetWarehouseId: uuid,
        assignedTo: uuid,
        priority: z
          .enum(["low", "medium", "high", "critical"])
          .default("medium"),
      })
      .parse(data),
    t = a.tenantId;
  const [item] =
    await tx`SELECT oi.*,o.id AS oid,o.order_number,o.delivery_date FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.tenant_id=${t} AND oi.id=${d.orderItemId} AND o.status NOT IN('cancelled','delivered','completed') FOR UPDATE OF oi`;
  const [r] =
    await tx`SELECT * FROM production_recipes WHERE tenant_id=${t} AND id=${d.recipeId} AND status='published'`;
  if (!item || !r) fail("Onaylı reçete veya sipariş kalemi bulunamadı", 404);
  // A line configured in the quote is built with the recipe, measures, options and colour it was quoted with.
  const pc = item.product_configuration as ProductConfiguration | null | undefined;
  if (pc && pc.recipeId !== r.id) fail(`Bu kalem teklifte "${pc.recipe.code}" reçetesinin ${pc.recipe.version}. sürümüyle yapılandırıldı; aynı reçeteyi seçin`, 400);
  if (
    (
      await tx`SELECT id FROM work_orders WHERE tenant_id=${t} AND order_item_id=${item.id} AND status<>'cancelled'`
    ).length
  )
    fail("Bu kalem için üretim emri zaten var");
  if (
    !(
      await tx`SELECT 1 FROM tenant_members WHERE tenant_id=${t} AND user_id=${d.assignedTo} AND role = ANY(${PRODUCTION_LEAD_ROLES}::text[])`
    ).length
  )
    fail("Çalışan firmaya ait değil", 400);
  for (const [id, type] of [
    [d.sourceWarehouseId, "RAW"],
    [d.wipWarehouseId, "WIP"],
    [d.targetWarehouseId, "FINISHED"],
  ])
    if (
      !(
        await tx`SELECT id FROM warehouses WHERE tenant_id=${t} AND id=${id} AND warehouse_type=${type} AND active=true`
      ).length
    )
      fail("Depo türlerini kontrol edin", 400);
  if (!["adet","pcs","piece","pieces","unit"].includes(String(item.quantity_unit || "adet").toLowerCase()))fail("Üretim emri için miktar birimini adet olarak doğrulayın",400);
  const c = pc
      ? { widthMm: pc.parameters.widthMm, projectionMm: pc.parameters.projectionMm, mountingHeightMm: pc.parameters.mountingHeightMm, bodyName: pc.color, motor: pc.parameters.motor ? "on" : null, led: pc.parameters.led ? "on" : "off", family: pc.family, recipeCode: pc.recipe.code }
      : item.awning_configuration ? AwningConfigurationSchema.parse(item.awning_configuration) : {widthMm:num(item.width_mm),projectionMm:num(item.projection_mm),mountingHeightMm:num(item.mounting_height_mm),bodyName:item.color || "",motor:item.motor_type,led:item.led_type || "off"},
    snapshot = (() => {
      try {
        return calculateRecipe(recipe(r), {
          widthMm: c.widthMm,
          projectionMm: c.projectionMm,
          mountingHeightMm: c.mountingHeightMm,
          quantity: num(item.quantity),
          motor: pc ? pc.parameters.motor : item.awning_configuration ? true : !!item.motor_type,
          customParameters: pc ? pc.parameters.customParameters : item.custom_parameters || {},
          led: c.led !== "off",
        });
      } catch (error) {
        // The recipe's limits and checks speak to the person; a programming error stays an error.
        if (error instanceof TypeError || error instanceof ReferenceError || error instanceof RangeError) throw error;
        return fail(error instanceof Error ? error.message : "Reçete hesaplanamadı", 400);
      }
    })();
  // A configured line is built exactly as quoted: the same cuts per product, or no work order.
  if (pc) {
    const perUnit = (cuts: Array<{ itemId: string; lengthMm: number; quantity: number }>, n: number) =>
      JSON.stringify(cuts.map((c) => [c.itemId, c.lengthMm, c.quantity / n]).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
    if (perUnit(snapshot.cuts, num(item.quantity)) !== perUnit(pc.bom.cuts, 1))
      fail("Reçetenin kesim listesi teklifteki ile aynı değil; teklifi yeniden yapılandırın", 409);
  }
  const [job] =
    await tx`INSERT INTO work_orders(tenant_id,title,category,order_id,order_item_id,recipe_id,production_item_id,planned_qty,production_uom,source_warehouse_id,wip_warehouse_id,target_warehouse_id,configuration,bom_snapshot,created_by,assigned_to,priority,due_at,manufacturing_idempotency_key)VALUES(${t},${item.order_number + " · " + item.product_name},'production',${item.oid},${item.id},${r.id},${r.finished_item_id},${num(item.quantity)},'adet',${d.sourceWarehouseId},${d.wipWarehouseId},${d.targetWarehouseId},${js(c)}::text::jsonb,${js({ ...snapshot, recipe: recipe(r), preview: item.awning_preview })}::text::jsonb,${a.userId},${d.assignedTo},${d.priority},${item.delivery_date || null},${key})RETURNING *`;
  for (const m of snapshot.materials)
    await tx`INSERT INTO work_order_materials(tenant_id,work_order_id,item_id,source_warehouse_id,required_qty,uom,snapshot)VALUES(${t},${job.id},${m.itemId},${d.sourceWarehouseId},${m.quantity},${m.uom},${js(m)}::text::jsonb)`;
  for (const op of snapshot.operations)
    await tx`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,assigned_to,planned_qty,ready_at,quality_checks,setup_minutes)VALUES(${t},${job.id},${op.position},${op.name},${op.workCenterCode},${op.plannedMinutes},${op.position === 0 ? "ready" : "waiting"},${d.assignedTo},${num(item.quantity)},${op.position === 0 ? new Date() : null},${js(op.qualityChecks || [])}::text::jsonb,${op.setupMinutes})`;
  await tx`UPDATE orders SET status='preparing_materials',version=version+1 WHERE id=${item.oid} AND tenant_id=${t}`;
  await event(tx, a, "job.created", snapshot, job.id);
  return job;
}
/**
 * When a quote becomes an order, each configured line gets its work order at once, with the
 * quoted recipe, so its cuts join the cutting pool (the cutting request). Warehouses are taken only
 * when the firm has exactly one active raw, work-in-progress and finished warehouse. The job goes
 * to the firm's default production lead, or to the person converting when none is set; a lead who
 * has left the team is not replaced by a guess. Otherwise nothing is guessed and the line is
 * reported as waiting, with the reason, for the work order to be opened in the production screen.
 */
export async function createJobsForConfiguredOrder(tx: any, a: WorkOrderActor, orderId: string) {
  const created: Array<{ id: string; orderItemId: string; title: string; assignedTo: string; assigneeRole: string }> = [];
  const pending: Array<{ orderItemId: string; productName: string; reason: string }> = [];
  if (!(await columnExists("order_items", "product_configuration"))) return { created, pending };
  const t = a.tenantId;
  const lines = await tx`SELECT oi.id, oi.product_name, oi.product_configuration FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = ${t} AND o.id = ${orderId} AND oi.product_configuration IS NOT NULL ORDER BY oi.created_at, oi.id`;
  if (!lines.length) return { created, pending };
  const waitAll = (reason: string) => {
    for (const l of lines) pending.push({ orderItemId: l.id, productName: l.product_name, reason });
    return { created, pending };
  };
  if (!a.userId || !["owner", "admin", "office"].includes(a.role)) return waitAll("Üretim emrini yönetici ya da ofis açar");
  const warehouses = await tx`SELECT id, warehouse_type FROM warehouses WHERE tenant_id = ${t} AND active = true AND warehouse_type IN ('RAW', 'WIP', 'FINISHED')`;
  const only = (type: string) => {
    const of = warehouses.filter((w: any) => w.warehouse_type === type);
    return of.length === 1 ? (of[0].id as string) : null;
  };
  const [source, wip, target] = [only("RAW"), only("WIP"), only("FINISHED")];
  if (!source || !wip || !target)
    return waitAll("Hammadde, yarı mamul ve mamul deposundan birer tane olmalı (birden fazla ya da hiç olmayan depo seçilemez); iş emrini Üretim ekranından açın");
  const lead = await productionLead(tx, t);
  const assignee = lead ?? a.userId;
  const [member] = await tx`SELECT role FROM tenant_members WHERE tenant_id = ${t} AND user_id = ${assignee} AND role = ANY(${PRODUCTION_LEAD_ROLES}::text[])`;
  if (!member) return waitAll(lead ? "Varsayılan üretim sorumlusu artık üretim ekibinde değil; Ayarlar'dan değiştirin" : "Dönüştüren kişi üretim ekibinde değil");
  // Production commands of a firm are serialised, as in productionCommand (a no-op when the caller holds it).
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t},0))`;
  for (const l of lines) {
    const pc = l.product_configuration as ProductConfiguration;
    try {
      const job = await tx.savepoint((sp: any) =>
        createJob(sp, a, { orderItemId: l.id, recipeId: pc.recipeId, sourceWarehouseId: source, wipWarehouseId: wip, targetWarehouseId: target, assignedTo: assignee }, `quote-order:${l.id}`),
      );
      created.push({ id: job.id, orderItemId: l.id, title: job.title, assignedTo: assignee, assigneeRole: member.role });
    } catch (error) {
      // The savepoint undid the line's writes; the order stands and the line waits, with the reason.
      if (error instanceof WorkOrderApiError) pending.push({ orderItemId: l.id, productName: l.product_name, reason: error.message });
      else {
        console.error("[quote conversion] work order failed", l.id, error instanceof Error ? error.message : error);
        pending.push({ orderItemId: l.id, productName: l.product_name, reason: "İş emri açılamadı (teknik hata kaydedildi); Üretim ekranından açın" });
      }
    }
  }
  return { created, pending };
}
/** Plans a pool of jobs (or rework) with the engine without saving anything. */
async function computeCut(
  tx: any,
  a: WorkOrderActor,
  data: Record<string, unknown>,
) {
  const regularIds = z
    .array(uuid)
    .max(100)
    .default([])
    .parse(data.workOrderIds);
  const reworkIds = z.array(uuid).max(100).default([]).parse(data.reworkIds);
  if (
    (!regularIds.length && !reworkIds.length) ||
    (regularIds.length && reworkIds.length)
  )
    fail("Sipariş havuzu veya rework havuzundan birini seçin", 400);
  const requests = reworkIds.length
    ? await tx`SELECT r.*,w.order_item_id,w.configuration FROM production_rework r JOIN work_orders w ON w.id=r.work_order_id AND w.tenant_id=r.tenant_id WHERE r.tenant_id=${a.tenantId} AND r.id=ANY(${reworkIds}::uuid[]) AND r.profile_status='pending' AND r.cut_plan_id IS NULL AND w.status NOT IN('done','cancelled')`
    : [];
  if (reworkIds.length && requests.length !== new Set(reworkIds).size)
    fail("Rework ihtiyacı değişti; güncel havuzu açın");
  const ids = reworkIds.length
    ? [...new Set<string>(requests.map((r: any) => r.work_order_id))]
    : regularIds;
  const jobs = reworkIds.length
    ? await tx`SELECT * FROM work_orders WHERE tenant_id=${a.tenantId} AND id=ANY(${ids}::uuid[])`
    : await tx`SELECT * FROM work_orders WHERE tenant_id=${a.tenantId} AND id=ANY(${ids}::uuid[]) AND recipe_id IS NOT NULL AND status IN('open','in_progress') AND cut_plan_id IS NULL`;
  if (jobs.length !== new Set(ids).size)
    fail("Kesim havuzunda eksik veya planlanmış iş var");
  const [prefs] =
    await tx`SELECT * FROM manufacturing_preferences WHERE tenant_id=${a.tenantId}`;
  // Until a manager confirms the workshop's values the defaults are used, and the plan says so.
  const firm = firmCuttingParameters(prefs);
  const parameters = CuttingParametersSchema.parse(firm.parameters);
  const demand: CutDemand[] = reworkIds.length
    ? requests.flatMap((r: any) =>
        r.profile_cuts.map((c: any) => ({
          ...c,
          workOrderId: r.work_order_id,
          orderItemId: r.order_item_id,
          color: r.configuration.bodyName,
        })),
      )
    : jobs.flatMap((j: any) =>
        j.bom_snapshot.cuts.map((c: any) => ({
          ...c,
          workOrderId: j.id,
          orderItemId: j.order_item_id,
          color: j.configuration.bodyName,
        })),
      );
  if (!demand.length) fail("Bu havuzda profil kesim ihtiyacı yok");
  const lots =
    await tx`SELECT l.*,w.warehouse_type FROM stock_lots l JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.tenant_id=${a.tenantId} AND l.status='available' AND l.remaining_qty>0 AND w.warehouse_type IN('RAW','REUSABLE_REMNANTS') ORDER BY l.id`;
  const result = optimizeCuts(
    demand,
    lots.map((l: any) => ({
      id: l.id,
      itemId: l.item_id,
      color: l.metadata.color || "",
      lengthMm: num(l.remaining_qty) * 1000,
      unitCost: num(l.metadata.unitCost),
      currency:l.metadata.currency || null,
      isRemnant: l.metadata.isRemnant === true,
    })),
    parameters,
  );
  // Bars to buy for what stock cannot cover, on each profile's own standard length.
  const missingItems = [...new Set(result.unfulfilled.map((p) => p.itemId))];
  const standard = new Map<string, number>(
    missingItems.length
      ? (await tx`SELECT id,standard_length_m FROM inventory_items WHERE tenant_id=${a.tenantId} AND id=ANY(${missingItems}::uuid[])`).map(
          (row: any) => [row.id, num(row.standard_length_m) * 1000],
        )
      : [],
  );
  const purchase = planPurchase(result.unfulfilled, (itemId) => standard.get(itemId) || parameters.standardLengthMm, parameters);
  return { ids, reworkIds, demand, parameters, result: { ...result, parameterSource: firm.source, purchase } };
}
async function previewCut(
  tx: any,
  a: WorkOrderActor,
  data: Record<string, unknown>,
  key: string,
) {
  const { ids, reworkIds, demand, parameters, result } = await computeCut(tx, a, data);
  return (
    await tx`INSERT INTO cutting_plans(tenant_id,work_order_ids,rework_ids,demand,parameters,result,created_by,idempotency_key)VALUES(${a.tenantId},${ids},${reworkIds},${js(demand)}::text::jsonb,${js(parameters)}::text::jsonb,${js(result)}::text::jsonb,${a.userId},${key})RETURNING *`
  )[0];
}

/**
 * Every job waiting for cutting, planned together by the engine without saving anything: what the
 * cutting suggestion proposes. Null when no job is waiting.
 */
export async function proposeCutForPool(db: any, a: WorkOrderActor) {
  manager(a);
  const pool = await db`SELECT w.id,w.title FROM work_orders w WHERE w.tenant_id=${a.tenantId} AND w.recipe_id IS NOT NULL AND w.status IN('open','in_progress') AND w.cut_plan_id IS NULL AND jsonb_typeof(w.bom_snapshot->'cuts')='array' AND jsonb_array_length(w.bom_snapshot->'cuts')>0 AND jsonb_typeof(w.configuration->'bodyName')='string' ORDER BY w.created_at,w.id LIMIT 101`;
  if (!pool.length) return null;
  let jobs: Array<{ id: string; title: string }> = pool.slice(0, 100).map((j: any) => ({ id: j.id, title: j.title }));
  let plan = await computeCut(db, a, { workOrderIds: jobs.map((j) => j.id) });
  // Jobs that stock cannot fully cover are left out once, so the rest can still be planned.
  const short = new Set(plan.result.unfulfilled.map((piece) => piece.workOrderId));
  const leftOut = jobs.filter((j) => short.has(j.id));
  if (leftOut.length && leftOut.length < jobs.length) {
    jobs = jobs.filter((j) => !short.has(j.id));
    plan = await computeCut(db, a, { workOrderIds: jobs.map((j) => j.id) });
  }
  return { jobs, leftOut, morePending: pool.length > 100, ...plan };
}

/**
 * Saves and approves (reserves the bars of) a plan for these jobs inside the caller's transaction:
 * what approving a cutting suggestion does. The same checks and the same per-firm lock as a cutting
 * command by hand apply, and the timeline records both steps. `acceptEstimate` is passed only when
 * the suggestion the person approved said it was an estimate.
 */
export async function planAndReserveCut(
  tx: any,
  a: WorkOrderActor,
  workOrderIds: string[],
  options: {
    key: string;
    acceptEstimate: boolean;
    suggestionId: string;
    /** Checks the freshly computed plan before anything is reserved; throw to refuse. */
    verify?: (draft: any) => void;
  },
) {
  manager(a);
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
  const draft = await previewCut(tx, a, { workOrderIds }, options.key);
  options.verify?.(draft);
  await event(tx, a, "cut.preview", { planId: draft.id, suggestionId: options.suggestionId });
  const approved = await cutAction(tx, a, "cut.approve", { id: draft.id, version: draft.version, acceptEstimate: options.acceptEstimate }, options.key + ":approve");
  await event(tx, a, "cut.approve", { planId: approved.id, suggestionId: options.suggestionId });
  return approved;
}
async function cutAction(
  tx: any,
  a: WorkOrderActor,
  action: string,
  data: Record<string, unknown>,
  key: string,
) {
  manager(a);
  const d = z
      .object({
        id: uuid,
        version: z.number().int().positive(),
        confirmed: z.boolean().optional(),
        // Approving a plan made with default or unconfirmed values must be said explicitly.
        acceptEstimate: z.boolean().optional(),
        actualBars: z
          .array(
            z.object({
              lotId: uuid,
              remainingMm: z.number().nonnegative().finite(),
            }),
          )
          .optional(),
      })
      .parse(data),
    t = a.tenantId;
  const [plan] =
    await tx`SELECT * FROM cutting_plans WHERE tenant_id=${t} AND id=${d.id} FOR UPDATE`;
  if (!plan) fail("Kesim planı bulunamadı", 404);
  if (plan.version !== d.version) fail("Plan değişti; güncel kaydı açın");
  const reworkPlan = plan.rework_ids.length > 0;
  if (action === "cut.cancel") {
    if (plan.status === "completed")
      fail(
        "Gerçekleşmiş kesim iptal edilemez; ters stok kaydı ve yeni plan gerekir",
      );
    await tx`UPDATE stock_lots SET status='available'WHERE tenant_id=${t} AND id IN(SELECT lot_id FROM cutting_plan_sources WHERE plan_id=${plan.id} AND tenant_id=${t} AND consumed=false)`;
    await tx`UPDATE stock_reservations SET status='released',updated_at=now()WHERE tenant_id=${t} AND idempotency_key=${"cut-plan:" + plan.id}`;
    await tx`DELETE FROM cutting_plan_sources WHERE tenant_id=${t} AND plan_id=${plan.id}`;
    await tx`UPDATE production_rework SET cut_plan_id=NULL,profile_status='pending' WHERE tenant_id=${t} AND cut_plan_id=${plan.id} AND profile_status='approved'`;
    await tx`UPDATE work_orders SET cut_plan_id=NULL WHERE tenant_id=${t} AND cut_plan_id=${plan.id}`;
    return (
      await tx`UPDATE cutting_plans SET status='cancelled',version=version+1 WHERE tenant_id=${t} AND id=${plan.id} RETURNING *`
    )[0];
  }
  if (action === "cut.approve") {
    if (plan.status !== "draft" || plan.result.unfulfilled.length)
      fail("Eksik profil olan plan onaylanamaz");
    if (cuttingEstimateNotice(plan.result.parameterSource) && !d.acceptEstimate)
      fail("Bu plan doğrulanmamış kesim değerleriyle hesaplandı; tahmini olduğunu kabul ederek onaylayın", 400);
    const jobs =
      await tx`SELECT * FROM work_orders WHERE tenant_id=${t} AND id=ANY(${plan.work_order_ids}::uuid[]) FOR UPDATE`;
    if (
      jobs.some(
        (j: any) =>
          (!reworkPlan && j.cut_plan_id) ||
          j.status === "cancelled" ||
          j.status === "done",
      )
    )
      fail("Havuzdaki iş daha önce planlandı veya kapandı");
    if (reworkPlan) {
      const requests =
        await tx`SELECT id FROM production_rework WHERE tenant_id=${t} AND id=ANY(${plan.rework_ids}::uuid[]) AND profile_status='pending' AND cut_plan_id IS NULL FOR UPDATE`;
      if (requests.length !== plan.rework_ids.length)
        fail("Rework profilleri başka plana alındı");
    }
    for (const bar of plan.result.bars) {
      const [lot] =
        await tx`SELECT * FROM stock_lots WHERE tenant_id=${t} AND id=${bar.source.id} FOR UPDATE`;
      if (
        !lot ||
        lot.status !== "available" ||
        Math.abs(num(lot.remaining_qty) * 1000 - bar.source.lengthMm) > 0.001
      )
        fail("Profil stoku değişti; planı yeniden hesaplayın");
      await tx`INSERT INTO cutting_plan_sources(tenant_id,plan_id,lot_id)VALUES(${t},${plan.id},${lot.id})`;
      await tx`UPDATE stock_lots SET status='reserved'WHERE tenant_id=${t} AND id=${lot.id}`;
    }
    const [reservation] =
      await tx`INSERT INTO stock_reservations(tenant_id,work_order_id,idempotency_key,created_by)VALUES(${t},${plan.work_order_ids[0]},${"cut-plan:" + plan.id},${a.userId})RETURNING id`;
    for (const bar of plan.result.bars) {
      const [lot] =
        await tx`SELECT * FROM stock_lots WHERE tenant_id=${t} AND id=${bar.source.id}`;
      await tx`INSERT INTO stock_reservation_lines(tenant_id,reservation_id,item_id,warehouse_id,lot_id,reserved_qty)VALUES(${t},${reservation.id},${lot.item_id},${lot.warehouse_id},${lot.id},${num(lot.remaining_qty)})`;
    }
    if (reworkPlan)
      await tx`UPDATE production_rework SET cut_plan_id=${plan.id},profile_status='approved' WHERE tenant_id=${t} AND id=ANY(${plan.rework_ids}::uuid[])`;
    else
      await tx`UPDATE work_orders SET cut_plan_id=${plan.id},revision=revision+1 WHERE tenant_id=${t} AND id=ANY(${plan.work_order_ids}::uuid[])`;
    return (
      await tx`UPDATE cutting_plans SET status='approved',version=version+1,approved_by=${a.userId},approved_at=now()WHERE tenant_id=${t} AND id=${plan.id} RETURNING *`
    )[0];
  }
  if (plan.status !== "approved" || !d.confirmed)
    fail("Gerçek kesimi planla karşılaştırıp onaylayın");
  const [remnantWarehouse] =
    await tx`SELECT id FROM warehouses WHERE tenant_id=${t} AND warehouse_type='REUSABLE_REMNANTS' AND active=true ORDER BY code LIMIT 1`;
  if (!remnantWarehouse) fail("Kullanılabilir artık deposu gerekli");
  const jobs =
    await tx`SELECT * FROM work_orders WHERE tenant_id=${t} AND id=ANY(${plan.work_order_ids}::uuid[]) FOR UPDATE`;
  const lines: any[] = [];
  const actual: any[] = [];
  if (
    d.actualBars &&
    (d.actualBars.length !== plan.result.bars.length ||
      new Set(d.actualBars.map((b) => b.lotId)).size !== d.actualBars.length)
  )
    fail("Her kaynak profilin kalan ölçüsünü girin", 400);
  for (const planned of plan.result.bars) {
    const measured =
      d.actualBars?.find((b) => b.lotId === planned.source.id)?.remainingMm ??
      planned.remainingMm;
    if (measured > planned.remainingMm + 0.001)
      fail("Ölçülen artık kesim hesabıyla uyuşmuyor");
    const reusable =
      measured >=
        num(plan.result.itemParameters?.[planned.source.itemId]?.minimumRemnantMm ?? plan.parameters.minimumRemnantMm) &&
      measured > 0;
    const bar = {
      ...planned,
      remainingMm: measured,
      reusable,
      lossMm:
        planned.source.lengthMm -
        planned.pieces.reduce((s: number, p: any) => s + p.lengthMm, 0) -
        (reusable ? measured : 0),
    };
    const [lot] =
      await tx`SELECT l.*,i.weight_per_meter_kg FROM stock_lots l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND l.id=${bar.source.id} FOR UPDATE OF l`;
    if (!lot || lot.status !== "reserved") fail("Rezerve profil bulunamadı");
    lines.push({
      itemId: lot.item_id,
      warehouseId: lot.warehouse_id,
      lotId: lot.id,
      quantityDelta: -num(lot.remaining_qty),
      uom: "m",
      unitCost: num(lot.metadata.unitCost),
      metadata: { planId: plan.id, lossMm: bar.lossMm },
    });
    const allocated = new Map<string, number>();
    for (const piece of bar.pieces)
      allocated.set(
        piece.workOrderId,
        (allocated.get(piece.workOrderId) || 0) + piece.lengthMm / 1000,
      );
    for (const [jobId, length] of allocated) {
      const job = jobs.find((j: any) => j.id === jobId);
      if (!job) fail("Kesim emri bulunamadı");
      if (reworkPlan) continue;
      lines.push({
        itemId: lot.item_id,
        warehouseId: job.wip_warehouse_id,
        quantityDelta: length,
        uom: "m",
        metadata: { planId: plan.id, workOrderId: jobId },
      });
      await tx`UPDATE work_order_materials SET transferred_qty=transferred_qty+${length},reserved_qty=reserved_qty+${length} WHERE tenant_id=${t} AND work_order_id=${jobId} AND item_id=${lot.item_id}`;
    }
    let remnantId: string | null = null;
    if (bar.reusable) {
      const [r] =
        await tx`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,length_m,weight_kg,metadata)VALUES(${t},${lot.item_id},${remnantWarehouse.id},${"ART-" + randomUUID().slice(0, 12)},${bar.remainingMm / 1000},${bar.remainingMm / 1000},${bar.remainingMm / 1000},${(bar.remainingMm / 1000) * num(lot.weight_per_meter_kg)},${js({ ...lot.metadata, isRemnant: true, parentLotId: lot.id, planId: plan.id })}::text::jsonb)RETURNING id`;
      remnantId = r.id;
      lines.push({
        itemId: lot.item_id,
        warehouseId: remnantWarehouse.id,
        lotId: r.id,
        quantityDelta: bar.remainingMm / 1000,
        uom: "m",
        metadata: { planId: plan.id, isRemnant: true },
      });
    }
    const weightKg = (bar.lossMm / 1000) * num(lot.weight_per_meter_kg),
      cost = (bar.lossMm / 1000) * num(lot.metadata.unitCost);
    await tx`INSERT INTO cutting_losses(tenant_id,plan_id,lot_id,length_mm,weight_kg,cost)VALUES(${t},${plan.id},${lot.id},${bar.lossMm},${weightKg},${cost})`;
    actual.push({
      lotId: lot.id,
      remnantId,
      lossMm: bar.lossMm,
      weightKg,
      cost,
    });
    await tx`UPDATE stock_lots SET status='consumed',remaining_qty=0,updated_at=now()WHERE tenant_id=${t} AND id=${lot.id}`;
  }
  const stock = await postStockEntryInTransaction(
    tx,
    a,
    {
      entryType: "MATERIAL_TRANSFER",
      referenceType: "cutting_plan",
      referenceId: plan.id,
      idempotencyKey: key,
      lines,
    },
    { allowReservedStock: true },
  );
  await tx`UPDATE stock_reservations SET status='consumed',updated_at=now()WHERE tenant_id=${t} AND idempotency_key=${"cut-plan:" + plan.id}`;
  await tx`UPDATE cutting_plan_sources SET consumed=true WHERE tenant_id=${t} AND plan_id=${plan.id}`;
  if (reworkPlan) {
    const requests =
      await tx`SELECT * FROM production_rework WHERE tenant_id=${t} AND id=ANY(${plan.rework_ids}::uuid[])`;
    for (const request of requests) {
      let cost = 0;
      for (const cut of request.profile_cuts) {
        const bars = plan.result.bars.filter(
          (b: any) =>
            b.source.itemId === cut.itemId &&
            b.pieces.some((p: any) => p.workOrderId === request.work_order_id),
        );
        const jobLength = bars.reduce(
          (sum: number, b: any) =>
            sum +
            b.pieces
              .filter((p: any) => p.workOrderId === request.work_order_id)
              .reduce((v: number, p: any) => v + p.lengthMm, 0),
          0,
        );
        const jobCost = bars.reduce(
          (sum: number, b: any) =>
            sum +
            b.pieces
              .filter((p: any) => p.workOrderId === request.work_order_id)
              .reduce(
                (v: number, p: any) =>
                  v + (p.lengthMm / 1000) * b.source.unitCost,
                0,
              ),
          0,
        );
        cost += jobLength
          ? ((cut.lengthMm * cut.quantity) / jobLength) * jobCost
          : 0;
      }
      await tx`UPDATE production_rework SET profile_status='completed',profile_cost=${cost} WHERE tenant_id=${t} AND id=${request.id}`;
    }
    await event(tx, a, "rework.cut.completed", {
      planId: plan.id,
      reworkIds: plan.rework_ids,
    });
  } else
    for (const job of jobs)
      await prepareMaterials(tx, a, job, key + ":" + job.id);
  return (
    await tx`UPDATE cutting_plans SET status='completed',version=version+1,completed_at=now(),actual=${js({ bars: actual, stockEntryId: stock.id })}::text::jsonb WHERE tenant_id=${t} AND id=${plan.id} RETURNING *`
  )[0];
}
async function prepareMaterials(
  tx: any,
  a: WorkOrderActor,
  job: any,
  key: string,
) {
  const materials =
    await tx`SELECT * FROM work_order_materials WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id}`;
  const profileIds = job.bom_snapshot.cuts.map((c: any) => c.itemId),
    lines: any[] = [];
  for (const m of materials) {
    const missing = num(m.required_qty) - num(m.transferred_qty);
    if (missing <= 0.000001) continue;
    if (profileIds.includes(m.item_id)) fail("Kesim malzeme dengesi eksik");
    const [card]=await tx`SELECT id,stock_uom FROM inventory_items WHERE tenant_id=${a.tenantId} AND id=${m.item_id}`;
    lines.push(...await allocateMaterialLots(tx,a,job,card,missing),{itemId:m.item_id,warehouseId:job.wip_warehouse_id,quantityDelta:missing,uom:m.uom,metadata:{workOrderId:job.id}});
  }
  if (lines.length)
    await postStockEntryInTransaction(tx, a, {
      entryType: "MATERIAL_TRANSFER",
      referenceType: "work_order",
      referenceId: job.id,
      idempotencyKey: key,
      lines,
    });
  await tx`UPDATE work_order_materials SET transferred_qty=required_qty,reserved_qty=required_qty WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id}`;
  await tx`UPDATE work_orders SET reservation_status='transferred'WHERE tenant_id=${a.tenantId} AND id=${job.id}`;
}
async function operation(
  tx: any,
  a: WorkOrderActor,
  data: Record<string, unknown>,
  key: string,
) {
  if (!["owner", "admin", "office", "worker"].includes(a.role))
    fail("Üretim işlemi yetkiniz yok", 403);
  const d = OperationCommandSchema.parse(data),
    t = a.tenantId;
  const [op] =
    await tx`SELECT * FROM production_operations WHERE tenant_id=${t} AND id=${d.operationId} FOR UPDATE`;
  if (!op) fail("Operasyon bulunamadı", 404);
  const [job] =
    await tx`SELECT * FROM work_orders WHERE tenant_id=${t} AND id=${op.work_order_id} FOR UPDATE`;
  if (a.role === "worker" && op.assigned_to !== a.userId)
    fail("Bu iş size atanmadı", 403);
  if (op.version !== d.version)
    fail("Operasyon başka cihazda değişti. Güncel kayıtla karşılaştırın.");
  if (job.status === "cancelled") fail("Üretim iptal edilmiş");
  for (const path of d.photos) {
    const fileId = path.split("/").pop();
    if (
      !path.startsWith(`/api/v1/production/files/${t}/`) ||
      !uuid.safeParse(fileId).success ||
      !(
        await tx`SELECT id FROM production_files WHERE tenant_id=${t} AND id=${fileId} AND work_order_id=${job.id}`
      ).length
    )
      fail("Fotoğraf bu işe ait değil", 400);
  }
  const state = transitionOperation(
    {
      status: op.status,
      plannedQty: num(op.planned_qty),
      completedQty: num(op.completed_qty),
      activeSeconds: num(op.active_seconds),
      activeSince: op.active_since?.toISOString() || null,
    },
    d,
    new Date(),
  );
  if (d.action === "rework") {
    const [target] =
      await tx`SELECT * FROM production_operations WHERE tenant_id=${t} AND id=${d.targetOperationId} AND work_order_id=${job.id}`;
    if (
      !target ||
      target.position > op.position ||
      d.quantity! > num(op.planned_qty)
    )
      fail("Rework hedefi veya miktarı geçersiz");
    if (d.quantity! > num(job.planned_qty) - num(job.produced_qty))
      fail("Paketlenmiş ürün için yönetici stok iadesi gerekli");
    const affected =
      await tx`SELECT * FROM production_operations WHERE tenant_id=${t} AND work_order_id=${job.id} AND position>=${target.position} ORDER BY position`;
    const context=await qualityContext(tx,a,job,op);
    const [inspection]=d.inspectionId ? await tx`SELECT id FROM quality_inspections WHERE tenant_id=${t} AND id=${d.inspectionId} AND work_order_id=${job.id} AND operation_id=${op.id} AND passed=false` : await tx`SELECT id FROM quality_inspections WHERE tenant_id=${t} AND operation_id=${op.id} AND attempt=${op.attempt} AND passed=false ORDER BY created_at DESC LIMIT 1`;
    if(d.inspectionId && !inspection)fail("Kalite hatası bu operasyona ait değil",400);
    const [preferences]=await tx`SELECT labor_cost_per_hour,labor_currency FROM manufacturing_preferences WHERE tenant_id=${t}`;
    const costSnapshot={laborRate:preferences?.labor_cost_per_hour===null || preferences?.labor_cost_per_hour===undefined?null:num(preferences.labor_cost_per_hour),laborCurrency:preferences?.labor_currency || null};
    const [row] =
      await tx`INSERT INTO production_rework(tenant_id,work_order_id,from_operation_id,target_operation_id,reason_code,reason,affected_qty,additional_materials,photos,created_by,snapshot,context,inspection_id,root_cause,cost_snapshot)VALUES(${t},${job.id},${op.id},${target.id},${d.reasonCode!},${d.reason!},${d.quantity!},${js(d.additionalMaterials)}::text::jsonb,${js(d.photos)}::text::jsonb,${a.userId},${js(affected)}::text::jsonb,${js(context)}::text::jsonb,${inspection?.id || null},${d.rootCause || null},${js(costSnapshot)}::text::jsonb)RETURNING *`;
    const lines: any[] = [],
      profileCuts: any[] = [];
    let profileScrapKg = 0;
    for (const m of d.additionalMaterials) {
      const [card] =
        await tx`SELECT * FROM inventory_items WHERE tenant_id=${t} AND id=${m.itemId}`;
      if (!card || !card.active) fail("Ek malzeme bulunamadı", 400);
      if(COUNT_UNITS.has(card.stock_uom) && (!Number.isInteger(m.quantity) || !Number.isInteger(m.scrapQty)))fail("Ek malzeme ve hurda adedi tam sayı olmalı",400);
      if (card.stock_uom === "m") {
        if (!m.cutLengthMm || !Number.isInteger(m.quantity))
          fail("Ek profil için parça boyu ve tam parça adedi gerekli", 400);
        if (!(num(card.weight_per_meter_kg) > 0))
          fail("Profil kg/metre bilgisi gerekli", 400);
        profileCuts.push({
          itemId: card.id,
          lengthMm: m.cutLengthMm,
          quantity: m.quantity,
        });
        profileScrapKg += m.scrapQty * num(card.weight_per_meter_kg);
        continue;
      }
      lines.push(...await allocateMaterialLots(tx,a,job,card,m.quantity+m.scrapQty,row.id));
    }
    if (profileCuts.length)
      await tx`UPDATE production_rework SET profile_cuts=${js(profileCuts)}::text::jsonb,profile_status='pending',profile_scrap_kg=${profileScrapKg} WHERE tenant_id=${t} AND id=${row.id}`;
    if (lines.length)
      await postStockEntryInTransaction(tx, a, {
        entryType: "MATERIAL_ISSUE",
        referenceType: "rework",
        referenceId: row.id,
        idempotencyKey: key,
        lines,
      });
    for (const old of affected) {
      await tx`UPDATE production_operations SET status=${old.id === target.id ? "ready" : "waiting"},attempt=attempt+1,version=version+1,completed_qty=${Math.max(num(job.produced_qty), num(old.completed_qty) - d.quantity!)},active_seconds=${num(old.active_seconds) + (old.active_since ? Math.max(0, (Date.now() - new Date(old.active_since).getTime()) / 1000) : 0)},planning_baseline_seconds=${num(old.active_seconds) + (old.active_since ? Math.max(0, (Date.now() - new Date(old.active_since).getTime()) / 1000) : 0)},active_since=NULL,started_at=NULL,completed_at=NULL,ready_at=${old.id === target.id ? new Date() : null},reason=${d.reason!} WHERE tenant_id=${t} AND id=${old.id}`;
    }
    await tx`UPDATE work_orders SET status='in_progress',revision=revision+1 WHERE tenant_id=${t} AND id=${job.id}`;
    await event(
      tx,
      a,
      "operation.rework",
      { ...d, previous: affected, reworkId: row.id },
      job.id,
      op.id,
    );
    return (
      await tx`SELECT * FROM production_rework WHERE tenant_id=${t} AND id=${row.id}`
    )[0];
  }
  if (d.action === "start") {
    if (
      (
        await tx`SELECT id FROM production_rework WHERE tenant_id=${t} AND work_order_id=${job.id} AND profile_status IN('pending','approved')`
      ).length
    )
      fail("Ek rework profilleri kesim onayını bekliyor");
    for(const [id,kind] of [[op.machine_id,"machine"],[op.team_id,"team"]])if(id){
      const [resource]=await tx`SELECT * FROM production_resources WHERE tenant_id=${t} AND id=${id} AND kind=${kind} AND active=true`;
      const [busy]=kind==="machine" ? await tx`SELECT COUNT(*)AS n FROM production_operations WHERE tenant_id=${t} AND machine_id=${id} AND status='running'` : await tx`SELECT COUNT(*)AS n FROM production_operations WHERE tenant_id=${t} AND team_id=${id} AND status='running'`;
      if(!resource || num(busy.n)>=resource.parallel_capacity)fail("Makine veya ekip kapasitesi dolu");
    }
    if(op.assigned_to && (await tx`SELECT 1 FROM production_operations WHERE tenant_id=${t} AND assigned_to=${op.assigned_to} AND status='running'`).length)fail("Atanan çalışan başka operasyonda çalışıyor");
    const [center] =
      await tx`SELECT parallel_capacity,machine_required,team_required FROM work_centers WHERE tenant_id=${t} AND code=${op.work_center_code} AND active=true`;
    const [running] =
      await tx`SELECT COUNT(*) AS n FROM production_operations WHERE tenant_id=${t} AND work_center_code=${op.work_center_code} AND status='running'`;
    if(center && ((center.machine_required && !op.machine_id) || (center.team_required && !op.team_id)))fail("Gerekli makine veya ekip ataması yapılmalı");
    if (!center || num(running.n) >= num(center.parallel_capacity))
      fail("İş merkezi kapasitesi dolu; çalışan işin bitmesini bekleyin");
    if (
      (
        await tx`SELECT id FROM production_operations WHERE tenant_id=${t} AND work_order_id=${job.id} AND position<${op.position} AND status<>'done'`
      ).length
    )
      fail("Önceki aşama tamamlanmadı");
    if (job.reservation_status !== "transferred") {
      if (job.bom_snapshot.cuts.length)
        fail("Onaylı kesim ve malzeme transferi tamamlanmalı");
      await prepareMaterials(tx, a, job, key + ":prepare");
    }
    await tx`UPDATE work_orders SET status='in_progress',revision=revision+1 WHERE tenant_id=${t} AND id=${job.id}`;
    await tx`UPDATE orders SET status='in_production',version=version+1 WHERE tenant_id=${t} AND id=${job.order_id}`;
    await enqueueOrderNotice(
      tx,
      a,
      job.order_id,
      "in_production",
      "production:" + job.id,
    );
  }
  if (d.action === "complete" && op.quality_checks?.length) {
    const results = evaluateQuality(QualityChecksSchema.parse(op.quality_checks), d.qualityResults, d.photos.length);
    const passed = results.every(r=>r.passed);
    await tx`INSERT INTO quality_inspections(tenant_id,work_order_id,operation_id,attempt,quantity,passed,results,photos,inspector_id,command_id,context)VALUES(${t},${job.id},${op.id},${op.attempt},${d.quantity!},${passed},${js(results)}::text::jsonb,${js(d.photos)}::text::jsonb,${a.userId},${key},${js(await qualityContext(tx,a,job,op))}::text::jsonb)`;
    if (!passed) {
      const [blocked]=await tx`UPDATE production_operations SET status='blocked',active_seconds=${state.activeSeconds},active_since=NULL,photos=${js([...op.photos,...d.photos].slice(-30))}::text::jsonb,reason=${d.reason || 'Kalite kontrol başarısız'},version=version+1,updated_at=now()WHERE tenant_id=${t} AND id=${op.id} RETURNING *`;
      await event(tx,a,'quality.failed',{quantity:d.quantity,results},job.id,op.id);
      return {...blocked,qualityRejected:true};
    }
    await event(tx,a,'quality.passed',{quantity:d.quantity,results},job.id,op.id);
  }
  const photos = [...op.photos, ...d.photos].slice(-30);
  const [updated] =
    await tx`UPDATE production_operations SET status=${state.status},completed_qty=${state.completedQty},active_seconds=${state.activeSeconds},active_since=${state.activeSince},planning_baseline_seconds=${d.action === "complete" ? state.activeSeconds : num(op.planning_baseline_seconds)},started_at=COALESCE(started_at,${d.action === "start" ? new Date() : null}),completed_at=${state.status === "done" ? new Date() : null},reason=${d.reason || op.reason},photos=${js(photos)}::text::jsonb,version=version+1,updated_at=now()WHERE tenant_id=${t} AND id=${op.id} RETURNING *`;
  if (d.action === "complete") {
    const [next] =
      await tx`SELECT * FROM production_operations WHERE tenant_id=${t} AND work_order_id=${job.id} AND position>${op.position} ORDER BY position LIMIT 1`;
    if (state.status === "done" && next)
      await tx`UPDATE production_operations SET status='ready',ready_at=now(),version=version+1 WHERE tenant_id=${t} AND id=${next.id}`;
    if (!next) {
      await finishQuantity(tx, a, job, d.quantity!, key);
      const unready =
        await tx`SELECT oi.id FROM order_items oi WHERE oi.order_id=${job.order_id} AND oi.quantity>COALESCE((SELECT SUM(w.produced_qty) FROM work_orders w WHERE w.tenant_id=${t} AND w.order_item_id=oi.id AND w.status<>'cancelled'),0)`;
      if (state.status === "done" && !unready.length) {
        await tx`UPDATE orders SET status='ready_for_shipment',version=version+1 WHERE tenant_id=${t} AND id=${job.order_id}`;
        await enqueueOrderNotice(
          tx,
          a,
          job.order_id,
          "ready_for_shipment",
          "packed:" + job.order_id,
        );
      }
    }
  }
  await event(
    tx,
    a,
    "operation." + d.action,
    { ...d, before: op, after: updated },
    job.id,
    op.id,
  );
  return updated;
}
async function finishQuantity(
  tx: any,
  a: WorkOrderActor,
  job: any,
  quantity: number,
  key: string,
) {
  if (num(job.produced_qty) + quantity > num(job.planned_qty))
    fail("Üretilen miktar planı aşamaz");
  const materials =
    await tx`SELECT * FROM work_order_materials WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id}`;
  const lines: any[] = [];
  for (const m of materials) {
    const qty = Number(
      ((num(m.required_qty) * quantity) / num(job.planned_qty)).toFixed(6),
    );
    if (qty <= 0) continue;
    if (num(m.consumed_qty) + qty > num(m.transferred_qty) + 0.000001)
      fail("Üretim tüketimi WIP malzemesini aşıyor");
    lines.push({
      itemId: m.item_id,
      warehouseId: job.wip_warehouse_id,
      quantityDelta: -qty,
      uom: m.uom,
      metadata: { workOrderId: job.id },
    });
    await tx`UPDATE work_order_materials SET consumed_qty=consumed_qty+${qty} WHERE tenant_id=${a.tenantId} AND id=${m.id}`;
  }
  lines.push({
    itemId: job.production_item_id,
    warehouseId: job.target_warehouse_id,
    quantityDelta: quantity,
    uom: job.production_uom,
    metadata: { workOrderId: job.id },
  });
  const entry = await postStockEntryInTransaction(tx, a, {
    entryType: "MANUFACTURE",
    referenceType: "work_order",
    referenceId: job.id,
    idempotencyKey: key,
    lines,
  });
  const [count] =
    await tx`SELECT COUNT(*) AS n FROM production_runs WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id}`;
  const [run] =
    await tx`INSERT INTO production_runs(tenant_id,work_order_id,run_number,produced_qty,stock_entry_id,idempotency_key,completed_by)VALUES(${a.tenantId},${job.id},${num(count.n) + 1},${quantity},${entry.id},${key},${a.userId})RETURNING id`;
  for (let n = 1; n <= quantity; n++)
    await tx`INSERT INTO production_units(tenant_id,work_order_id,serial,production_run_id)VALUES(${a.tenantId},${job.id},${num(job.produced_qty) + n},${run.id})`;
  const done = num(job.produced_qty) + quantity === num(job.planned_qty);
  await tx`UPDATE work_orders SET produced_qty=produced_qty+${quantity},status=${done ? "done" : "in_progress"},reservation_status=${done ? "consumed" : "transferred"},completed_at=${done ? new Date() : null},revision=revision+1 WHERE tenant_id=${a.tenantId} AND id=${job.id}`;
}
async function ship(
  tx: any,
  a: WorkOrderActor,
  data: Record<string, unknown>,
  key: string,
) {
  const d = z
    .object({
      workOrderId: uuid,
      quantity: z.number().int().positive(),
      carrier: z.string().max(100).default(""),
      trackingNumber: z.string().max(100).default(""),
    })
    .parse(data);
  const [job] =
    await tx`SELECT * FROM work_orders WHERE tenant_id=${a.tenantId} AND id=${d.workOrderId} FOR UPDATE`;
  if (!job) fail("Üretim emri bulunamadı", 404);
  const [qty] =
    await tx`SELECT COALESCE(SUM(quantity),0) AS shipped FROM production_shipments WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id}`;
  if (num(qty.shipped) + d.quantity > num(job.produced_qty))
    fail("Paketlenmiş miktardan fazla sevk edilemez");
  const entry = await postStockEntryInTransaction(tx, a, {
    entryType: "MATERIAL_ISSUE",
    referenceType: "shipment",
    referenceId: job.id,
    idempotencyKey: key,
    lines: [
      {
        itemId: job.production_item_id,
        warehouseId: job.target_warehouse_id,
        quantityDelta: -d.quantity,
        uom: job.production_uom,
        metadata: { shipment: key },
      },
    ],
  });
  const [order] =
    await tx`SELECT customer_name,customer_id FROM orders WHERE tenant_id=${a.tenantId} AND id=${job.order_id}`;
  const [erp] =
    await tx`INSERT INTO shipments(tenant_id,shipment_number,customer_id,customer_name,status,carrier,tracking_number,created_by)VALUES(${a.tenantId},${"SEV-" + key.slice(0, 12).toUpperCase()},${order.customer_id},${order.customer_name},'in_transit',${d.carrier},${d.trackingNumber},${a.userId})RETURNING id`;
  await tx`INSERT INTO shipment_items(tenant_id,shipment_id,order_id,order_item_id,product_name,quantity)VALUES(${a.tenantId},${erp.id},${job.order_id},${job.order_item_id},${job.title},${d.quantity})`;
  const [row] =
    await tx`INSERT INTO production_shipments(tenant_id,order_id,work_order_id,quantity,carrier,tracking_number,stock_entry_id,created_by,erp_shipment_id)VALUES(${a.tenantId},${job.order_id},${job.id},${d.quantity},${d.carrier},${d.trackingNumber},${entry.id},${a.userId},${erp.id})RETURNING *`;
  const all =
    await tx`SELECT oi.quantity,COALESCE((SELECT SUM(s.quantity) FROM production_shipments s JOIN work_orders w ON w.id=s.work_order_id WHERE s.tenant_id=${a.tenantId} AND w.order_item_id=oi.id),0) AS shipped FROM order_items oi WHERE order_id=${job.order_id}`;
  const complete = all.every((r: any) => num(r.shipped) >= num(r.quantity));
  await tx`UPDATE orders SET status=${complete ? "shipped" : "ready_for_shipment"},shipment_status=${complete ? "shipped" : "ready"},version=version+1 WHERE tenant_id=${a.tenantId} AND id=${job.order_id}`;
  await enqueueOrderNotice(
    tx,
    a,
    job.order_id,
    complete ? "shipped" : "partially_shipped",
    "shipment:" + row.id,
  );
  return row;
}
export async function publicTracking(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const [link] =
    await sql`SELECT l.*,o.order_number,o.status FROM customer_tracking_links l JOIN orders o ON o.id=l.order_id AND o.tenant_id=l.tenant_id WHERE token_hash=${hash} AND revoked_at IS NULL AND expires_at>now()`;
  if (!link) return null;
  const items =
    await sql`SELECT id,product_name,quantity,awning_configuration,awning_preview FROM order_items WHERE order_id=${link.order_id}`;
  const jobs =
    await sql`SELECT id,order_item_id,planned_qty,produced_qty,status FROM work_orders WHERE tenant_id=${link.tenant_id} AND order_id=${link.order_id}`;
  const shipments =
    await sql`SELECT quantity,carrier,tracking_number,status,delivered_at,created_at FROM production_shipments WHERE tenant_id=${link.tenant_id} AND order_id=${link.order_id} ORDER BY created_at`;
  return {
    orderNumber: link.order_number,
    status: link.status,
    items,
    jobs,
    shipments,
  };
}

export async function lookupProductionLabel(
  actor: WorkOrderActor,
  code: string,
) {
  if (!["owner", "admin", "office", "worker"].includes(actor.role))
    fail("Etiket erişimi yok", 403);
  let value = code.trim();
  try {
    const url = new URL(value);
    value =
      ["job", "unit", "cut", "lot"]
        .map((key) => url.searchParams.get(key))
        .find(Boolean) || value;
  } catch {}
  if (!uuid.safeParse(value).success)
    fail("Etiketteki tam barkod veya QR bağlantısını okutun", 400);
  const t = actor.tenantId;
  const [job] =
    await sql`SELECT w.id,w.title,w.configuration,w.planned_qty,w.produced_qty FROM work_orders w WHERE w.tenant_id=${t} AND (w.id=${value} OR EXISTS(SELECT 1 FROM production_units u WHERE u.work_order_id=w.id AND u.tenant_id=${t} AND u.id=${value})) AND (${actor.role !== "worker"} OR w.assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations o WHERE o.work_order_id=w.id AND o.tenant_id=${t} AND o.assigned_to=${actor.userId}))`;
  if (job)
    return {
      kind: "job",
      id: value,
      workOrderId: job.id,
      title: job.title,
      configuration: job.configuration,
      summary: `${num(job.produced_qty)} / ${num(job.planned_qty)} adet`,
      href: `/factory?job=${job.id}`,
    };
  const [lot] =
    await sql`SELECT l.id,l.lot_number,l.remaining_qty,l.status,l.metadata,i.name,i.stock_uom FROM stock_lots l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND l.id=${value}`;
  if (lot)
    return {
      kind: "lot",
      id: lot.id,
      title: lot.lot_number,
      summary: `${lot.name} · ${lot.metadata.color || ""} · ${num(lot.remaining_qty)} ${lot.stock_uom} · ${lot.status}`,
    };
  const [plan] =
    await sql`SELECT p.id,p.status,p.result FROM cutting_plans p WHERE p.tenant_id=${t} AND p.id=${value} AND (${actor.role !== "worker"} OR EXISTS(SELECT 1 FROM work_orders w WHERE w.id=ANY(p.work_order_ids) AND w.tenant_id=${t} AND (w.assigned_to=${actor.userId} OR EXISTS(SELECT 1 FROM production_operations o WHERE o.tenant_id=${t} AND o.work_order_id=w.id AND o.assigned_to=${actor.userId}))))`;
  if (plan)
    return {
      kind: "cut",
      id: plan.id,
      title: `Kesim paketi ${plan.id.slice(0, 8).toUpperCase()}`,
      summary: `${plan.result.bars.length} çubuk · ${plan.status}`,
      bars: plan.result.bars.map((b: any) => ({
        color: b.source.color,
        lengthMm: b.source.lengthMm,
        remainingMm: b.remainingMm,
        pieces: b.pieces.map((p: any) => ({ lengthMm: p.lengthMm })),
      })),
    };
  fail("Etiket bulunamadı veya bu işe erişim yetkiniz yok", 404);
}

/**
 * What the saw operator needs to cut one plan: bars in order, the pieces on each with their job,
 * what to keep as remnant, and the values used. No costs and no customer names.
 */
export async function cutPlanSheet(actor: WorkOrderActor, id: string) {
  office(actor);
  if (!uuid.safeParse(id).success) fail("Kesim planı bulunamadı", 404);
  const t = actor.tenantId;
  const [plan] = await sql`SELECT id,status,work_order_ids,rework_ids,parameters,result,created_at,approved_at FROM cutting_plans WHERE tenant_id=${t} AND id=${id}`;
  if (!plan) fail("Kesim planı bulunamadı", 404);
  const bars: any[] = plan.result.bars;
  const itemIds = [...new Set<string>([
    ...bars.map((b) => b.source.itemId),
    ...(plan.result.purchase?.lines ?? []).map((l: any) => l.itemId),
    ...(plan.result.purchase?.tooLong ?? []).map((p: any) => p.itemId),
  ])];
  const lotIds = bars.map((b) => b.source.id);
  const [items, jobs, lots] = await Promise.all([
    itemIds.length ? sql`SELECT id,sku,name FROM inventory_items WHERE tenant_id=${t} AND id=ANY(${itemIds}::uuid[])` : [],
    sql`SELECT w.id,w.title,o.order_number FROM work_orders w JOIN orders o ON o.id=w.order_id AND o.tenant_id=w.tenant_id WHERE w.tenant_id=${t} AND w.id=ANY(${plan.work_order_ids}::uuid[])`,
    lotIds.length ? sql`SELECT id,lot_number FROM stock_lots WHERE tenant_id=${t} AND id=ANY(${lotIds}::uuid[])` : [],
  ]);
  const item = new Map(items.map((i: any) => [i.id, { sku: i.sku, name: i.name }]));
  const job = new Map(jobs.map((j: any) => [j.id, { title: j.title, orderNumber: j.order_number }]));
  const lot = new Map(lots.map((l: any) => [l.id, l.lot_number]));
  const source: CuttingParameterSource | null = plan.result.parameterSource ?? null;
  return {
    id: plan.id,
    code: String(plan.id).slice(0, 8).toUpperCase(),
    status: plan.status,
    rework: plan.rework_ids.length > 0,
    createdAt: plan.created_at,
    approvedAt: plan.approved_at,
    parameters: plan.parameters,
    parameterSource: source,
    notice: cuttingEstimateNotice(source),
    algorithm: plan.result.algorithm,
    wastePercent: plan.result.wastePercent,
    reusableMm: plan.result.reusableMm,
    unfulfilled: plan.result.unfulfilled.length,
    purchase: (plan.result.purchase?.lines ?? []).map((l: any) => ({ ...l, item: item.get(l.itemId) ?? null })),
    tooLong: (plan.result.purchase?.tooLong ?? []).map((piece: any) => ({ lengthMm: piece.lengthMm, item: item.get(piece.itemId) ?? null, color: piece.color })),
    bars: bars.map((b, index) => ({
      position: index + 1,
      lotNumber: lot.get(b.source.id) ?? null,
      item: item.get(b.source.itemId) ?? null,
      color: b.source.color,
      lengthMm: b.source.lengthMm,
      isRemnant: b.source.isRemnant,
      pieces: b.pieces.map((p: any) => ({ lengthMm: p.lengthMm, job: job.get(p.workOrderId) ?? null })),
      remainingMm: b.remainingMm,
      reusable: b.reusable,
      lossMm: b.lossMm,
    })),
  };
}

function schedulingFingerprint(value:unknown){
  const sort=(v:any):any=>Array.isArray(v)?v.map(sort):v && typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
  return createHash('sha256').update(js(sort(JSON.parse(js(value))))).digest('hex');
}
