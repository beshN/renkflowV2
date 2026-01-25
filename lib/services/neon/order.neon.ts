import { Order, NewOrderFormData, Document } from '@/lib/types';
import { IOrderService } from '../types';
import { sql } from '@/lib/db/neon';
import { uploadFile, deleteFile, generateFilePath, getFileUrl } from '@/lib/storage/r2';
import { auth } from '@/auth';

/**
 * Neon + R2 Order Service
 * Production-ready implementation using Neon DB and R2 Storage
 */
export class NeonOrderService implements IOrderService {
  
  private async getTenantId(): Promise<string> {
    const session = await auth();
    if (!session?.user?.tenantId) {
      throw new Error('Unauthorized: No tenant ID found');
    }
    return session.user.tenantId;
  }

  async getOrders(): Promise<Order[]> {
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
        customer: row.customer_name,
        email: row.email,
        phone: row.phone,
        date: new Date(row.created_at).toISOString().split('T')[0],
        deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().split('T')[0] : undefined,
        amount: parseFloat(row.total_amount),
        currency: row.currency,
        status: row.status,
        product: row.product_name,
        quantity: row.quantity,
        description: row.notes,
        documents: documents,
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
      customer: row.customer_name,
      email: row.email,
      phone: row.phone,
      date: new Date(row.created_at).toISOString().split('T')[0],
      deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().split('T')[0] : undefined,
      amount: parseFloat(row.total_amount),
      currency: row.currency,
      status: row.status,
      product: row.product_name,
      quantity: row.quantity,
      description: row.notes,
      documents: documents,
    };
  }

  async createOrder(formData: NewOrderFormData, files?: File[]): Promise<Order> {
    const tenantId = await this.getTenantId();

    // Generate unique order number
    const orderNumber = `ORD${Date.now()}`;

    // Insert order with tenant_id
    const orderResult = await sql`
      INSERT INTO orders (
        order_number, customer_name, email, phone, 
        status, total_amount, currency, delivery_date, 
        notes, product_name, quantity, tenant_id
      )
      VALUES (
        ${orderNumber}, ${formData.customerName}, ${formData.customerEmail || null}, ${formData.customerPhone || null},
        'pending', ${formData.quantity * (formData.unitPrice || 0)}, '₺', ${formData.deliveryDate},
        ${formData.notes || null}, ${formData.productName}, ${formData.quantity}, ${tenantId}
      )
      RETURNING *
    `;

    const order = orderResult[0];

    // Upload documents to R2 if any
    if (files && files.length > 0) {
      for (const file of files) {
        // Generate Key
        const key = generateFilePath(order.id, file.name);
        
        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to R2
        await uploadFile(key, buffer, file.type);

        // Insert into DB (Store Key in file_path)
        await sql`
          INSERT INTO documents (order_id, name, file_path, size)
          VALUES (${order.id}, ${file.name}, ${key}, ${file.size})
        `;
      }
    }

    return this.getOrderById(order.id) as Promise<Order>;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    const tenantId = await this.getTenantId();
    
    // First verification: Ensure order belongs to tenant
    const existingOrder = await this.getOrderById(id);
    if (!existingOrder) throw new Error('Order not found or access denied');

    const setClauses = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.customer) {
      setClauses.push(`customer_name = $${paramIndex++}`);
      values.push(updates.customer);
    }
    if (updates.email) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.phone) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }
    if (updates.product) {
      setClauses.push(`product_name = $${paramIndex++}`);
      values.push(updates.product);
    }
    if (updates.quantity) {
      setClauses.push(`quantity = $${paramIndex++}`);
      values.push(updates.quantity);
    }
    if (updates.amount) {
      setClauses.push(`total_amount = $${paramIndex++}`);
      values.push(updates.amount);
    }
    if (updates.deliveryDate) {
      setClauses.push(`delivery_date = $${paramIndex++}`);
      values.push(updates.deliveryDate);
    }
    if (updates.description !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (setClauses.length > 0) {
    if (setClauses.length > 0) {
      values.push(id);
      values.push(tenantId);
      // Ensure we only update if tenant_id matches
      await sql(
        `UPDATE orders SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`,
        values
      );
    }
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
    await sql`DELETE FROM orders WHERE id = ${id} AND tenant_id = ${tenantId}`;
  }
}
