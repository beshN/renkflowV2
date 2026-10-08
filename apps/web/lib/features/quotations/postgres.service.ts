import { WorkOrderApiError } from "@/lib/features/work-orders/security";
import { applyAwning } from "../awning/configuration";
import { createHash } from "node:crypto";
import { IQuotationService, Quotation, CreateQuotationInput } from "./types";
import { sql } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import { safeParseCurrency } from "@/lib/types";
import { recordAudit } from "@/lib/audit/audit-log";
import { AmbiguousCustomerError, resolveOrderCustomer } from "@/lib/features/customers/link";
import { columnExists } from "@/lib/db/schema-guard";
import { configureProduct } from "@/lib/features/products/configure.service";
import { configuredLine, stableJson, type ConfigurationChoice, type ProductConfiguration } from "@/lib/features/products/configuration";

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
) {
  const subtotal = money(
    items.reduce(
      (sum, i) =>
        sum + money(i.quantity * i.unitPrice * (1 - i.discountPercent / 100)),
      0,
    ),
  );
  const discountAmount = money((subtotal * discountPercent) / 100),
    taxAmount = money((subtotal - discountAmount) * 0.2);
  return {
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount: money(subtotal - discountAmount + taxAmount),
  };
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
    const configurable = await columnExists("quotation_items", "product_configuration");
    for (const [position, rawItem] of items.entries()) {
      const i = rawItem.awningConfiguration
        ? applyAwning(rawItem, rawItem.awningConfiguration)
        : rawItem;
      if (configurable) {
        await tx`INSERT INTO quotation_items (tenant_id,quotation_id,product_name,description,color,width_mm,height_mm,projection_mm,mounting_height_mm,awning_configuration,awning_preview,quantity,unit_price,discount_percent,total_price,notes,position,product_configuration)
   VALUES (${tenantId},${id},${i.productName},${i.description || null},${i.color || null},${i.widthMm || null},${i.heightMm || null},${i.projectionMm || null},${i.mountingHeightMm || null},${i.awningConfiguration ? JSON.stringify(i.awningConfiguration) : null}::text::jsonb,${i.awningPreview || null},${i.quantity},${i.unitPrice},${i.discountPercent},${money(i.quantity * i.unitPrice * (1 - i.discountPercent / 100))},${i.notes || null},${position},${i.productConfiguration ? JSON.stringify(i.productConfiguration) : null}::text::jsonb)`;
        continue;
      }
      await tx`INSERT INTO quotation_items (tenant_id,quotation_id,product_name,description,color,width_mm,height_mm,projection_mm,mounting_height_mm,awning_configuration,awning_preview,quantity,unit_price,discount_percent,total_price,notes,position)
   VALUES (${tenantId},${id},${i.productName},${i.description || null},${i.color || null},${i.widthMm || null},${i.heightMm || null},${i.projectionMm || null},${i.mountingHeightMm || null},${i.awningConfiguration ? JSON.stringify(i.awningConfiguration) : null}::text::jsonb,${i.awningPreview || null},${i.quantity},${i.unitPrice},${i.discountPercent},${money(i.quantity * i.unitPrice * (1 - i.discountPercent / 100))},${i.notes || null},${position})`;
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
    const totals = quotationTotals(data.items, data.discountPercent);
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
      const totals = quotationTotals(data.items, data.discountPercent);
      if (updates.customerId) {
        const customers =
          await tx`SELECT id FROM customers WHERE tenant_id=${tenantId} AND id=${updates.customerId}`;
        if (!customers[0]) throw new WorkOrderApiError("Müşteri bulunamadı", 409);
      }
      await tx`UPDATE quotations SET customer_name=${data.customerName},customer_id=${data.customerId || null},valid_until=${data.validUntil || null},currency=${data.currency},discount_percent=${data.discountPercent},subtotal=${totals.subtotal},discount_amount=${totals.discountAmount},tax_amount=${totals.taxAmount},total_amount=${totals.totalAmount},notes=${data.notes || null},internal_notes=${data.internalNotes || null},terms_and_conditions=${data.termsAndConditions || null},version=version+1,updated_at=now() WHERE tenant_id=${tenantId} AND id=${id}`;
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
    await withTransaction(async ({ sql: tx }) => {
      const rows =
        await tx`SELECT status,version FROM quotations WHERE tenant_id=${tenantId} AND id=${id} FOR UPDATE`;
      if (!rows[0]) throw new WorkOrderApiError("Teklif bulunamadı", 409);
      if (expectedVersion !== undefined && rows[0].version !== expectedVersion)
        throw new WorkOrderApiError("Teklif başka cihazda değişti. Güncel kaydı açın.", 409);
      if (rows[0].status === status) return;
      if (!allowed[rows[0].status]?.includes(status))
        throw new WorkOrderApiError("Bu durum geçişi yapılamaz", 409);
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
  ) {
    return withTransaction(async ({ sql: tx }) => {
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
      const configured = await columnExists("order_items", "product_configuration");
      for (const i of items) {
        const [line] = await tx`INSERT INTO order_items (order_id,product_name,quantity,unit_price,total_price,description,color,width_mm,height_mm,projection_mm,mounting_height_mm,awning_configuration,awning_preview,motor_type,led_type,fabric_type,notes)
       VALUES (${orders[0].id},${i.product_name},${i.quantity},${i.unit_price},${i.total_price},${i.description},${i.color},${i.width_mm},${i.height_mm},${i.projection_mm},${i.mounting_height_mm},${i.awning_configuration ? JSON.stringify(i.awning_configuration) : null}::text::jsonb,${i.awning_preview},${i.awning_configuration?.motor || null},${i.awning_configuration?.led || null},${i.awning_configuration?.fabricName || null},${i.notes}) RETURNING id`;
        if (configured && i.product_configuration)
          await tx`UPDATE order_items SET product_configuration=${JSON.stringify(i.product_configuration)}::text::jsonb WHERE id=${line.id}`;
      }
      await tx`UPDATE quotations SET version=version+1,status='converted',converted_to_order_id=${orders[0].id},updated_at=now() WHERE tenant_id=${tenantId} AND id=${id}`;
      // Only a real conversion reaches here; a replay returned above without a second record.
      await recordAudit(tx, { tenantId, actorId: createdBy, entityType: "quotation", entityId: id, action: "converted", metadata: { quotationNumber: q.quotation_number, orderId: orders[0].id } });
      await recordAudit(tx, { tenantId, actorId: createdBy, entityType: "order", entityId: orders[0].id, action: "created", metadata: { fromQuotation: q.quotation_number } });
      return { orderId: orders[0].id as string };
    });
  }
  async deleteQuotation(tenantId: string, id: string) {
    const rows =
      await sql`DELETE FROM quotations WHERE tenant_id=${tenantId} AND id=${id} AND status='draft' RETURNING id`;
    if (!rows[0]) throw new WorkOrderApiError("Yalnız taslak teklifler silinebilir", 409);
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
