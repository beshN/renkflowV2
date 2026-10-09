import { verifiedFileKey } from "@/lib/storage/upload-reference";
import { applyOrderStatus } from '@/lib/features/sales/order-status.server';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { deleteUnlinkedOrder } from '../deletion.service';
import { recordAudit } from '@/lib/audit/audit-log';
import { resolveOrderCustomer } from '@/lib/features/customers/link';
import { applyAwning } from "../../awning/configuration";
import { Order, NewOrderFormData, safeParseCurrency } from '@/lib/types';
import { IOrderService, TenantMismatchError } from '../types';
import { sql } from '@/lib/db';
import { sqlQuery } from '@/lib/db';
import { withTransaction } from '@/lib/db/transaction';
import { uploadFile, deleteFile, generateFilePath, getFileUrl } from '@/lib/storage';

/**
 * PostgreSQL + GCS Order Service
 * Production-ready implementation using Cloud SQL and Google Cloud Storage
 */
export class PostgresOrderService implements IOrderService {
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  private async insertDocumentRecord(
    tx: { sql: typeof sql },
    params: {
      tenantId: string;
      orderId: string;
      name: string;
      filePath: string;
      fileType?: string;
      size: number;
    }
  ): Promise<void> {
    try {
      await tx.sql`
        INSERT INTO documents (tenant_id, order_id, name, file_path, file_type, size)
        VALUES (
          ${params.tenantId},
          ${params.orderId},
          ${params.name},
          ${params.filePath},
          ${params.fileType || null},
          ${params.size}
        )
      `;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canFallbackToLegacySchema =
        message.includes('column "tenant_id"') || message.includes('column "file_type"');

      if (!canFallbackToLegacySchema) {
        throw error;
      }

      await tx.sql`
        INSERT INTO documents (order_id, name, file_path, size)
        VALUES (${params.orderId}, ${params.name}, ${params.filePath}, ${params.size})
      `;
    }
  }

  private async cleanupUploadedFiles(uploadedFiles: { key: string }[]) {
    for (const file of uploadedFiles) {
      try {
        await deleteFile(file.key);
      } catch (error) {
        console.error('Error cleaning up uploaded file:', file.key, error);
      }
    }
  }

  private async resolveDocumentUrl(filePath: string | null | undefined): Promise<string> {
    if (!filePath) return '';
    if (filePath.startsWith('/api/v1/production/files/')) return filePath;
    try {
      return await getFileUrl(filePath);
    } catch (error) {
      console.warn('[PostgresOrderService] Document URL resolve fallback:', filePath, error);
      return filePath;
    }
  }
  
