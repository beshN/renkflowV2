import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sql, withTransaction } from "@/lib/db";
import { tableExists } from "@/lib/db/schema-guard";
import { recordAudit } from "@/lib/audit/audit-log";
import { resolveMemberAccess } from "@/lib/security/member-access.server";
import { can } from "@/lib/security/access-matrix";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { FoyDocSchema } from "../foy/types";
import { checkFoy } from "../foy/rules";
import { planCutListFromDoc } from "../manufacturing/cut-list.server";
import {
  createJobsForConfiguredOrder,
  createSheetJobs,
  planAndReserveCut,
  recipe as recipeDefinition,
} from "../manufacturing/platform.service";
import { calculateRecipe } from "../manufacturing/recipe-engine";
import { stableJson } from "../products/configuration";
import { colorKey } from "../colors/color-spec";
import { FoyUploadSchema } from "../foy/service.server";
import { validateProductionBytes } from "../manufacturing/files.service";
import { DEFAULT_INSTALL_CHECKLIST } from "../field/engine";
import { notifyWorkOrdersAssigned } from "@/lib/notifications/service";
import { cutView } from "../manufacturing/cut-view";
import { AwningConfigurationSchema } from "../awning/configuration";
import { ProductVisualizationSchema, productMeta } from "../product-3d/catalog";
import { syncDailyStages } from "../manufacturing/daily-progress.server";
import { requireCommercialApproval } from "./quote-file.server";
import {
  TECHNICAL_FAMILIES,
  technicalFamily,
  sheetMeasures,
  mainProcessIndex,
  drillPositions,
  DrillRuleSchema,
  TECHNICAL_WARNINGS,
  technicalIssues,
} from "./technical";

const fail = (message: string, status = 409): never => {
  throw new WorkOrderApiError(message, status);
};
const cutSignature = (rows: any[]) =>
  stableJson(
    rows
      .map((r) => [
        r.label,
        r.lengthMm,
        r.quantity,
        r.color,
        r.requiredProfileCode || null,
        r.fixedItemId || null,
      ])
      .sort((a, b) => stableJson(a).localeCompare(stableJson(b))),
  );
const technicalLineProof = (lines: any[]) =>
  lines.map((l) => ({
    id: l.id,
    quantity: Number(l.quantity),
    widthMm: l.width_mm == null ? null : Number(l.width_mm),
    projectionMm: l.projection_mm == null ? null : Number(l.projection_mm),
    mountingHeightMm:
      l.mounting_height_mm == null ? null : Number(l.mounting_height_mm),
    color: l.color || null,
    awning: l.awning_configuration || null,
    visualization: l.product_visualization || null,
    configured: l.product_configuration
      ? {
          family: l.product_configuration.family,
          recipeId: l.product_configuration.recipeId,
          parameters: l.product_configuration.parameters,
          color: l.product_configuration.color,
          bom: l.product_configuration.bom,
        }
      : null,
  }));
export async function needTechnical(
  a: WorkOrderActor,
  write = false,
  approval = false,
) {
  if (
    !["owner", "admin", "office", "worker"].includes(a.role) ||
    (write && a.role === "worker")
  )
    fail("Teknik plan yetkiniz yok", 403);
  const access = await resolveMemberAccess(a.userId, a.tenantId);
  if (
    !access ||
    access.deactivated ||
    !can(access, "production", approval ? "approve" : write ? "edit" : "view")
  )
    fail("Teknik plan yetkiniz yok", 403);
  if (!(await tableExists("order_technical_revisions")))
    fail("Sipariş teknik dosyası için veritabanı güncellemesi bekleniyor");
}

/** Versioned, source-backed rules; never derive hole coordinates from a mesh. */
export async function saveDrillingRule(
  a: WorkOrderActor,
  orderId: string,
  raw: unknown,
) {
  await needTechnical(a, true, true);
  z.uuid().parse(orderId);
  const d = z
    .object({
      revisionId: z.uuid(),
      itemId: z.uuid(),
      expectedVersion: z.number().int().nonnegative(),
      source: z.string().trim().min(5).max(1000),
      rule: DrillRuleSchema,
    })
    .strict()
    .parse(raw);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [revision] =
      await tx`SELECT family,technical,plan FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${orderId} AND id=${d.revisionId}`;
    if (
      !revision ||
      !revision.plan?.plan?.groups?.some((g: any) => g.itemId === d.itemId)
    )
      fail("Profil bu teknik listeye ait değil");
    const [item] =
      await tx`SELECT profile_code FROM inventory_items WHERE tenant_id=${a.tenantId} AND id=${d.itemId}`;
    if (!item?.profile_code) fail("Doğrulanmış profil kodu gerekli");
    const mechanism = revision.technical.mechanism || "standard";
    if (mechanism === "unconfirmed") fail("Mekanizma standardı doğrulanmalı");
    const [previous] =
      await tx`SELECT version FROM product_drilling_rules WHERE tenant_id=${a.tenantId} AND family=${revision.family} AND profile_code=${item.profile_code} AND mechanism=${mechanism} ORDER BY version DESC LIMIT 1`;
    if (Number(previous?.version || 0) !== d.expectedVersion)
      fail("Delik kuralı başka cihazda değişti; güncel sürümü açın");
    await tx`UPDATE product_drilling_rules SET active=false WHERE tenant_id=${a.tenantId} AND family=${revision.family} AND profile_code=${item.profile_code} AND mechanism=${mechanism} AND active`;
    const [rule] =
      await tx`INSERT INTO product_drilling_rules(tenant_id,family,profile_code,mechanism,version,source,rule,approved_by) VALUES(${a.tenantId},${revision.family},${item.profile_code},${mechanism},${d.expectedVersion + 1},${d.source},${JSON.stringify(d.rule)}::text::jsonb,${a.userId}) RETURNING id,version`;
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "order",
      entityId: orderId,
      action: "drilling_rule_published",
      note: d.source,
      metadata: {
        ruleId: rule.id,
        version: rule.version,
        profileCode: item.profile_code,
        mechanism,
      },
    });
    return rule;
  });
}

