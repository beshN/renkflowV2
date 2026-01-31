import { Order, NewOrderFormData } from '@/lib/types';
import { IOrderService } from '../types';
import { sql } from '@/lib/db/neon';
import { withTransaction } from '@/lib/db/transaction';
import { uploadFile, deleteFile, generateFilePath, getFileUrl } from '@/lib/storage/r2';
import { auth } from '@/auth';

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
  
  private async getTenantId(): Promise<string> {
    const session = await auth();
    if (!session?.user?.tenantId) {
      throw new Error('Unauthorized: No tenant ID found');
    }
    return session.user.tenantId;
  }

  async getOrders(): Promise<Order[]> {
    const tenantId = await this.getTenantId();
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

  async getOrderById(id: string): Promise<Order | null> {
    const tenantId = await this.getTenantId();

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

  async createOrder(formData: NewOrderFormData, files?: File[]): Promise<Order> {
    const tenantId = await this.getTenantId();

    // Generate unique order number
    const orderNumber = `ORD${Date.now()}`;
    const uploadedFiles: { key: string }[] = [];

    try {
      const orderId = await withTransaction(async (tx) => {
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
          throw new Error('Order creation failed');
        }

        if (files && files.length > 0) {
          for (const file of files) {
            const key = generateFilePath(orderId, file.name);
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await uploadFile(key, buffer, file.type);
            uploadedFiles.push({ key });

            await tx.sql`
              INSERT INTO documents (order_id, name, file_path, size)
              VALUES (${orderId}, ${file.name}, ${key}, ${file.size})
            `;
          }
        }

        return orderId;
      });

      return this.getOrderById(orderId) as Promise<Order>;
    } catch (error) {
      await this.cleanupUploadedFiles(uploadedFiles);
      throw error;
    }
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    const tenantId = await this.getTenantId();
    
    // First verification: Ensure order belongs to tenant
    const existingOrder = await this.getOrderById(id);
    if (!existingOrder) throw new Error('Order not found or access denied');

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
        throw new Error('Order update failed: Order not found or access denied (Tenant Mismatch)');
      }
      
      // Update successful, return the new data
      // We still re-fetch to get documents and joined data if needed, or we can just map the result
      return this.getOrderById(id) as Promise<Order>;
    }

    return this.getOrderById(id) as Promise<Order>;
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
    const tenantId = await this.getTenantId();

    await sql`
      UPDATE orders 
      SET status = ${status}, updated_at = NOW() 
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    return this.getOrderById(id) as Promise<Order>;
  }

  async deleteOrder(id: string): Promise<void> {
    const tenantId = await this.getTenantId();

    // Verify ownership first
    const existingOrder = await this.getOrderById(id);
    if (!existingOrder) throw new Error('Order not found or access denied');

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
       throw new Error('Delete failed: Order not found or access denied');
    }
  }
  async addDocuments(id: string, files: File[]): Promise<Order> {
    const tenantId = await this.getTenantId();

    // Verify ownership first
    const existingOrder = await this.getOrderById(id);
    if (!existingOrder) throw new Error('Order not found or access denied');

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

      return this.getOrderById(id) as Promise<Order>;
    } catch (error) {
      await this.cleanupUploadedFiles(uploadedFiles);
      throw error;
    }
  }
}
