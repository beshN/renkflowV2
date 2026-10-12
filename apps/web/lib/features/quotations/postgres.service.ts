import { requireVisualizationStorage, storeVisualization } from '@/lib/features/product-3d/storage';
import { WorkOrderApiError } from "@/lib/features/work-orders/security";
import { applyAwning } from "../awning/configuration";
import { createHash } from "node:crypto";
import { IQuotationService, Quotation, CreateQuotationInput, type ConversionResult } from "./types";
import { createJobsForConfiguredOrder } from "@/lib/features/manufacturing/platform.service";
import { notifyWorkOrdersAssigned } from "@/lib/notifications/service";
import { sql } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import { safeParseCurrency } from "@/lib/types";
import { recordAudit } from "@/lib/audit/audit-log";
import { AmbiguousCustomerError, resolveOrderCustomer } from "@/lib/features/customers/link";
import { columnExists } from "@/lib/db/schema-guard";
import { configureProduct } from "@/lib/features/products/configure.service";
import { configuredLine, stableJson, type ConfigurationChoice, type ProductConfiguration } from "@/lib/features/products/configuration";
import { addDays, effectiveDiscountPercent, needsDiscountApproval, quoteTotals, sendBlocker } from "@/lib/features/sales/engine";
import { applyCustomerPrices, expireDueQuotes, getQuoteSettings, salesAvailable } from "@/lib/features/sales/quotes.server";
import { istanbulToday } from "@/lib/features/sales/order-status.server";

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Configured lines are rebuilt from the published recipe and the price matrix unless the browser
 * sends back exactly what is stored for the line in the same currency; the browser's own bill of
 * materials and price are never trusted. So editing a note neither re-prices a quote nor fails
 * because a colour has since left stock, while a recalculated configuration is priced afresh. A line the matrix does not price keeps the
 * seller's typed price, which must then be given (a former matrix price does not count as typed).
 */
async function resolveConfiguredItems(
  tenantId: string,
  currency: string,
  items: CreateQuotationInput["items"],
  stored: CreateQuotationInput["items"] = [],
) {
  if (!items.some((i) => i.productConfiguration)) return items;
  if (!(await columnExists("quotation_items", "product_configuration")))
    throw new WorkOrderApiError("Ürün yapılandırma bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)", 409);
  const kept = new Map<string, ProductConfiguration>();
  for (const old of stored) {
    const c = old.productConfiguration as ProductConfiguration | undefined;
    if (c?.price?.currency === currency) kept.set(stableJson(c), c);
  }
  const memo = new Map<string, Promise<any>>();
  const resolved: CreateQuotationInput["items"] = [];
  for (const [index, item] of items.entries()) {
    if (!item.productConfiguration) {
      resolved.push(item);
      continue;
    }
    const sent = item.productConfiguration as Partial<ProductConfiguration> & ConfigurationChoice;
    const c = kept.get(stableJson(sent)) ?? (await configureProduct(sql, tenantId, currency, sent, memo));
    if (c.price.source === "manual") {
      const formerMatrixPrice = sent.price?.source === "matrix" && item.unitPrice === sent.price.matrixUnitPrice;
      if (!(item.unitPrice > 0) || formerMatrixPrice)
        throw new WorkOrderApiError(`Kalem ${index + 1}: ${c.price.message}; birim fiyatı elle girin`, 400);
    }
    resolved.push(configuredLine(item, c, item.unitPrice));
  }
  return resolved;
}