export async function recheckTechnicalRules(
  a: WorkOrderActor,
  orderId: string,
  revisionId: string,
  commandId: string,
) {
  await needTechnical(a, true);
  z.uuid().parse(orderId);
  z.uuid().parse(revisionId);
  z.uuid().parse(commandId);
  const [r] =
    await sql`SELECT * FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${orderId} AND id=${revisionId}`;
  if (!r || r.status !== "approved")
    fail("Yalnız onaylı teknik sürüm yeni kurallarla kontrol edilebilir");
  const [latest] =
    await sql`SELECT revision FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${orderId} ORDER BY revision DESC LIMIT 1`;
  const next = await attachTechnicalSheet(a, orderId, {
    name: r.source_name,
    doc: r.document,
    family: r.family,
    choices: r.choices,
    expectedRevision: latest.revision,
    planningKey: commandId,
    revisionReason:
      "Doğrulanmış delik kuralları yeni teknik sürümde kontrol edildi",
  });
  if (r.source_file_id)
    await sql`UPDATE order_technical_revisions SET source_file_id=${r.source_file_id} WHERE tenant_id=${a.tenantId} AND id=${next.id} AND source_file_id IS NULL`;
  return next;
}
export async function technicalWorkspace(a: WorkOrderActor, id: string) {
  await needTechnical(a);
  z.uuid().parse(id);
  const [o] =
    await sql`SELECT id,tenant_id,order_number,product_name,status,provisional,quotation_id FROM orders WHERE tenant_id=${a.tenantId} AND id=${id}`;
  if (!o) fail("Sipariş bulunamadı", 404);
  const revisions =
    await sql`SELECT id,revision,family,status,source_name,source_file_id,replaces_id,revision_reason,impact,document,technical,plan,created_at,approved_at FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} ORDER BY revision DESC`;
  const jobRows =
    await sql`SELECT id,title,status,assigned_to,technical_revision_id,planned_qty,produced_qty,revision,cut_plan_id,configuration,bom_snapshot FROM work_orders WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status<>'cancelled'`;
  const legacyProducts = !revisions.length
    ? jobRows.map((j: any) => {
        const c = j.configuration || {},
          awning = AwningConfigurationSchema.safeParse(c);
        return {
          id: j.id,
          widthMm: c.widthMm || null,
          projectionMm: c.projectionMm || null,
          mountingHeightMm: c.mountingHeightMm || null,
          color: c.bodyName || null,
          awning: awning.success ? awning.data : null,
          cuts: (Array.isArray(j.bom_snapshot?.cuts)
            ? j.bom_snapshot.cuts
            : []
          ).map((p: any) => ({
            itemId: p.itemId,
            lengthMm: p.lengthMm,
            quantity: p.quantity,
          })),
        };
      })
    : [];
  const jobs = jobRows.map(
    ({ configuration: _configuration, bom_snapshot: _bom, ...j }: any) => j,
  );
  const family = revisions[0]?.family || technicalFamily(o.product_name || "");
  if (
    a.role === "worker" &&
    family !== "other" &&
    !jobs.some((j: any) => j.assigned_to === a.userId)
  )
    fail("Sipariş bulunamadı", 404);
  const operations =
    await sql`SELECT p.id,p.work_order_id,p.position,p.name,p.status,p.version,p.planned_qty,p.completed_qty,p.reason,p.quality_checks FROM production_operations p JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id WHERE p.tenant_id=${a.tenantId} AND w.order_id=${id} AND w.status<>'cancelled' ORDER BY p.position`;
  const [cutPlan] =
    await sql`SELECT id,status,version,result FROM cutting_plans WHERE tenant_id=${a.tenantId} AND work_order_ids && ${jobs.map((j: any) => j.id)}::uuid[] AND status IN('approved','completed') ORDER BY created_at DESC LIMIT 1`;
  const cutSources = cutPlan
    ? await sql`SELECT s.lot_id,s.consumed,l.lot_number,l.length_m FROM cutting_plan_sources s JOIN stock_lots l ON l.id=s.lot_id AND l.tenant_id=s.tenant_id WHERE s.tenant_id=${a.tenantId} AND s.plan_id=${cutPlan.id} ORDER BY l.lot_number`
    : [];
  const parts =
    await sql`SELECT p.work_order_id,p.item_id,i.name AS item_name,p.length_mm,p.target_color,COUNT(*)::int AS total,COUNT(*) FILTER(WHERE p.state='planned')::int AS planned,COUNT(*) FILTER(WHERE p.state='cut')::int AS cut,COUNT(*) FILTER(WHERE p.state='paint_waiting')::int AS waiting,COUNT(*) FILTER(WHERE p.state='paint_sent')::int AS sent,COUNT(*) FILTER(WHERE p.paint_returned_at IS NOT NULL)::int AS returned,COUNT(*) FILTER(WHERE p.state='assembled')::int AS assembled,CASE WHEN COUNT(p.weight_per_meter_kg)=COUNT(*) THEN SUM(p.length_mm/1000*p.weight_per_meter_kg) ELSE NULL END AS weight_kg FROM production_parts p JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id JOIN inventory_items i ON i.id=p.item_id AND i.tenant_id=p.tenant_id WHERE p.tenant_id=${a.tenantId} AND w.order_id=${id} AND w.status<>'cancelled' GROUP BY p.work_order_id,p.item_id,i.name,p.length_mm,p.target_color`;
  const revisionParts =
    a.role === "worker"
      ? []
      : await sql`SELECT p.id,p.work_order_id,p.item_id,i.name,p.length_mm,p.state,p.target_color,p.paint_returned_at,p.weight_per_meter_kg,l.metadata->>'color' AS source_color,CASE WHEN l.metadata->>'unitCost' IS NOT NULL THEN (l.metadata->>'unitCost')::numeric*p.length_mm/1000 ELSE NULL END AS material_cost FROM production_parts p JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id JOIN inventory_items i ON i.id=p.item_id AND i.tenant_id=p.tenant_id JOIN stock_lots l ON l.id=p.source_lot_id AND l.tenant_id=p.tenant_id WHERE p.tenant_id=${a.tenantId} AND w.order_id=${id} AND w.status<>'cancelled' ORDER BY p.sequence`;
  const sharedPlans=a.role==='worker'?[]:await sql`SELECT p.id,p.version,p.status,(SELECT json_agg(json_build_object('id',w.id,'title',w.title,'orderNumber',o.order_number)) FROM work_orders w JOIN orders o ON o.id=w.order_id AND o.tenant_id=w.tenant_id WHERE w.tenant_id=p.tenant_id AND w.id=ANY(p.work_order_ids) AND w.order_id<>${id}) AS others FROM cutting_plans p WHERE p.tenant_id=${a.tenantId} AND p.status IN('approved','completed') AND p.work_order_ids&&${jobs.map((j:any)=>j.id)}::uuid[] AND EXISTS(SELECT 1 FROM work_orders w WHERE w.tenant_id=p.tenant_id AND w.id=ANY(p.work_order_ids) AND w.order_id<>${id})`;
  const materialDecisions =
    a.role === "worker" || !(await tableExists("technical_material_decisions"))
      ? []
      : await sql`SELECT d.result,d.approved_at,u.name AS approved_by FROM technical_material_decisions d JOIN order_technical_revisions r ON r.id=d.technical_revision_id AND r.tenant_id=d.tenant_id LEFT JOIN users u ON u.id=d.approved_by WHERE d.tenant_id=${a.tenantId} AND r.order_id=${id} ORDER BY d.approved_at DESC`;
  const shipments =
    await sql`SELECT s.id,s.work_order_id,s.quantity,s.status,s.version,s.photos,s.vehicle_plate,s.notes,s.created_at,s.delivered_at,u.name AS recorded_by FROM production_shipments s LEFT JOIN users u ON u.id=s.created_by WHERE s.tenant_id=${a.tenantId} AND s.order_id=${id} ORDER BY s.created_at`;
  const [quote] = o.quotation_id
    ? await sql`SELECT status,revision,quotation_number FROM quotations WHERE tenant_id=${a.tenantId} AND id=${o.quotation_id}`
    : [];
  // The stored plan contains named technical values only, never purchase prices or costs.
  const access = await resolveMemberAccess(a.userId, a.tenantId);
  const visibleRevisions =
    a.role === "worker"
      ? revisions
          .filter((r: any) => ["approved", "blocked"].includes(r.status))
          .map((r: any) => ({
            ...r,
            source_name: "Üretim listesi",
            source_file_id: null,
            impact: null,
            document: {
              ...r.document,
              customer: null,
              address: null,
              notes: [],
              ironNotes: [],
            },
            technical: { ...r.technical, checks: [] },
          }))
      : revisions;
  return {
    order: o,
    quote: a.role === "worker" ? null : quote || null,
    revisions: visibleRevisions,
    jobs,
    operations,
    family,
    canEdit:
      a.role !== "worker" && !!access && can(access, "production", "edit"),
    canApprove: !!access && can(access, "production", "approve"),
    legacy: !revisions.length && jobs.length > 0,
    legacyProducts,
    legacyCutPlan:
      !revisions.length && cutPlan
        ? cutView(cutPlan, new Set(jobs.map((j: any) => j.id)))
        : null,
    shipments,
    parts,
    revisionParts,
    sharedPlans,
    materialDecisions,
    cutPlan: cutPlan
      ? {
          id: cutPlan.id,
          status: cutPlan.status,
          version: cutPlan.version,
          sources: cutSources,
        }
      : null,
    step: mainProcessIndex({
      status: revisions.some((r:any)=>r.status==='blocked')?'on_hold':o.status,
      provisional: o.provisional,
      quoteStatus: quote?.status,
      hasDocument: revisions.length > 0,
      released: revisions.some((r: any) => r.status === "approved"),
    }),
  };
}
const AttachSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    doc: FoyDocSchema,
    file: FoyUploadSchema.optional(),
    family: z.enum(TECHNICAL_FAMILIES),
    standardRecipeId: z.uuid().optional(),
    choices: z.record(z.string(), z.uuid()).default({}),
    expectedRevision: z.number().int().nonnegative(),
    revisionReason: z.string().trim().min(5).max(1000).optional(),
    planningKey: z.uuid().optional(),
  })
  .strict();
