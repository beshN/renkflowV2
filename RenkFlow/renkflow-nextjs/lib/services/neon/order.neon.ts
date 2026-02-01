import { Order, NewOrderFormData } from '@/lib/types';
import { IOrderService, TenantMismatchError } from '../types';
import { sql } from '@/lib/db/neon';
import { withTransaction } from '@/lib/db/transaction';
import { uploadFile, deleteFile, generateFilePath, getFileUrl } from '@/lib/storage/r2';

/**
 * Neon + R2 Order Service
 * Production-ready implementation using Neon DB and R2 Storage
 */
export class NeonOrderService implements IOrderService {

  private async cleanupUploadedFiles(uploadedFiles: { key: string }[]) {
    for (const file of uploadedFiles) {
      try {
        await deleteFile(file.key);
      } catch (error) {
        console.error('Error cleaning up uploaded file:', file.key, error);
      }
    }
  }
  
  async getOrders(tenantId: string): Promise<Order[]> {
    console.log('[NeonOrderService] getOrders called for tenant:', tenantId);

    const result = await sql`
      SELECT 
        o.*,
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

    const orders = await Promise.all(result.map(async (row: any) => {
      // Generate signed URLs for documents
      const documents = await Promise.all((row.documents || []).map(async (doc: any) => ({
        id: doc.id,
        name: doc.name,
        url: doc.file_path ? await getFileUrl(doc.file_path) : '',
        size: doc.size,
        uploadedAt: doc.uploadedAt
      })));

      return {
        id: row.id,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        email: row.email,
        phone: row.phone,
        date: new Date(row.created_at).toISOString().split('T')[0],
        deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().split('T')[0] : undefined,
        totalAmount: parseFloat(row.total_amount),
        currency: row.currency,
        status: row.status,
        productName: row.product_name,
        quantity: row.quantity,
        notes: row.notes,
        documents: documents,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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

    if (tenantCheck.length === 0) return null;
    if (tenantCheck[0].tenant_id !== tenantId) {
      throw new TenantMismatchError();
    }

    const result = await sql`
      SELECT 
        o.*,
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

    if (result.length === 0) return null;

    const row = result[0];
    
    // Generate signed URLs for documents
    const documents = await Promise.all((row.documents || []).map(async (doc: any) => ({
      id: doc.id,
      name: doc.name,
      url: doc.file_path ? await getFileUrl(doc.file_path) : '',
      size: doc.size,
      uploadedAt: doc.uploadedAt
    })));

    return {
      id: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      email: row.email,
      phone: row.phone,
      date: new Date(row.created_at).toISOString().split('T')[0],
      deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().split('T')[0] : undefined,
      totalAmount: parseFloat(row.total_amount),
      currency: row.currency,
      status: row.status,
      productName: row.product_name,
      quantity: row.quantity,
      notes: row.notes,
      documents: documents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createOrder(tenantId: string, formData: NewOrderFormData, files?: File[]): Promise<Order> {
    console.log('[NeonOrderService] createOrder called', {
      tenantId,
      customerName: formData.customerName,
      productName: formData.productName,
      filesCount: files?.length || 0
    });

    // Generate unique order number
    const orderNumber = `ORD${Date.now()}`;
    const uploadedFiles: { key: string }[] = [];

    try {
      const orderId = await withTransaction(async (tx) => {
        console.log('[NeonOrderService] Starting transaction for order creation');
        
        const orderResult = await tx.sql`
          INSERT INTO orders (
            order_number, customer_name, email, phone, 
            status, total_amount, currency, delivery_date, 
            notes, product_name, quantity, tenant_id
          )
          VALUES (
            ${orderNumber}, ${formData.customerName}, ${formData.email || null}, ${formData.phone || null},
            'pending', ${formData.totalAmount}, ${formData.currency || '₺'}, ${formData.deliveryDate || null},
            ${formData.notes || null}, ${formData.productName}, ${formData.quantity}, ${tenantId}
          )
          RETURNING id
        `;

        const orderId = orderResult[0]?.id as string | undefined;
        if (!orderId) {
          console.error('[NeonOrderService] Order creation failed - no ID returned');
          throw new Error('Order creation failed');
        }

        console.log('[NeonOrderService] Order created with ID:', orderId);

        if (files && files.length > 0) {
          console.log('[NeonOrderService] Uploading', files.length, 'files');
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
              const key = generateFilePath(orderId, file.name);
              const arrayBuffer = await file.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);

              console.log('[NeonOrderService] Uploading file', i + 1, '/', files.length, ':', file.name);
              await uploadFile(key, buffer, file.type);
              uploadedFiles.push({ key });

              await tx.sql`
                INSERT INTO documents (order_id, name, file_path, size)
                VALUES (${orderId}, ${file.name}, ${key}, ${file.size})
              `;
              console.log('[NeonOrderService] File uploaded successfully:', file.name);
            } catch (fileError) {
              console.error('[NeonOrderService] File upload failed for:', file.name, fileError);
              // Don't fail the entire order if file upload fails - just log it
              // throw fileError; // Comment this out to allow order creation even if files fail
            }
          }
        }

        return orderId;
      }, { timeout: 60000 }); // Increase timeout to 60s for file uploads

      console.log('[NeonOrderService] Transaction committed successfully');
      return this.getOrderById(tenantId, orderId) as Promise<Order>;
    } catch (error) {
      console.error('[NeonOrderService] createOrder failed:', {
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

    console.log('[NeonOrderService] Updating order:', id, 'for tenant:', tenantId, 'Updates:', Object.keys(updates));
    
    if (setClauses.length > 0) {
      values.push(id);
      values.push(tenantId);
      
      const query = `UPDATE orders SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`;
      
      console.log('[NeonOrderService] Update Query:', query);
      console.log('[NeonOrderService] Update Values:', values);

      // Ensure we only update if tenant_id matches
      const result = await sql(query, values);
      
      if (result.length === 0) {
        throw new Error('Order update failed: Order not found');
      }
      
      // Update successful, return the new data
      // We still re-fetch to get documents and joined data if needed, or we can just map the result
      return this.getOrderById(tenantId, id) as Promise<Order>;
    }

    return this.getOrderById(tenantId, id) as Promise<Order>;
  }

  async updateOrderStatus(tenantId: string, id: string, status: Order['status']): Promise<Order> {
    // Ensure order belongs to tenant (throws TenantMismatchError on cross-tenant)
    const existingOrder = await this.getOrderById(tenantId, id);
    if (!existingOrder) throw new Error('Order not found');

    await sql`
      UPDATE orders 
      SET status = ${status}, updated_at = NOW() 
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    return this.getOrderById(tenantId, id) as Promise<Order>;
  }

  async deleteOrder(tenantId: string, id: string): Promise<void> {
    // Verify ownership first (throws TenantMismatchError on cross-tenant)
    const existingOrder = await this.getOrderById(tenantId, id);
    if (!existingOrder) throw new Error('Order not found');

    // Get documents to delete from R2
    const docs = await sql`
      SELECT file_path FROM documents WHERE order_id = ${id}
    `;

    // Delete from R2
    for (const doc of docs) {
      try {
        await deleteFile(doc.file_path);
      } catch (error) {
        console.error('Error deleting file from R2:', error);
      }
    }

    // Delete order (documents will cascade)
    // Extra safety: enforce tenant_id check
    const deleteResult = await sql`DELETE FROM orders WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id`;
    
    if (deleteResult.length === 0) {
       throw new Error('Delete failed: Order not found');
    }
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
            const key = generateFilePath(id, file.name);
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await uploadFile(key, buffer, file.type);
            uploadedFiles.push({ key });

            await tx.sql`
              INSERT INTO documents (order_id, name, file_path, size)
              VALUES (${id}, ${file.name}, ${key}, ${file.size})
            `;
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
