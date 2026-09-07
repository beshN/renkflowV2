import { IQuotationService, Quotation, CreateQuotationInput, QuotationItem } from './types';
import { sql, sqlQuery } from '@/lib/db';
import { withTransaction } from '@/lib/db/transaction';
import { TenantMismatchError } from '../orders/types';
import { safeParseCurrency } from '@/lib/types';

export class PostgresQuotationService implements IQuotationService {
  private generateQuotationNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `TEK-${timestamp}-${random}`;
  }

  async getQuotations(tenantId: string): Promise<Quotation[]> {
    const result = await sql`
      SELECT 
        q.*,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', qi.id,
            'productName', qi.product_name,
            'quantity', qi.quantity,
            'unitPrice', qi.unit_price,
            'totalPrice', qi.total_price,
            'discountPercent', qi.discount_percent
          )
        ) FILTER (WHERE qi.id IS NOT NULL) as items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      WHERE q.tenant_id = ${tenantId}
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;

    if (!result) return [];
    
    return (result as any[]).map(row => this.mapRowToQuotation(row));
  }

  async getQuotationById(tenantId: string, id: string): Promise<Quotation | null> {
    const result = await sql`
      SELECT 
        q.*,
        json_agg(
          jsonb_build_object(
            'id', qi.id,
            'productName', qi.product_name,
            'description', qi.description,
            'color', qi.color,
            'widthMm', qi.width_mm,
            'heightMm', qi.height_mm,
            'quantity', qi.quantity,
            'unitPrice', qi.unit_price,
            'totalPrice', qi.total_price,
            'discountPercent', qi.discount_percent,
            'notes', qi.notes
          )
        ) FILTER (WHERE qi.id IS NOT NULL) as items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      WHERE q.id = ${id} AND q.tenant_id = ${tenantId}
      GROUP BY q.id
    `;

    const rows = result as any[];
    if (rows.length === 0) return null;
    return this.mapRowToQuotation(rows[0]);
  }

  async createQuotation(tenantId: string, data: CreateQuotationInput, createdBy?: string): Promise<Quotation> {
    const quotationNumber = this.generateQuotationNumber();
    
    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discountAmount = subtotal * (data.discountPercent / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * 0.20; // Default 20% KDV for TR
    const totalAmount = taxableAmount + taxAmount;

    const id = await withTransaction(async (tx) => {
      const qResult = await tx.sql`
        INSERT INTO quotations (
          tenant_id, quotation_number, customer_id, customer_name,
          valid_until, currency, discount_percent, subtotal,
          discount_amount, tax_amount, total_amount, notes,
          internal_notes, terms_and_conditions, created_by
        ) VALUES (
          ${tenantId}, ${quotationNumber}, ${data.customerId || null}, ${data.customerName},
          ${data.validUntil || null}, ${data.currency}, ${data.discountPercent}, ${subtotal},
          ${discountAmount}, ${taxAmount}, ${totalAmount}, ${data.notes || null},
          ${data.internalNotes || null}, ${data.termsAndConditions || null}, ${createdBy || null}
        ) RETURNING id
      `;

      const quotationId = qResult[0].id;

      if (data.items && data.items.length > 0) {
        let position = 0;
        for (const item of data.items) {
          const itemTotal = item.quantity * item.unitPrice;
          const itemDiscount = itemTotal * (item.discountPercent / 100);
          const finalItemTotal = itemTotal - itemDiscount;

          await tx.sql`
            INSERT INTO quotation_items (
              tenant_id, quotation_id, product_name, description, color,
              width_mm, height_mm, quantity, unit_price, discount_percent,
              total_price, notes, position
            ) VALUES (
              ${tenantId}, ${quotationId}, ${item.productName}, ${item.description || null}, ${item.color || null},
              ${item.widthMm || null}, ${item.heightMm || null}, ${item.quantity}, ${item.unitPrice}, ${item.discountPercent},
              ${finalItemTotal}, ${item.notes || null}, ${position++}
            )
          `;
        }
      }

      return quotationId;
    });

    return this.getQuotationById(tenantId, id as string) as Promise<Quotation>;
  }

  async updateQuotation(tenantId: string, id: string, data: Partial<CreateQuotationInput>): Promise<Quotation> {
    const existing = await this.getQuotationById(tenantId, id);
    if (!existing) throw new Error('Quotation not found');
    if (existing.status !== 'draft') throw new Error('Only draft quotations can be edited');

    await withTransaction(async (tx) => {
      const setClauses = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.customerName !== undefined) {
        setClauses.push(`customer_name = $${paramIndex++}`);
        values.push(data.customerName);
      }
      if (data.validUntil !== undefined) {
        setClauses.push(`valid_until = $${paramIndex++}`);
        values.push(data.validUntil);
      }
      if (data.notes !== undefined) {
        setClauses.push(`notes = $${paramIndex++}`);
        values.push(data.notes);
      }

      // If items changed, recalculate totals and replace items
      if (data.items) {
        const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const discountPercent = data.discountPercent ?? existing.discountPercent;
        const discountAmount = subtotal * (discountPercent / 100);
        const taxableAmount = subtotal - discountAmount;
        const taxAmount = taxableAmount * 0.20; 
        const totalAmount = taxableAmount + taxAmount;

        setClauses.push(`subtotal = $${paramIndex++}`); values.push(subtotal);
        setClauses.push(`discount_percent = $${paramIndex++}`); values.push(discountPercent);
        setClauses.push(`discount_amount = $${paramIndex++}`); values.push(discountAmount);
        setClauses.push(`tax_amount = $${paramIndex++}`); values.push(taxAmount);
        setClauses.push(`total_amount = $${paramIndex++}`); values.push(totalAmount);

        // Delete old items
        await tx.sql`DELETE FROM quotation_items WHERE quotation_id = ${id} AND tenant_id = ${tenantId}`;
        
        // Insert new items
        let position = 0;
        for (const item of data.items) {
          const itemTotal = item.quantity * item.unitPrice;
          const itemDiscount = itemTotal * (item.discountPercent / 100);
          const finalItemTotal = itemTotal - itemDiscount;

          await tx.sql`
            INSERT INTO quotation_items (
              tenant_id, quotation_id, product_name, description, color,
              width_mm, height_mm, quantity, unit_price, discount_percent,
              total_price, notes, position
            ) VALUES (
              ${tenantId}, ${id}, ${item.productName}, ${item.description || null}, ${item.color || null},
              ${item.widthMm || null}, ${item.heightMm || null}, ${item.quantity}, ${item.unitPrice}, ${item.discountPercent},
              ${finalItemTotal}, ${item.notes || null}, ${position++}
            )
          `;
        }
      }

      if (setClauses.length > 0) {
        values.push(id);
        values.push(tenantId);
        await sqlQuery(`UPDATE quotations SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`, values);
      }
    });

    return this.getQuotationById(tenantId, id) as Promise<Quotation>;
  }

  async updateStatus(tenantId: string, id: string, status: Quotation['status']): Promise<Quotation> {
    const existing = await this.getQuotationById(tenantId, id);
    if (!existing) throw new Error('Quotation not found');

    await sql`UPDATE quotations SET status = ${status}, updated_at = NOW() WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return this.getQuotationById(tenantId, id) as Promise<Quotation>;
  }

  async convertToOrder(tenantId: string, id: string, createdBy?: string): Promise<{ orderId: string }> {
    const quotation = await this.getQuotationById(tenantId, id);
    if (!quotation) throw new Error('Quotation not found');
    if (quotation.status === 'converted') throw new Error('Quotation already converted to order');

    const orderId = await withTransaction(async (tx) => {
      // 1. Create order
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).slice(2, 6).toUpperCase();
      const orderNumber = `ORD-${timestamp}-${random}`;

      const oResult = await tx.sql`
        INSERT INTO orders (
          tenant_id, order_number, customer_id, customer_name,
          status, total_amount, currency, notes, custom_fields,
          assigned_to
        ) VALUES (
          ${tenantId}, ${orderNumber}, ${quotation.customerId || null}, ${quotation.customerName},
          'pending', ${quotation.totalAmount}, ${quotation.currency}, ${'Tekliften dönüştürüldü: ' + quotation.quotationNumber}, '{}',
          ${createdBy || null}
        ) RETURNING id
      `;
      const newOrderId = oResult[0].id;

      // 2. Create order items
      if (quotation.items && quotation.items.length > 0) {
        for (const item of quotation.items) {
          await tx.sql`
            INSERT INTO order_items (
              order_id, product_name, quantity, unit_price, total_price,
              description, color, width_mm, height_mm, notes
            ) VALUES (
              ${newOrderId}, ${item.productName}, ${item.quantity}, ${item.unitPrice}, ${item.totalPrice},
              ${item.description || null}, ${item.color || null}, ${item.widthMm || null}, ${item.heightMm || null}, ${item.notes || null}
            )
          `;
        }
      }

      // 3. Update quotation status
      await tx.sql`
        UPDATE quotations 
        SET status = 'converted', converted_to_order_id = ${newOrderId}, updated_at = NOW() 
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `;

      return newOrderId;
    });

    return { orderId: orderId as string };
  }

  async deleteQuotation(tenantId: string, id: string): Promise<void> {
    const existing = await this.getQuotationById(tenantId, id);
    if (!existing) throw new Error('Quotation not found');
    if (existing.status === 'converted') throw new Error('Cannot delete converted quotation');

    await sql`DELETE FROM quotations WHERE id = ${id} AND tenant_id = ${tenantId}`;
  }

  private mapRowToQuotation(row: any): Quotation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      quotationNumber: row.quotation_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      status: row.status,
      validUntil: row.valid_until ? new Date(row.valid_until).toISOString().split('T')[0] : null,
      currency: safeParseCurrency(row.currency),
      discountPercent: parseFloat(row.discount_percent || '0'),
      subtotal: parseFloat(row.subtotal || '0'),
      discountAmount: parseFloat(row.discount_amount || '0'),
      taxAmount: parseFloat(row.tax_amount || '0'),
      totalAmount: parseFloat(row.total_amount || '0'),
      notes: row.notes,
      internalNotes: row.internal_notes,
      termsAndConditions: row.terms_and_conditions,
      convertedToOrderId: row.converted_to_order_id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      items: (row.items || []).map((item: any) => ({
        id: item.id,
        productName: item.productName || item.product_name,
        description: item.description,
        color: item.color,
        widthMm: item.widthMm ? parseFloat(item.widthMm) : undefined,
        heightMm: item.heightMm ? parseFloat(item.heightMm) : undefined,
        quantity: parseInt(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice || '0'),
        discountPercent: parseFloat(item.discountPercent || '0'),
        totalPrice: parseFloat(item.totalPrice || '0'),
        notes: item.notes
      })),
    };
  }
}