export async function attachTechnicalSheet(
  a: WorkOrderActor,
  id: string,
  raw: unknown,
) {
  await needTechnical(a, true);
  z.uuid().parse(id);
  const d = AttachSchema.parse(raw);
  if (d.doc.template === "unknown")
    fail("Föy tanınmadı; teknik kontrol gerekli", 400);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [o] =
      await tx`SELECT * FROM orders WHERE tenant_id=${a.tenantId} AND id=${id} FOR UPDATE`;
    if (!o) fail("Sipariş bulunamadı", 404);
    await requireCommercialApproval(tx, a.tenantId, id);
    const bytes = d.file ? Buffer.from(d.file.base64, "base64") : null;
    if (d.file && bytes) validateProductionBytes(bytes, d.file.mime);
    const hash = createHash("sha256")
      .update(
        stableJson({
          doc: d.doc,
          family: d.family,
          choices: d.choices,
          standardRecipeId: d.standardRecipeId,
          planningKey: d.planningKey,
          fileHash: bytes
            ? createHash("sha256").update(bytes).digest("hex")
            : undefined,
        }),
      )
      .digest("hex");
    const [same] =
      await tx`SELECT id,revision FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} AND source_hash=${hash}`;
    if (same) return { ...same, replayed: true };
    const [last] =
      await tx`SELECT revision FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} ORDER BY revision DESC LIMIT 1`;
    if (Number(last?.revision || 0) !== d.expectedRevision)
      fail("Liste başka cihazda değişti; güncel dosyayı açın");
    const activeJobs =
      await tx`SELECT id,produced_qty FROM work_orders WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status<>'cancelled'`;
    const [base] =
      await tx`SELECT * FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status IN('approved','blocked') ORDER BY revision DESC LIMIT 1`;
    const controlled = !!activeJobs.length;
    if (controlled && !d.revisionReason)
      fail(
        "Kesim veya üretim başladı. Ölçü değişikliğini kontrollü revizyonla yönetin",
      );
    if (controlled && !base)
      fail(
        "Tamamlanmış ürün içeren plan için önce mevcut ürünlerin yeniden işleme kararı verilmeli",
      );
    if (controlled && base.status === "blocked" && !base.impact?.orderChangeId)
      fail("Açık revizyonu önce sonuçlandırın");
    const lines =
      await tx`SELECT id,product_name,quantity,color,width_mm,projection_mm,mounting_height_mm,product_configuration,awning_configuration,product_visualization FROM order_items WHERE order_id=${id} ORDER BY created_at,id`;
    const vertical = ["wind-manual", "wind-piston", "giyotin"].includes(
      d.family,
    );
    const recipeDemand = vertical
      ? lines.flatMap((l: any) =>
          (l.product_configuration?.bom?.cuts || []).map((c: any) => ({
            itemId: c.itemId,
            lengthMm: c.lengthMm,
            quantity: c.quantity * Number(l.quantity),
          })),
        )
      : undefined;
    let result = await planCutListFromDoc(
      a,
      { doc: d.doc, choices: d.choices, family: d.family },
      tx,
      recipeDemand,
    );
    const previousProof = base?.technical?.lineProof?.map((l: any) => {
      const configured = base.standard_configurations?.find(
        (s: any) => s.orderItemId === l.id,
      )?.configuration;
      return configured
        ? {
            ...l,
            configured: {
              family: configured.family,
              recipeId: configured.recipeId,
              parameters: configured.parameters,
              color: configured.color,
              bom: configured.bom,
            },
          }
        : l;
    });
    const keepsCuts =
      controlled &&
      !activeJobs.some((j:any)=>Number(j.produced_qty)>0) &&
      base.family === d.family &&
      stableJson(previousProof) === stableJson(technicalLineProof(lines)) &&
      stableJson(base.choices) === stableJson(d.choices) &&
      cutSignature(base.plan.rows) === cutSignature(result.rows);
    if (keepsCuts)
      result = {
        ...result,
        plan: base.plan.plan,
        stockProblems: [],
        estimateNotice: base.plan.estimateNotice,
      };
    const measures = sheetMeasures(d.doc),
      blockers: string[] = [],
      warnings: string[] = [];
    if (controlled && !keepsCuts)
      blockers.push(
        "Kesilmiş veya ayrılmış parça boyları değişiyor; yeniden kesim ve malzeme kararı tamamlanmadan bu revizyon üretime açılamaz",
      );
    if (
      !measures.length ||
      measures.some(
        (s) =>
          !s.widthMm ||
          (vertical
            ? !s.heightMm
            : !s.projectionMm ||
              !s.bays.length ||
              s.bays.some((b) => !b.ironInnerMm || !b.railInnerMm)),
      )
    )
      blockers.push(
        vertical
          ? "Genişlik, ürün yüksekliği ve adet doğrulanmalı"
          : "Genişlik, açılım ve bölme bilgileri doğrulanmalı",
      );
    if (vertical && !recipeDemand?.length)
      blockers.push(
        "Dikey ürünün doğrulanmış profil ve mekanizma reçetesi bağlanmalı",
      );
    if (d.doc.unreadPages.length)
      warnings.push(
        TECHNICAL_WARNINGS.unreadPages(d.doc.unreadPages.join(", ")),
      );
    if (!d.doc.ral || !d.doc.finish) warnings.push(TECHNICAL_WARNINGS.color);
    if (result.problems.some((p) => /okunamadı/.test(p.reason)))
      blockers.push(
        "Föyde okunamayan kesim ölçüleri var; föyü düzeltip yeniden yükleyin",
      );
    if (result.plan.unmatched.length)
      blockers.push(
        `Stok kartıyla eşleşmeyen profiller var (${result.plan.unmatched
          .map((u) => u.label)
          .slice(0, 5)
          .join(", ")}); Stok ekranında bu profillerin kartını açın veya listeden seçin`,
      );
    if (result.stockProblems.length)
      warnings.push(TECHNICAL_WARNINGS.stockLengths);
    if (result.plan.groups.some((g) => g.missing.length || g.tooLong.length))
      warnings.push(TECHNICAL_WARNINGS.stock);
    if (result.estimateNotice) warnings.push(TECHNICAL_WARNINGS.estimate);
    const lineProof = technicalLineProof(lines),
      standardConfigurations = [];
    for (const l of lines) {
      const awning = AwningConfigurationSchema.safeParse(
        l.awning_configuration,
      );
      if (l.product_configuration || d.family !== "makasli" || !awning.success)
        continue;
      const candidates =
        await tx`SELECT DISTINCT ON(r.code) r.id FROM production_recipes r JOIN product_family_recipes m ON m.tenant_id=r.tenant_id AND m.recipe_code=r.code WHERE r.tenant_id=${a.tenantId} AND m.family=${d.family} AND r.status='published' AND (${!d.standardRecipeId} OR r.id=${d.standardRecipeId || null}) ORDER BY r.code,r.version DESC`;
      if (candidates.length !== 1) continue;
      try {
        const { configureProduct } =
          await import("../products/configure.service");
        const c = awning.data,
          configured = await configureProduct(tx, a.tenantId, o.currency, {
            family: "makasli",
            recipeId: candidates[0].id,
            color: l.color || c.bodyName,
            parameters: {
              widthMm: c.widthMm,
              projectionMm: c.projectionMm,
              mountingHeightMm: c.mountingHeightMm,
              motor: true,
              led: c.led !== "off",
              customParameters: {},
            },
          });
        configured.price = {
          ...configured.price,
          source: "manual",
          message:
            "Onaylı teklif fiyatı korunur; teknik standart bu sürümde bağlandı",
        };
        l.product_configuration = configured;
        standardConfigurations.push({
          orderItemId: l.id,
          configuration: configured,
        });
      } catch (error) {
        if (
          !(error instanceof WorkOrderApiError || error instanceof z.ZodError)
        )
          throw error;
        blockers.push(
          error instanceof WorkOrderApiError
            ? error.message
            : "Ürün standardının parametreleri tamamlanmalı",
        );
      }
    }
    // With no recipe on any line the work order is built from the sheet's own cut list. A mix
    // cannot be split between the two sources, so it waits for a person.
    const configuredLines = lines.filter((l: any) => l.product_configuration);
    if (!lines.length) blockers.push("Siparişte ürün kalemi yok");
    else if (!configuredLines.length) {
      if (vertical)
        blockers.push(
          "Dikey ürünün kesim listesi reçeteden gelir; Üretim > Reçeteler'den ürün reçetesini tanımlayın",
        );
      else warnings.push(TECHNICAL_WARNINGS.recipe);
    } else if (configuredLines.length !== lines.length)
      blockers.push(
        "Kalemlerin bir kısmında reçete var, bir kısmında yok; tüm kalemleri aynı şekilde yapılandırın",
      );
    for (const l of lines) {
      const pc = l.product_configuration;
      if (!pc) continue;
      const [standard] =
        await tx`SELECT * FROM production_recipes WHERE tenant_id=${a.tenantId} AND id=${pc.recipeId}`;
      if (!standard || standard.status !== "published") {
        blockers.push("Üretim reçetesi yayında değil");
        continue;
      }
      if (
        vertical &&
        (standard.geometry !== "vertical" || !standard.verification_source)
      )
        blockers.push(
          "Mekanizma standardının doğrulanmış teknik kaynağı gerekli",
        );
      const actual = calculateRecipe(recipeDefinition(standard), {
          ...pc.parameters,
          quantity: Number(l.quantity),
        }),
        lastOperation = actual.operations.at(-1);
      if (
        !lastOperation ||
        (/kesim|cut|boya|paint/i.test(lastOperation.name) &&
          !lastOperation.qualityChecks?.length)
      )
        blockers.push(
          "Reçetede son hazırlık veya nihai ürün kontrolü adımı tanımlanmalı",
        );
    }
    const units = lines.flatMap((l: any) =>
      Array(Math.min(1000, Number(l.quantity) || 0)).fill(l),
    );
    if (
      units.length !== measures.length ||
      units.some(
        (l: any, i: number) =>
          (l.width_mm && Number(l.width_mm) !== measures[i]?.widthMm) ||
          (vertical
            ? l.mounting_height_mm &&
              Number(l.mounting_height_mm) !== measures[i]?.heightMm
            : l.projection_mm &&
              Number(l.projection_mm) !== measures[i]?.projectionMm),
      )
    )
      warnings.push(TECHNICAL_WARNINGS.quoteMeasures);
    // A recipe line is built from its quoted colour and family, so a different sheet is a real conflict.
    if (
      lines.some(
        (l: any) =>
          l.product_configuration &&
          (l.product_configuration.family !== d.family ||
            colorKey(l.product_configuration.color) !== colorKey(result.color)),
      )
    )
      blockers.push(
        "Föyün ürün grubu ve rengi teklifteki reçeteli kalemle aynı değil; föyü veya teklifi düzeltin",
      );
    const mechanisms = [
      ...new Set(
        lines
          .map((l: any) => l.product_configuration?.recipe?.code)
          .filter(Boolean),
      ),
    ];
    const mechanism = vertical
      ? mechanisms.length === 1
        ? String(mechanisms[0])
        : "unconfirmed"
      : "standard";
    if (vertical && mechanism === "unconfirmed")
      blockers.push(
        "Teknik liste için mekanizma ve reçete sürümü doğrulanmalı",
      );
    const drilling = [];
    for (const row of result.rows) {
      const group = result.plan.groups.find((g) =>
        g.bars.some((b) =>
          b.cuts.some(
            (c) => c.label === row.label && c.lengthMm === row.lengthMm,
          ),
        ),
      );
      const item = result.items.find((i) => i.id === group?.itemId);
      const [rule] = item?.profileCode
        ? await tx`SELECT id,version,source,rule FROM product_drilling_rules WHERE tenant_id=${a.tenantId} AND family=${d.family} AND profile_code=${item.profileCode} AND mechanism=${mechanism} AND active ORDER BY version DESC LIMIT 1`
        : [];
      let holes = null;
      let problem = "Doğrulanmış delik kuralı eksik";
      if (rule) {
        try {
          holes = drillPositions(row.lengthMm, rule.rule);
          problem = "";
        } catch {
          problem = "Delik kuralı bu parça boyuna uygun değil";
        }
      }
      drilling.push({
        rowId: row.id,
        label: row.label,
        lengthMm: row.lengthMm,
        holes,
        problem,
        ruleId: rule?.id || null,
        ruleVersion: rule?.version || null,
        source: rule?.source || null,
      });
    }
    if (drilling.some((r) => r.problem))
      warnings.push(TECHNICAL_WARNINGS.drilling);
    const loadingChecklist = [
      { id: "product", title: "Ürünler ve adetler tam" },
      ...lines.flatMap((l: any) => {
        const materials = (
          l.product_configuration?.bom?.materials || []
        ).filter((m: any) => m.uom !== "m");
        return [
          ...materials.map((m: any) => ({
            id: "material:" + m.itemId,
            title: m.name,
          })),
          ...(l.product_configuration?.parameters?.motor &&
          !materials.some((m: any) => /motor/i.test(m.name))
            ? [{ id: "motor", title: "Motor" }]
            : []),
          ...(l.awning_configuration?.motor &&
          !materials.some((m: any) => /kumanda/i.test(m.name))
            ? [{ id: "remote", title: "Kumanda" }]
            : []),
        ];
      }),
    ].filter((v, i, a) => a.findIndex((c) => c.id === v.id) === i);
    const impact = controlled
      ? {
          previousRevision: base.revision,
          cutParts:
            await tx`SELECT item_id,length_mm,target_color,state,COUNT(*)::int AS quantity FROM production_parts WHERE tenant_id=${a.tenantId} AND technical_revision_id=${base.id} GROUP BY item_id,length_mm,target_color,state`,
          previousDocument: base.document,
          stockMovement: "unchanged",
        }
      : null;
    const awnings = units.map((l: any) => {
      const parsed = AwningConfigurationSchema.safeParse(
        l.awning_configuration,
      );
      return parsed.success &&
        (!l.width_mm || Number(l.width_mm) === parsed.data.widthMm) &&
        (!l.projection_mm ||
          Number(l.projection_mm) === parsed.data.projectionMm) &&
        (!l.mounting_height_mm ||
          Number(l.mounting_height_mm) === parsed.data.mountingHeightMm)
        ? parsed.data
        : null;
    });
    const visualizations = units.map((l: any, i: number) => {
      const parsed = ProductVisualizationSchema.safeParse(
        l.product_visualization,
      );
      if (!parsed.success) return null;
      const c = parsed.data.configuration,
        m = measures[i],
        roof = productMeta(c.kind).category === "roof";
      if (
        c.kind !== d.family ||
        c.widthMm !== m?.widthMm ||
        (roof ? c.projectionMm !== m?.projectionMm : c.heightMm !== m?.heightMm)
      )
        return null;
      return { configuration: c };
    });
    const technical = {
      measures,
      recipeDemand,
      mechanism,
      awnings,
      visualizations,
      lineProof,
      loadingChecklist,
      assembly: d.doc.assembly,
      gutter:
        d.family === "makasli"
          ? { code: "170", source: "product-rule", version: 1 }
          : null,
      drilling,
      blockers,
      warnings,
      checks: checkFoy(d.doc),
    };
    const plan = { ...result, items: undefined, lots: undefined };
    const [revision] =
      await tx`INSERT INTO order_technical_revisions(tenant_id,order_id,revision,family,source_name,source_hash,document,choices,technical,plan,created_by) VALUES(${a.tenantId},${id},${Number(last?.revision || 0) + 1},${d.family},${d.name},${hash},${JSON.stringify(d.doc)}::text::jsonb,${JSON.stringify(d.choices)}::text::jsonb,${JSON.stringify(technical)}::text::jsonb,${JSON.stringify(plan)}::text::jsonb,${a.userId}) RETURNING id,revision`;
    if (standardConfigurations.length)
      await tx`UPDATE order_technical_revisions SET standard_configurations=${JSON.stringify(standardConfigurations)}::text::jsonb WHERE tenant_id=${a.tenantId} AND id=${revision.id}`;
    await tx`UPDATE order_technical_revisions SET status='superseded' WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status='draft' AND id<>${revision.id}`;
    if (d.file && bytes) {
      const [source] =
        await tx`INSERT INTO production_files(tenant_id,created_by,name,mime,body,size_bytes) VALUES(${a.tenantId},${a.userId},${d.file.name},${d.file.mime},${bytes},${bytes.length}) RETURNING id`;
      await tx`UPDATE order_technical_revisions SET source_file_id=${source.id} WHERE tenant_id=${a.tenantId} AND id=${revision.id}`;
    }
    if (controlled) {
      await tx`UPDATE order_technical_revisions SET status='blocked' WHERE tenant_id=${a.tenantId} AND id=${base.id}`;
      await tx`UPDATE order_technical_revisions SET replaces_id=${base.id},revision_reason=${d.revisionReason!},impact=${JSON.stringify({ ...impact, keepsCuts })}::text::jsonb WHERE tenant_id=${a.tenantId} AND id=${revision.id}`;
      await tx`UPDATE production_operations SET status='paused',active_seconds=active_seconds+CASE WHEN active_since IS NOT NULL THEN GREATEST(0,EXTRACT(EPOCH FROM (now()-active_since))) ELSE 0 END,active_since=NULL,version=version+1,updated_at=now() WHERE tenant_id=${a.tenantId} AND work_order_id=ANY(${activeJobs.map((j: any) => j.id)}::uuid[]) AND status='running'`;
    }
    if (
      d.doc.assembly === "montajli" &&
      !(
        await tx`SELECT id FROM installations WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status<>'cancelled'`
      ).length
    ) {
      const [installation] =
        await tx`INSERT INTO installations(tenant_id,installation_number,order_id,generated_from_revision_id,notes,created_by) VALUES(${a.tenantId},${"MNT-" + crypto.randomUUID().slice(0, 10).toUpperCase()},${id},${revision.id},'Sipariş föyünde montajlı; ekip ve tarih planlanacak',${a.userId}) RETURNING id`;
      for (const [position, title] of DEFAULT_INSTALL_CHECKLIST.entries())
        await tx`INSERT INTO record_checklist_items(tenant_id,entity_type,entity_id,title,position,created_by) VALUES(${a.tenantId},'installation',${installation.id},${title},${position},${a.userId})`;
    }
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "order",
      entityId: id,
      action: "technical_sheet_added",
      metadata: { technicalRevisionId: revision.id, sourceHash: hash },
    });
    return revision;
  });
}