export function quotationTotals(
  items: CreateQuotationInput["items"],
  discountPercent = 0,
  vatPercent = 20,
) {
  return quoteTotals(items, discountPercent, vatPercent);
}
export class PostgresQuotationService implements IQuotationService {
  async getQuotations(tenantId: string) {
    const rows =
      await sql`SELECT * FROM quotations WHERE tenant_id=${tenantId} ORDER BY created_at DESC`;
    return rows.map((r: any) => this.map(r, []));
  }
  async getQuotationById(
    tenantId: string,
    id: string,
  ): Promise<Quotation | null> {
    const rows =
      await sql`SELECT * FROM quotations WHERE tenant_id=${tenantId} AND id=${id}`;
    if (!rows[0]) return null;
    const items =
      await sql`SELECT * FROM quotation_items WHERE tenant_id=${tenantId} AND quotation_id=${id} ORDER BY position,id`;
    return this.map(rows[0], items);
  }
  private async insertItems(
    tx: any,
    tenantId: string,
    id: string,
    items: CreateQuotationInput["items"],
  ) {
    await requireVisualizationStorage("quotation_items",items);
    const configurable = await columnExists("quotation_items", "product_configuration");
    for (const [position, rawItem] of items.entries()) {
      const i = rawItem.awningConfiguration
        ? applyAwning(rawItem, rawItem.awningConfiguration)
        : rawItem;
      if (configurable) {
        const [visualLine] = await tx`INSERT INTO quotation_items (tenant_id,quotation_id,product_name,description,color,width_mm,height_mm,projection_mm,mounting_height_mm,awning_configuration,awning_preview,quantity,unit_price,discount_percent,total_price,notes,position,product_configuration)
   VALUES (${tenantId},${id},${i.productName},${i.description || null},${i.color || null},${i.widthMm || null},${i.heightMm || null},${i.projectionMm || null},${i.mountingHeightMm || null},${i.awningConfiguration ? JSON.stringify(i.awningConfiguration) : null}::text::jsonb,${i.awningPreview || null},${i.quantity},${i.unitPrice},${i.discountPercent},${money(i.quantity * i.unitPrice * (1 - i.discountPercent / 100))},${i.notes || null},${position},${i.productConfiguration ? JSON.stringify(i.productConfiguration) : null}::text::jsonb) RETURNING id`;
        await storeVisualization(tx,"quotation_items",tenantId,visualLine.id,i.productVisualization);
        continue;
      }
      const [visualLine] = await tx`INSERT INTO quotation_items (tenant_id,quotation_id,product_name,description,color,width_mm,height_mm,projection_mm,mounting_height_mm,awning_configuration,awning_preview,quantity,unit_price,discount_percent,total_price,notes,position)
   VALUES (${tenantId},${id},${i.productName},${i.description || null},${i.color || null},${i.widthMm || null},${i.heightMm || null},${i.projectionMm || null},${i.mountingHeightMm || null},${i.awningConfiguration ? JSON.stringify(i.awningConfiguration) : null}::text::jsonb,${i.awningPreview || null},${i.quantity},${i.unitPrice},${i.discountPercent},${money(i.quantity * i.unitPrice * (1 - i.discountPercent / 100))},${i.notes || null},${position}) RETURNING id`;
      await storeVisualization(tx,"quotation_items",tenantId,visualLine.id,i.productVisualization);
    }
  }
  async createQuotation(
    tenantId: string,
    data: CreateQuotationInput,
    createdBy?: string,
  ) {
    const { idempotencyKey, expectedVersion: _version, ...content } = data;
    const hash = createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex");
    data = { ...data, items: await resolveConfiguredItems(tenantId, data.currency, data.items) };
    const depth = await salesAvailable();
    const settings = depth ? await getQuoteSettings(tenantId) : null;
    if (depth && data.applyCustomerPrices && data.customerId) data = { ...data, items: await applyCustomerPrices(tenantId, data.customerId, data.items) };
    // Before migration 041 there is nowhere to keep another rate: the quote stays at 20 %.
    const vatPercent = depth ? data.vatPercent ?? settings?.defaultVatPercent ?? 20 : 20;
    const totals = quotationTotals(data.items, data.discountPercent, vatPercent);
    const id = await withTransaction(async ({ sql: tx }) => {
      if (idempotencyKey) {
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":quote:" + idempotencyKey},0))`;
        const [old] =
          await tx`SELECT id,creation_hash,created_by FROM quotations WHERE tenant_id=${tenantId} AND creation_key=${idempotencyKey}`;
        if (old) {
          if (
            old.creation_hash !== hash ||
            old.created_by !== (createdBy || null)
          )
            throw new WorkOrderApiError("Tekrar anahtarı farklı teklif için kullanılamaz", 409);
          return old.id;
        }
      }
      if (
        data.customerId &&
        !(
          await tx`SELECT id FROM customers WHERE tenant_id=${tenantId} AND id=${data.customerId}`
        ).length
      )
        throw new WorkOrderApiError("Müşteri bulunamadı", 409);
      const rows =
        await tx`INSERT INTO quotations (tenant_id,quotation_number,customer_id,customer_name,valid_until,currency,discount_percent,subtotal,discount_amount,tax_amount,total_amount,notes,internal_notes,terms_and_conditions,created_by,creation_key,creation_hash)
     VALUES (${tenantId},${"TEK-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 6)},${data.customerId || null},${data.customerName},${data.validUntil || null},${data.currency},${data.discountPercent},${totals.subtotal},${totals.discountAmount},${totals.taxAmount},${totals.totalAmount},${data.notes || null},${data.internalNotes || null},${data.termsAndConditions || null},${createdBy || null},${idempotencyKey || null},${idempotencyKey ? hash : null}) RETURNING id`;
      if (depth) await tx`UPDATE quotations SET vat_percent=${vatPercent}, fx_rate=${data.currency === "TRY" ? null : data.fxRate ?? null} WHERE id=${rows[0].id}`;
      await this.insertItems(tx, tenantId, rows[0].id, data.items);
      // After the replay check: a repeated idempotency key returns above without a second record.
      await recordAudit(tx, { tenantId, actorId: createdBy, entityType: "quotation", entityId: rows[0].id, action: "created", metadata: { customerName: data.customerName, items: data.items.length } });
      return rows[0].id;
    });
    return (await this.getQuotationById(tenantId, id))!;
  }
  async updateQuotation(
    tenantId: string,
    id: string,
    updates: Partial<CreateQuotationInput>,
  ) {
    await withTransaction(async ({ sql: tx }) => {
      const rows =
        await tx`SELECT * FROM quotations WHERE tenant_id=${tenantId} AND id=${id} FOR UPDATE`;
      if (!rows[0]) throw new WorkOrderApiError("Teklif bulunamadı", 409);
      if (
        updates.expectedVersion !== undefined &&
        rows[0].version !== updates.expectedVersion
      )
        throw new WorkOrderApiError("Teklif başka cihazda değişti. Güncel kaydı açın.", 409);
      if (rows[0].status !== "draft")
        throw new WorkOrderApiError("Yalnız taslak teklifler düzenlenebilir", 409);
      const oldItems =
        await tx`SELECT * FROM quotation_items WHERE tenant_id=${tenantId} AND quotation_id=${id} ORDER BY position`;
      const old = this.map(rows[0], oldItems),
        data = { ...old, ...updates };
      // A changed currency re-prices configured lines too: the matrix price is only used in its own currency.
      if (updates.items || (updates.currency && updates.currency !== old.currency))
        data.items = await resolveConfiguredItems(tenantId, data.currency, updates.items ?? data.items, old.items);
      const depth = await salesAvailable();
      const vatPercent = depth ? (updates.vatPercent ?? Number(rows[0].vat_percent ?? 20)) : 20;
      const totals = quotationTotals(data.items, data.discountPercent, vatPercent);
      if (updates.customerId) {
        const customers =
          await tx`SELECT id FROM customers WHERE tenant_id=${tenantId} AND id=${updates.customerId}`;
        if (!customers[0]) throw new WorkOrderApiError("Müşteri bulunamadı", 409);
      }
      await tx`UPDATE quotations SET customer_name=${data.customerName},customer_id=${data.customerId || null},valid_until=${data.validUntil || null},currency=${data.currency},discount_percent=${data.discountPercent},subtotal=${totals.subtotal},discount_amount=${totals.discountAmount},tax_amount=${totals.taxAmount},total_amount=${totals.totalAmount},notes=${data.notes || null},internal_notes=${data.internalNotes || null},terms_and_conditions=${data.termsAndConditions || null},version=version+1,updated_at=now() WHERE tenant_id=${tenantId} AND id=${id}`;
      if (depth) {
        const fx = data.currency === "TRY" ? null : updates.fxRate !== undefined ? updates.fxRate : rows[0].fx_rate;
        await tx`UPDATE quotations SET vat_percent=${vatPercent}, fx_rate=${fx ?? null} WHERE tenant_id=${tenantId} AND id=${id}`;
      }
      if (updates.items || data.items !== old.items) {
        await tx`DELETE FROM quotation_items WHERE tenant_id=${tenantId} AND quotation_id=${id}`;
        await this.insertItems(tx, tenantId, id, data.items);
      }
    });
    return (await this.getQuotationById(tenantId, id))!;
  }
  async updateStatus(
    tenantId: string,
    id: string,
    status: Quotation["status"],
    expectedVersion?: number,
    actorId?: string,
    actorRole?: string,
  ) {
    if (status === "converted")
      throw new WorkOrderApiError("Siparişe dönüşüm komutunu kullanın", 409);
    const allowed: Record<string, string[]> = {
      draft: ["sent"],
      sent: ["accepted", "rejected", "expired"],
      accepted: [],
      rejected: [],
      expired: [],
    };
    const depth = await salesAvailable();
    // A sent quote whose date has passed is expired before anyone may accept it.
    if (depth) await expireDueQuotes(tenantId);
    await withTransaction(async ({ sql: tx }) => {
      const rows =
        await tx`SELECT * FROM quotations WHERE tenant_id=${tenantId} AND id=${id} FOR UPDATE`;
      if (!rows[0]) throw new WorkOrderApiError("Teklif bulunamadı", 409);
      if (expectedVersion !== undefined && rows[0].version !== expectedVersion)
        throw new WorkOrderApiError("Teklif başka cihazda değişti. Güncel kaydı açın.", 409);
      if (rows[0].status === status) return;
      if (!allowed[rows[0].status]?.includes(status))
        throw new WorkOrderApiError(rows[0].status === "expired" ? "Teklifin süresi doldu; revize edip yeniden gönderin" : "Bu durum geçişi yapılamaz", 409);
      if (depth && status === "sent") await this.checkSend(tx, tenantId, rows[0], actorId, actorRole);
      await tx`UPDATE quotations SET status=${status},version=version+1,updated_at=now() WHERE tenant_id=${tenantId} AND id=${id}`;
      await recordAudit(tx, { tenantId, actorId, entityType: "quotation", entityId: id, action: "status_changed", changes: { status: { from: rows[0].status, to: status } } });
    });
    return (await this.getQuotationById(tenantId, id))!;
  }
  async convertToOrder(
    tenantId: string,
    id: string,
    createdBy?: string,
    expectedVersion?: number,
    actorRole?: string,
  ): Promise<ConversionResult> {
    const result: ConversionResult = await withTransaction(async ({ sql: tx }) => {
      // The firm's production lock first, as production commands take it, before any row: converting
      // may open work orders, and the same order of locks cannot deadlock with a production command.
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId},0))`;
      const rows =
        await tx`SELECT * FROM quotations WHERE tenant_id=${tenantId} AND id=${id} FOR UPDATE`;
      const q = rows[0];
      if (!q) throw new WorkOrderApiError("Teklif bulunamadı", 409);
      if (q.status === "converted")
        return { orderId: q.converted_to_order_id as string };
      if (expectedVersion !== undefined && q.version !== expectedVersion)
        throw new WorkOrderApiError("Teklif başka cihazda değişti. Güncel kaydı açın.", 409);
      if (!["draft", "sent", "accepted"].includes(q.status))
        throw new WorkOrderApiError("Bu teklif siparişe dönüştürülemez", 409);
      const items =
        await tx`SELECT * FROM quotation_items WHERE tenant_id=${tenantId} AND quotation_id=${id} ORDER BY position`;
      if (!items.length) throw new WorkOrderApiError("Teklif kalemi gerekli", 409);
      if (await salesAvailable()) {
        // An accepted quote stays good after its date (the customer said yes in time); an open one does not.
        if (q.status !== "accepted" && q.valid_until && new Date(q.valid_until).toISOString().slice(0, 10) < istanbulToday())
          throw new WorkOrderApiError("Teklifin süresi doldu; revize edip yeniden gönderin", 409);
        const settings = await getQuoteSettings(tenantId);
        const effective = effectiveDiscountPercent(items.map((i: any) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unit_price), discountPercent: Number(i.discount_percent) })), Number(q.discount_percent));
        if (!["owner", "admin"].includes(actorRole ?? "") && needsDiscountApproval(effective, settings.discountApprovalPercent, q.discount_approved_percent == null ? null : Number(q.discount_approved_percent)))
          throw new WorkOrderApiError(`İndirim %${effective} firma eşiği %${settings.discountApprovalPercent} üzerinde; önce yönetici onayı gerekli`, 409);
      }
      // K6: a quotation typed without a customer card still yields a linked order; when several cards
      // share its name there is no one to ask here, so the order stays unlinked rather than guessed.
      let customerId: string | null = q.customer_id;
      if (!customerId && q.customer_name?.trim()) {
        try {
          customerId = (await resolveOrderCustomer(tx, tenantId, { customerName: q.customer_name }, createdBy)).id;
        } catch (error) {
          if (!(error instanceof AmbiguousCustomerError)) throw error;
        }
        if (customerId) await tx`UPDATE quotations SET customer_id=${customerId} WHERE tenant_id=${tenantId} AND id=${id}`;
      }
      const orders =
        await tx`INSERT INTO orders (tenant_id,order_number,customer_id,customer_name,status,total_amount,currency,notes,custom_fields,assigned_to,product_name,quantity)
     VALUES (${tenantId},${"ORD-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 6)},${customerId},${q.customer_name},'pending',${q.total_amount},${q.currency},${"Tekliften dönüştürüldü: " + q.quotation_number},'{}',${createdBy || null},${items[0].product_name},${items.reduce((sum: number, i: any) => sum + Number(i.quantity), 0)}) RETURNING id`;
      // A configured line carries its recipe, bill of materials and price source onto the order.
      await requireVisualizationStorage("order_items",items.map((i:any)=>({productVisualization:i.product_visualization})));
      const configured = await columnExists("order_items", "product_configuration");
      for (const i of items) {
        const [line] = await tx`INSERT INTO order_items (order_id,product_name,quantity,unit_price,total_price,description,color,width_mm,height_mm,projection_mm,mounting_height_mm,awning_configuration,awning_preview,motor_type,led_type,fabric_type,notes)
       VALUES (${orders[0].id},${i.product_name},${i.quantity},${i.unit_price},${i.total_price},${i.description},${i.color},${i.width_mm},${i.height_mm},${i.projection_mm},${i.mounting_height_mm},${i.awning_configuration ? JSON.stringify(i.awning_configuration) : null}::text::jsonb,${i.awning_preview},${i.awning_configuration?.motor || null},${i.awning_configuration?.led || null},${i.awning_configuration?.fabricName || null},${i.notes}) RETURNING id`;
        await storeVisualization(tx,"order_items",tenantId,line.id,i.product_visualization);
        if (configured && i.product_configuration)
          await tx`UPDATE order_items SET product_configuration=${JSON.stringify(i.product_configuration)}::text::jsonb WHERE id=${line.id}`;
      }
      // Configured lines go straight to production: a work order each, whose cuts join the cutting pool.
      const production = await createJobsForConfiguredOrder(tx, { tenantId, userId: createdBy ?? "", role: (actorRole ?? "") as any }, orders[0].id);
      await tx`UPDATE quotations SET version=version+1,status='converted',converted_to_order_id=${orders[0].id},updated_at=now() WHERE tenant_id=${tenantId} AND id=${id}`;
      // Only a real conversion reaches here; a replay returned above without a second record.
      await recordAudit(tx, { tenantId, actorId: createdBy, entityType: "quotation", entityId: id, action: "converted", metadata: { quotationNumber: q.quotation_number, orderId: orders[0].id } });
      await recordAudit(tx, { tenantId, actorId: createdBy, entityType: "order", entityId: orders[0].id, action: "created", metadata: { fromQuotation: q.quotation_number, workOrders: production.created.length, pendingWorkOrders: production.pending.length } });
      // A quote without configured lines answers as before; a replay (above) answers with the order alone.
      if (!production.created.length && !production.pending.length) return { orderId: orders[0].id as string };
      return { orderId: orders[0].id as string, workOrders: production.created, pendingWorkOrders: production.pending };
    });
    // After the commit: the people given new work orders hear of it (not the person who just converted).
    if (result.workOrders?.length) await notifyWorkOrdersAssigned(tenantId, result.workOrders, createdBy);
    // Configured lines go straight to production at conversion: the material check runs here too.
    if (result.workOrders?.length || result.pendingWorkOrders?.length) {
      const { notifyShortageOnApproval } = await import("@/lib/features/stock/depth.server");
      await notifyShortageOnApproval(tenantId, result.orderId, createdBy ?? "");
    }
    return result;
  }
  async deleteQuotation(tenantId: string, id: string) {
    const rows =
      await sql`DELETE FROM quotations WHERE tenant_id=${tenantId} AND id=${id} AND status='draft' RETURNING id`;
    if (!rows[0]) throw new WorkOrderApiError("Yalnız taslak teklifler silinebilir", 409);
  }
  /**
   * Sending a quote: it needs lines and a validity date that has not passed (the firm's default
   * days when none is given), and a discount above the firm's threshold needs a manager's approval
   * (a manager sending it approves it by doing so, on the record).
   */
  private async checkSend(tx: any, tenantId: string, q: any, actorId?: string, actorRole?: string) {
    const settings = await getQuoteSettings(tenantId);
    const items = await tx`SELECT quantity,unit_price,discount_percent FROM quotation_items WHERE tenant_id=${tenantId} AND quotation_id=${q.id}`;
    const today = istanbulToday();
    const validUntil = q.valid_until ? new Date(q.valid_until).toISOString().slice(0, 10) : null;
    const blocker = sendBlocker({ validUntil, itemCount: items.length }, today);
    if (blocker) throw new WorkOrderApiError(blocker, 409);
    const effective = effectiveDiscountPercent(items.map((i: any) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unit_price), discountPercent: Number(i.discount_percent) })), Number(q.discount_percent));
    if (needsDiscountApproval(effective, settings.discountApprovalPercent, q.discount_approved_percent == null ? null : Number(q.discount_approved_percent))) {
      if (!["owner", "admin"].includes(actorRole ?? ""))
        throw new WorkOrderApiError(`İndirim %${effective} firma eşiği %${settings.discountApprovalPercent} üzerinde; yönetici onayı gerekli`, 409);
      await tx`UPDATE quotations SET discount_approved_percent=${effective}, discount_approved_by=${actorId ?? null}, discount_approved_at=now() WHERE tenant_id=${tenantId} AND id=${q.id}`;
      await recordAudit(tx, { tenantId, actorId, entityType: "quotation", entityId: q.id, action: "discount_approved", changes: { indirim: { from: null, to: effective } }, metadata: { threshold: settings.discountApprovalPercent, onSend: true } });
    }
    await tx`UPDATE quotations SET sent_at=now(), valid_until=${validUntil ?? addDays(today, settings.defaultValidDays)} WHERE tenant_id=${tenantId} AND id=${q.id}`;
  }
  private map(row: any, items: any[]): Quotation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      quotationNumber: row.quotation_number,
      version: row.version ?? 1,
      customerId: row.customer_id,
      customerName: row.customer_name,
      status: row.status,
      validUntil: row.valid_until
        ? new Date(row.valid_until).toISOString().slice(0, 10)
        : null,
      currency: safeParseCurrency(row.currency),
      discountPercent: Number(row.discount_percent),
      subtotal: Number(row.subtotal),
      discountAmount: Number(row.discount_amount),
      taxAmount: Number(row.tax_amount),
      totalAmount: Number(row.total_amount),
      notes: row.notes,
      internalNotes: row.internal_notes,
      termsAndConditions: row.terms_and_conditions,
      convertedToOrderId: row.converted_to_order_id,
      revision: row.revision ?? 1,
      vatPercent: row.vat_percent == null ? 20 : Number(row.vat_percent),
      fxRate: row.fx_rate == null ? null : Number(row.fx_rate),
      sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
      discountApprovedPercent: row.discount_approved_percent == null ? null : Number(row.discount_approved_percent),
      discountApprovedAt: row.discount_approved_at ? new Date(row.discount_approved_at).toISOString() : null,
      customerDecidedAt: row.customer_decided_at ? new Date(row.customer_decided_at).toISOString() : null,
      customerDecisionName: row.customer_decision_name ?? null,
      customerDecisionNote: row.customer_decision_note ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: items.map((i) => ({
        id: i.id,
        productName: i.product_name,
        description: i.description || undefined,
        color: i.color || undefined,
        widthMm: i.width_mm == null ? undefined : Number(i.width_mm),
        heightMm: i.height_mm == null ? undefined : Number(i.height_mm),
        projectionMm:
          i.projection_mm == null ? undefined : Number(i.projection_mm),
        mountingHeightMm:
          i.mounting_height_mm == null
            ? undefined
            : Number(i.mounting_height_mm),
        productVisualization: i.product_visualization || undefined,
        awningConfiguration: i.awning_configuration || undefined,
        awningPreview: i.awning_preview || undefined,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        discountPercent: Number(i.discount_percent),
        totalPrice: Number(i.total_price),
        notes: i.notes || undefined,
        productConfiguration: i.product_configuration || undefined,
      })),
    };
  }
}