  async getOrders(tenantId: string): Promise<Order[]> {
    // console.log('[PostgresOrderService] getOrders called for tenant:', tenantId);

    const result = await sql`
      SELECT 
        o.*,
        EXISTS(SELECT 1 FROM work_orders w WHERE w.order_id=o.id AND w.tenant_id=o.tenant_id AND w.recipe_id IS NOT NULL) AS production_managed,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'file_path', d.file_path,
            'size', d.size,
            'uploadedAt', d.created_at
          )
        ) FILTER (WHERE d.id IS NOT NULL) as documents
      FROM orders o
      LEFT JOIN documents d ON o.id = d.order_id
      WHERE o.tenant_id = ${tenantId}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;

    if (!result) return [];
    const resultRows = result as any[];

    const orders = await Promise.all(resultRows.map(async (row: any) => {
      // Generate signed URLs for documents
      const documents = await Promise.all((row.documents || []).map(async (doc: any) => ({
        id: doc.id,
        name: doc.name,
        url: await this.resolveDocumentUrl(doc.file_path),
        size: doc.size,
        uploadedAt: doc.uploadedAt
      })));

        return {
          id: row.id,
          version: row.version,
      productionManaged: row.production_managed,
          orderNumber: row.order_number,
          customerName: row.customer_name,
          email: row.email,
          phone: row.phone,
          date: new Date(row.created_at).toISOString().split('T')[0],
          deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().split('T')[0] : undefined,
          totalAmount: parseFloat(row.total_amount),
          currency: safeParseCurrency(row.currency),
          status: row.status,
          productName: row.product_name,
          quantity: row.quantity,
          notes: row.notes,
          customFields: row.custom_fields || undefined,
          documents: documents,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
          updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };
    }));

    return orders;
  }

  async getOrderById(tenantId: string, id: string): Promise<Order | null> {
    // First: check if the order exists and belongs to the tenant.
    // This allows us to return 403 (tenant mismatch) vs 404 (not found).
    const tenantCheck = await sql`
      SELECT tenant_id FROM orders WHERE id = ${id} LIMIT 1
    `;

    const tenantCheckRows = tenantCheck as any[];
    if (tenantCheckRows.length === 0) return null;
    if (tenantCheckRows[0].tenant_id !== tenantId) {
      throw new TenantMismatchError();
    }

    const result = await sql`
      SELECT 
        o.*,
        EXISTS(SELECT 1 FROM work_orders w WHERE w.order_id=o.id AND w.tenant_id=o.tenant_id AND w.recipe_id IS NOT NULL) AS production_managed,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'file_path', d.file_path,
            'size', d.size,
            'uploadedAt', d.created_at
          )
        ) FILTER (WHERE d.id IS NOT NULL) as documents
      FROM orders o
      LEFT JOIN documents d ON o.id = d.order_id
      WHERE o.id = ${id} AND o.tenant_id = ${tenantId}
      GROUP BY o.id
    `;

    const resultRows = result as any[];
    if (resultRows.length === 0) return null;

    const row = resultRows[0];
    const itemRows = await sql`SELECT * FROM order_items WHERE order_id = ${id} ORDER BY created_at, id`;
    const items = itemRows.map((i:any) => ({id:i.id,productName:i.product_name,quantity:Number(i.quantity),unitPrice:Number(i.unit_price),totalPrice:Number(i.total_price),color:i.color,widthMm:i.width_mm==null?null:Number(i.width_mm),heightMm:i.height_mm==null?null:Number(i.height_mm),projectionMm:i.projection_mm==null?null:Number(i.projection_mm),mountingHeightMm:i.mounting_height_mm==null?null:Number(i.mounting_height_mm),awningConfiguration:i.awning_configuration,awningPreview:i.awning_preview,motorType:i.motor_type,ledType:i.led_type,fabricType:i.fabric_type,notes:i.notes,customParameters:i.custom_parameters || {},quantityUnit:i.quantity_unit || "adet"}));
    
    // Generate signed URLs for documents
    const documents = await Promise.all((row.documents || []).map(async (doc: any) => ({
      id: doc.id,
      name: doc.name,
      url: await this.resolveDocumentUrl(doc.file_path),
      size: doc.size,
      uploadedAt: doc.uploadedAt
    })));

    return {
      items,
      id: row.id,
      version: row.version,
      productionManaged: row.production_managed,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      email: row.email,
      phone: row.phone,
      date: new Date(row.created_at).toISOString().split('T')[0],
      deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().split('T')[0] : undefined,
      totalAmount: parseFloat(row.total_amount),
      currency: safeParseCurrency(row.currency),
      status: row.status,
      productName: row.product_name,
      quantity: row.quantity,
      notes: row.notes,
      customFields: row.custom_fields || undefined,
      documents: documents,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }

  /** The audit record is written in the same transaction as the order (actor null if unknown). */
  async createOrder(tenantId: string, formData: NewOrderFormData, files?: File[], actorId?: string): Promise<Order> {
    // console.log('[PostgresOrderService] createOrder called', { tenantId, ... });

    // Generate unique order number
    const orderNumber = this.generateOrderNumber();
    const uploadedFiles: { key: string }[] = [];

    try {
      const orderId = await withTransaction(async (tx) => {
        // console.log('[PostgresOrderService] Starting transaction');
        
        // K6: every order is linked to a customer card (chosen, matched or created here).
        const customer = await resolveOrderCustomer(tx.sql, tenantId, formData, actorId);
        const orderResult = await tx.sql`
          INSERT INTO orders (
            order_number, customer_id, customer_name, email, phone, 
            status, total_amount, currency, delivery_date, 
            notes, product_name, quantity, tenant_id, custom_fields
          )
          VALUES (
            ${orderNumber}, ${customer.id}, ${formData.customerName}, ${formData.email || null}, ${formData.phone || null},
            'pending', ${formData.totalAmount}, ${safeParseCurrency(formData.currency) || 'TRY'}, ${formData.deliveryDate || null},
            ${formData.notes || null}, ${formData.productName}, ${formData.quantity}, ${tenantId},
            ${formData.customFields ? JSON.stringify(formData.customFields) : null}::text::jsonb
          )
          RETURNING id
        `;

        const orderId = orderResult[0]?.id as string | undefined;
        if (!orderId) {
          console.error('[PostgresOrderService] Order creation failed - no ID returned');
          throw new Error('Order creation failed');
        }

        if (formData.items && formData.items.length > 0) {
          for (const sourceItem of formData.items) {
            const item = sourceItem.awningConfiguration ? applyAwning(sourceItem, sourceItem.awningConfiguration) : sourceItem;
            await tx.sql`
              INSERT INTO order_items (
                order_id, product_name, quantity, unit_price, total_price,
                color, width_mm, height_mm, motor_type, led_type, fabric_type, notes, projection_mm, mounting_height_mm, awning_configuration, awning_preview, custom_parameters, quantity_unit
              )
              VALUES (
                ${orderId}, ${item.productName}, ${item.quantity}, ${item.unitPrice || 0}, ${item.totalPrice || 0},
                ${item.color || null}, ${item.widthMm || null}, ${item.heightMm || null}, 
                ${item.motorType || null}, ${item.ledType || null}, ${item.fabricType || null}, ${item.notes || null}, ${item.projectionMm || null}, ${item.mountingHeightMm || null}, ${item.awningConfiguration ? JSON.stringify(item.awningConfiguration) : null}::text::jsonb, ${item.awningPreview || null}, ${JSON.stringify(item.customParameters || {})}::text::jsonb, ${item.quantityUnit || "adet"}
              )
            `;
          }
        }

        // console.log('[PostgresOrderService] Order created with ID:', orderId);

        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
              const key = verifiedFileKey(file) || generateFilePath(orderId, file.name);
              const arrayBuffer = await file.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);

              if (!verifiedFileKey(file)) { await uploadFile(key, buffer, file.type); uploadedFiles.push({ key }); }

              await this.insertDocumentRecord(tx, {
                tenantId,
                orderId,
                name: file.name,
                filePath: key,
                fileType: file.type,
                size: file.size,
              });
              // console.log('[PostgresOrderService] File uploaded successfully:', file.name);
            } catch (fileError) {
              console.error('[PostgresOrderService] File upload failed for:', file.name, fileError);
              throw fileError;
            }
          }
        }

        await recordAudit(tx.sql, {
          tenantId,
          actorId: actorId ?? null,
          entityType: 'order',
          entityId: orderId,
          action: 'created',
          metadata: { orderNumber, items: formData.items?.length ?? 0, files: files?.length ?? 0 },
        });

        return orderId;
      }, { timeout: 60000 }); // Increase timeout to 60s for file uploads

      // console.log('[PostgresOrderService] Transaction committed successfully');
      return this.getOrderById(tenantId, orderId) as Promise<Order>;
    } catch (error) {
      console.error('[PostgresOrderService] createOrder failed:', {
        error: error instanceof Error ? error.message : String(error),
        orderNumber,
        tenantId,
        uploadedFilesCount: uploadedFiles.length
      });
      
      await this.cleanupUploadedFiles(uploadedFiles);
      throw error;
    }
  }

  async updateOrder(tenantId: string, id: string, updates: Partial<Order>): Promise<Order> {
    // Ensure order belongs to tenant (throws TenantMismatchError on cross-tenant)
    const existingOrder = await this.getOrderById(tenantId, id);
    if (!existingOrder) throw new Error('Order not found');

    const setClauses = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.customerName !== undefined) {
      setClauses.push(`customer_name = $${paramIndex++}`);
      values.push(updates.customerName);
    }
    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }
    if (updates.productName !== undefined) {
      setClauses.push(`product_name = $${paramIndex++}`);
      values.push(updates.productName);
    }
    if (updates.quantity !== undefined) {
      setClauses.push(`quantity = $${paramIndex++}`);
      values.push(updates.quantity);
    }
    if (updates.totalAmount !== undefined) {
      setClauses.push(`total_amount = $${paramIndex++}`);
      values.push(updates.totalAmount);
    }
    if (updates.currency !== undefined) {
      setClauses.push(`currency = $${paramIndex++}`);
      values.push(updates.currency);
    }
    if (updates.deliveryDate !== undefined) {
      setClauses.push(`delivery_date = $${paramIndex++}`);
      values.push(updates.deliveryDate);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }
    if (updates.customFields !== undefined) {
      setClauses.push(`custom_fields = $${paramIndex++}`);
      values.push(updates.customFields ? JSON.stringify(updates.customFields) : null);
    }

    // console.log('[PostgresOrderService] Updating order:', id);
    
    if (setClauses.length > 0) {
      values.push(id);
      values.push(tenantId);
      
      const query = `UPDATE orders SET ${setClauses.join(', ')}, version = version + 1, updated_at = NOW() WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`;
      
      // console.log('[PostgresOrderService] Update Query:', query);

      // Ensure we only update if tenant_id matches
      const result = await sqlQuery(query, values);
      
      if (result.length === 0) {
        throw new Error('Order update failed: Order not found');
      }
      
      // Update successful, return the new data
      // We still re-fetch to get documents and joined data if needed, or we can just map the result
      return this.getOrderById(tenantId, id) as Promise<Order>;
    }

    return this.getOrderById(tenantId, id) as Promise<Order>;
  }

  async updateOrderStatus(tenantId: string, id: string, status: string, options: { actorId?: string; note?: string } = {}): Promise<Order> {
    await withTransaction(async ({sql: tx}) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId},0))`;
      const [order] = await tx`SELECT status FROM orders WHERE id=${id} AND tenant_id=${tenantId} FOR UPDATE`;
      if (!order) throw new WorkOrderApiError('Sipariş bulunamadı',404);
      if ((await tx`SELECT id FROM work_orders WHERE tenant_id=${tenantId} AND order_id=${id} AND recipe_id IS NOT NULL LIMIT 1`).length)
        throw new WorkOrderApiError('Üretim durumunu ilgili operasyon ekranından değiştirin.',409);
      // The same state machine and reason rule as the transition endpoint (no side door).
      await applyOrderStatus(tx, { tenantId, orderId: id, from: order.status, to: status, actorId: options.actorId, note: options.note });
    });
    // As on the transition endpoint: an approved order is checked for missing material (best effort).
    if (status === 'approved') {
      const { notifyShortageOnApproval } = await import('@/lib/features/stock/depth.server');
      await notifyShortageOnApproval(tenantId, id, options.actorId ?? '');
    }
    return this.getOrderById(tenantId, id) as Promise<Order>;
  }

  async deleteOrder(tenantId: string, id: string, actorId?: string): Promise<void> {
    await deleteUnlinkedOrder(tenantId, id, actorId);
  }

  async addDocuments(tenantId: string, id: string, files: File[]): Promise<Order> {
    // Verify ownership first (throws TenantMismatchError on cross-tenant)
    const existingOrder = await this.getOrderById(tenantId, id);
    if (!existingOrder) throw new Error('Order not found');

    const uploadedFiles: { key: string }[] = [];

    try {
      if (files && files.length > 0) {
        await withTransaction(async (tx) => {
          for (const file of files) {
            const key = verifiedFileKey(file) || generateFilePath(id, file.name);
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (!verifiedFileKey(file)) { await uploadFile(key, buffer, file.type); uploadedFiles.push({ key }); }

            await this.insertDocumentRecord(tx, {
              tenantId,
              orderId: id,
              name: file.name,
              filePath: key,
              fileType: file.type,
              size: file.size,
            });
          }
        });
      }

      return this.getOrderById(tenantId, id) as Promise<Order>;
    } catch (error) {
      await this.cleanupUploadedFiles(uploadedFiles);
      throw error;
    }
  }
}