/** A new draft snapshot after stock/rule data changes; source bytes and prior calculations stay traceable. */
export async function refreshTechnicalDraft(
  a: WorkOrderActor,
  id: string,
  revisionId: string,
  commandId: string,
) {
  await needTechnical(a, true);
  z.uuid().parse(id);
  z.uuid().parse(revisionId);
  z.uuid().parse(commandId);
  const [r] =
    await sql`SELECT * FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} AND id=${revisionId}`;
  if (
    !r ||
    (r.replaces_id && !r.impact?.materialsResolved) ||
    !["draft", "superseded"].includes(r.status)
  )
    fail("Yalnız üretime açılmamış taslak yeniden hesaplanabilir");
  const next = await attachTechnicalSheet(a, id, {
    name: r.source_name,
    doc: r.document,
    family: r.family,
    choices: r.choices,
    standardRecipeId: r.standard_configurations?.[0]?.configuration?.recipeId,
    expectedRevision: r.revision,
    planningKey: commandId,
  });
  if (r.source_file_id)
    await sql`UPDATE order_technical_revisions SET source_file_id=${r.source_file_id} WHERE tenant_id=${a.tenantId} AND id=${next.id} AND source_file_id IS NULL`;
  return next;
}

export async function approveTechnicalPlan(
  a: WorkOrderActor,
  id: string,
  revisionId: string,
  options: { acknowledgeWarnings?: boolean } = {},
) {
  await needTechnical(a, true, true);
  z.uuid().parse(id);
  z.uuid().parse(revisionId);
  const outcome = await withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    await requireCommercialApproval(tx, a.tenantId, id);
    const [r] =
      await tx`SELECT * FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} AND id=${revisionId} FOR UPDATE`;
    if (!r) fail("Teknik plan bulunamadı", 404);
    if (r.status === "approved") return { id: r.id, replayed: true };
    const [latest] =
      await tx`SELECT id FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} ORDER BY revision DESC LIMIT 1`;
    if (latest.id !== r.id || r.status !== "draft")
      fail("Yalnız güncel taslak plan onaylanabilir");
    const issues = technicalIssues(r.technical);
    if (issues.blockers.length) fail(issues.blockers.join("; "));
    if (issues.warnings.length && !options.acknowledgeWarnings)
      fail(
        "Uyarıları gördüğünüzü işaretleyip yeniden onaylayın: " +
          issues.warnings.join("; "),
      );
    const lines =
      await tx`SELECT id,quantity,color,width_mm,projection_mm,mounting_height_mm,product_configuration,awning_configuration,product_visualization FROM order_items WHERE order_id=${id} ORDER BY created_at,id`;
    if (
      r.technical.lineProof &&
      stableJson(technicalLineProof(lines)) !==
        stableJson(r.technical.lineProof)
    )
      fail("Siparişin teknik bilgileri değişti; planı yeniden kontrol edin");
    if (r.replaces_id) {
      const [base] =
        await tx`SELECT * FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} AND id=${r.replaces_id} FOR UPDATE`;
      if (
        base?.status !== "blocked" ||
        !r.impact?.keepsCuts ||
        base.family !== r.family ||
        cutSignature(base.plan.rows) !== cutSignature(r.plan.rows) ||
        stableJson(base.choices) !== stableJson(r.choices)
      )
        fail("Parça ve malzeme etkisi çözülmeden revizyon onaylanamaz");
      if (
        (
          await tx`SELECT id FROM work_orders WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status<>'cancelled' AND produced_qty>0`
        ).length
      )
        fail("Tamamlanan ürünler için yeniden işleme kararı gerekli");
      await tx`UPDATE order_technical_revisions SET status='superseded' WHERE tenant_id=${a.tenantId} AND id=${base.id}`;
      await tx`UPDATE order_technical_revisions SET status='approved',approved_by=${a.userId},approved_at=now() WHERE tenant_id=${a.tenantId} AND id=${r.id}`;
      await tx`UPDATE work_orders SET technical_revision_id=${r.id},revision=revision+1 WHERE tenant_id=${a.tenantId} AND order_id=${id} AND technical_revision_id=${base.id} AND status<>'cancelled'`;
      await tx`UPDATE production_parts SET technical_revision_id=${r.id} WHERE tenant_id=${a.tenantId} AND technical_revision_id=${base.id}`;
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorId: a.userId,
        entityType: "order",
        entityId: id,
        action: "technical_revision_approved",
        metadata: {
          previousRevisionId: base.id,
          technicalRevisionId: r.id,
          stockMovement: "unchanged",
        },
      });
      return { id: r.id, revised: true };
    }
    const fresh = await planCutListFromDoc(
      a,
      { doc: r.document, family: r.family, choices: r.choices },
      tx,
      r.technical.recipeDemand,
    );
    if (stableJson(fresh.plan) !== stableJson(r.plan.plan))
      fail("Stok veya kesim hesabı değişti; planı güncelleyin");
    await tx`UPDATE order_technical_revisions SET status='superseded' WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status='approved'`;
    await tx`UPDATE order_technical_revisions SET status='approved',approved_by=${a.userId},approved_at=now() WHERE id=${r.id} AND tenant_id=${a.tenantId}`;
    for (const standard of r.standard_configurations || [])
      await tx`UPDATE order_items SET product_configuration=${JSON.stringify(standard.configuration)}::text::jsonb WHERE order_id=${id} AND id=${standard.orderItemId} AND (product_configuration IS NULL OR product_configuration='null'::jsonb)`;
    const [lineCount] =
      await tx`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE jsonb_typeof(product_configuration)='object')::int AS configured FROM order_items WHERE order_id=${id}`;
    // No recipe on any line: the sheet's own cut list is the work order. A mix waits for a person.
    const fromSheet = lineCount.configured === 0;
    if (!fromSheet && lineCount.configured !== lineCount.total)
      fail(
        "Kalemlerin bir kısmında reçete var, bir kısmında yok; tüm kalemleri aynı şekilde yapılandırın",
      );
    if (fromSheet && !fresh.demand.length)
      fail("Föyde kesilecek profil bulunamadı");
    const created = fromSheet
      ? await createSheetJobs(tx, a, id, r.id, {
          family: r.family,
          color: fresh.color,
          cuts: fresh.demand,
          quantity: Math.max(1, r.technical.measures?.length || 1),
        })
      : await createJobsForConfiguredOrder(tx, a, id, r.id);
    if (created.pending.length)
      fail(created.pending.map((p) => p.reason).join("; "));
    const jobs =
      await tx`SELECT id,bom_snapshot FROM work_orders WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status<>'cancelled'`;
    if (!jobs.length) fail("Üretim planı oluşturulamadı");
    await tx`UPDATE work_orders SET technical_revision_id=${r.id} WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status<>'cancelled'`;
    if (issues.warnings.length)
      await tx`UPDATE order_technical_revisions SET technical=technical||${JSON.stringify({ acknowledged: { warnings: issues.warnings, by: a.userId, at: new Date().toISOString() } })}::text::jsonb WHERE tenant_id=${a.tenantId} AND id=${r.id}`;
    // Short stock does not hold production: the jobs wait in the cutting pool until bars arrive.
    const short = fresh.plan.groups.some(
      (g: any) => g.missing.length || g.tooLong.length,
    );
    if (short) {
      for (const job of jobs)
        await syncDailyStages(tx, a.tenantId, job.id, a.userId);
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorId: a.userId,
        entityType: "order",
        entityId: id,
        action: "technical_plan_approved",
        metadata: {
          technicalRevisionId: r.id,
          cutPlanId: null,
          waitingForStock: true,
          acknowledgedWarnings: issues.warnings,
        },
      });
      return {
        id: r.id,
        cutPlanId: null,
        waitingForStock: true,
        workOrders: created.created,
      };
    }
    const signature = (bars: any[]) =>
      stableJson(
        bars
          .map((b) => [
            b.id,
            b.length,
            b.cuts.sort((a: number, b: number) => a - b),
          ])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      );
    const expected = signature(
      r.plan.plan.groups.flatMap((g: any) =>
        g.bars.map((b: any) => ({
          id: b.lotId,
          length: b.sourceLengthMm,
          cuts: b.cuts.flatMap((c: any) => Array(c.count).fill(c.lengthMm)),
        })),
      ),
    );
    const cut = await planAndReserveCut(
      tx,
      a,
      jobs.map((j: any) => j.id),
      {
        key: "technical:" + r.id,
        // The estimate notice is one of the warnings the person acknowledged above.
        acceptEstimate: !!options.acknowledgeWarnings,
        suggestionId: r.id,
        verify: (draft) => {
          const actual = signature(
            draft.result.bars.map((b: any) => ({
              id: b.source.id,
              length: b.source.lengthMm,
              cuts: b.pieces.map((p: any) => p.lengthMm),
            })),
          );
          if (actual !== expected)
            fail(
              "Ürün reçetesinin kesimleri föydeki planla aynı değil; standart parçaları ve föyü teknik kontrolden geçirin",
            );
        },
      },
    );
    // Approving the cut created the production parts of these jobs.
    for (const job of jobs)
      await syncDailyStages(tx, a.tenantId, job.id, a.userId);
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "order",
      entityId: id,
      action: "technical_plan_approved",
      metadata: {
        technicalRevisionId: r.id,
        cutPlanId: cut.id,
        acknowledgedWarnings: issues.warnings,
      },
    });
    return {
      id: r.id,
      cutPlanId: cut.id,
      waitingForStock: false,
      workOrders: created.created,
    };
  });
  if (outcome.workOrders?.length)
    await notifyWorkOrdersAssigned(a.tenantId, outcome.workOrders, a.userId);
  return outcome;
}

/**
 * A plan released while stock was short leaves its jobs waiting for cutting. Once bars arrive this
 * plans and reserves those jobs' cuts from current stock; when stock is still short it says what.
 */
export async function planTechnicalCut(
  a: WorkOrderActor,
  id: string,
  commandId: string,
) {
  await needTechnical(a, true, true);
  z.uuid().parse(id);
  z.uuid().parse(commandId);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    await requireCommercialApproval(tx, a.tenantId, id);
    const [revision] =
      await tx`SELECT id FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} AND status='approved' ORDER BY revision DESC LIMIT 1`;
    if (!revision) fail("Önce teknik planı onaylayın");
    const jobs =
      await tx`SELECT id FROM work_orders WHERE tenant_id=${a.tenantId} AND order_id=${id} AND technical_revision_id=${revision.id} AND status IN('open','in_progress') AND cut_plan_id IS NULL`;
    if (!jobs.length) fail("Kesim bekleyen iş yok");
    const cut = await planAndReserveCut(
      tx,
      a,
      jobs.map((j: any) => j.id),
      // Whoever releases the order already acknowledged the plan's estimate notes.
      { key: "technical-cut:" + commandId, acceptEstimate: true, suggestionId: revision.id },
    );
    for (const job of jobs)
      await syncDailyStages(tx, a.tenantId, job.id, a.userId);
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "order",
      entityId: id,
      action: "technical_cut_planned",
      metadata: { technicalRevisionId: revision.id, cutPlanId: cut.id },
    });
    return { id: revision.id, cutPlanId: cut.id };
  });
}

export async function rejectTechnicalRevision(
  a: WorkOrderActor,
  id: string,
  revisionId: string,
) {
  await needTechnical(a, true, true);
  z.uuid().parse(id);
  z.uuid().parse(revisionId);
  return withTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [r] =
      await tx`SELECT * FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND order_id=${id} AND id=${revisionId} FOR UPDATE`;
    if (!r || !r.replaces_id || r.status !== "draft")
      fail("Açık kontrollü revizyon bulunamadı");
    const [base] =
      await tx`SELECT status,impact FROM order_technical_revisions WHERE tenant_id=${a.tenantId} AND id=${r.replaces_id}`;
    if (base?.status !== "blocked") fail("Önceki teknik sürüm değişti");
    if (base.impact?.orderChangeId)
      fail(
        "Sipariş ölçüleri değişti; eski teknik sürüme dönmek için sipariş değişikliği ayrıca geri alınmalı",
      );
    await tx`UPDATE order_technical_revisions SET status='superseded' WHERE tenant_id=${a.tenantId} AND id=${r.id}`;
    await tx`UPDATE order_technical_revisions SET status='approved' WHERE tenant_id=${a.tenantId} AND id=${r.replaces_id}`;
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: "order",
      entityId: id,
      action: "technical_revision_rejected",
      metadata: { technicalRevisionId: r.id, resumedRevisionId: r.replaces_id },
    });
    return { id: r.replaces_id };
  });
}
