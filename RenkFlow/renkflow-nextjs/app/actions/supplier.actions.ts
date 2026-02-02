'use server';

/**
 * Supplier Management Server Actions
 * Tedarikçi yönetimi için server fonksiyonları
 */

import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  CreateSupplierSchema,
  type Supplier,
  type SupplierInteraction,
} from '@/lib/types/supplier';

// ============================================
// Helper Functions
// ============================================

async function getSession() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gerekli');
  }
  return session;
}

// ============================================
// Supplier CRUD
// ============================================

export async function createSupplier(
  data: z.infer<typeof CreateSupplierSchema>
): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
  try {
    const session = await getSession();
    
    // Validate input
    const validatedData = CreateSupplierSchema.parse(data);
    
    // Check if supplier already exists
    const existing = await sql`
      SELECT id FROM suppliers
      WHERE company_name = ${validatedData.companyName}
        AND tenant_id = ${session.user.tenantId}
      LIMIT 1
    `;
    
    if (existing.length > 0) {
      return { success: false, error: 'Bu tedarikçi zaten kayıtlı' };
    }
    
    // Create supplier
    const result = await sql`
      INSERT INTO suppliers (
        tenant_id, company_name, contact_name, email, phone,
        address, tax_number, tax_office, category,
        status, reliability_score, payment_terms, credit_limit,
        assigned_to, notes, tags
      ) VALUES (
        ${session.user.tenantId}, ${validatedData.companyName},
        ${validatedData.contactName || null}, ${validatedData.email || null},
        ${validatedData.phone || null},
        ${validatedData.address ? JSON.stringify(validatedData.address) : null},
        ${validatedData.taxNumber || null}, ${validatedData.taxOffice || null},
        ${validatedData.category || null},
        'active', 3,
        ${validatedData.paymentTerms || 30}, ${validatedData.creditLimit || 0},
        ${validatedData.assignedTo || null},
        ${validatedData.notes || null}, ${validatedData.tags || []}
      )
      RETURNING *
    `;
    
    revalidatePath('/suppliers');
    
    const row = result[0];
    return {
      success: true,
      supplier: {
        id: row.id,
        tenantId: row.tenant_id,
        companyName: row.company_name,
        contactName: row.contact_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        taxNumber: row.tax_number,
        taxOffice: row.tax_office,
        category: row.category,
        status: row.status,
        reliabilityScore: row.reliability_score,
        averageDeliveryTime: row.average_delivery_time,
        fulfillmentRate: row.fulfillment_rate,
        qualityRating: row.quality_rating,
        paymentTerms: row.payment_terms,
        creditLimit: parseFloat(row.credit_limit),
        currentBalance: parseFloat(row.current_balance),
        assignedTo: row.assigned_to,
        notes: row.notes,
        tags: row.tags || [],
        totalOrders: row.total_orders,
        lastOrderDate: row.last_order_date,
        lastInteractionDate: row.last_interaction_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    };
  } catch (error) {
    console.error('[Supplier] Create supplier error:', error);
    return { success: false, error: 'Tedarikçi oluşturulamadı' };
  }
}

// ============================================
// Supplier Interactions
// ============================================

export async function createSupplierInteraction(
  supplierId: string,
  type: string,
  description: string,
  relatedOrderId?: string,
  relatedInvoiceId?: string
): Promise<{ success: boolean; interaction?: SupplierInteraction; error?: string }> {
  try {
    const session = await getSession();
    
    const result = await sql`
      INSERT INTO supplier_interactions (
        tenant_id, supplier_id, type, description,
        related_order_id, related_invoice_id,
        created_by, created_by_name
      ) VALUES (
        ${session.user.tenantId}, ${supplierId},
        ${type}, ${description},
        ${relatedOrderId || null}, ${relatedInvoiceId || null},
        ${session.user.id}, ${session.user.name || 'System'}
      )
      RETURNING *
    `;
    
    revalidatePath(`/suppliers/${supplierId}`);
    
    const row = result[0];
    return {
      success: true,
      interaction: {
        id: row.id,
        tenantId: row.tenant_id,
        supplierId: row.supplier_id,
        type: row.type,
        description: row.description,
        relatedOrderId: row.related_order_id,
        relatedInvoiceId: row.related_invoice_id,
        date: row.date,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        createdAt: row.created_at
      }
    };
  } catch (error) {
    console.error('[Supplier] Create interaction error:', error);
    return { success: false, error: 'Etkileşim kaydedilemedi' };
  }
}

// ============================================
// Supplier Performance
// ============================================

export async function getSupplierPerformance(
  supplierId: string,
  period: string
): Promise<{
  onTimeDeliveryRate: number;
  qualityDefectRate: number;
  averageResponseTime: number;
  orderFulfillmentRate: number;
  totalSpend: number;
  paymentCompliance: number;
  overallScore: number;
  rating: string;
} | null> {
  try {
    const session = await getSession();
    
    const result = await sql`
      SELECT * FROM supplier_performance
      WHERE tenant_id = ${session.user.tenantId}
        AND supplier_id = ${supplierId}
        AND period = ${period}
      LIMIT 1
    `;
    
    if (result.length === 0) return null;
    
    const row = result[0];
    return {
      onTimeDeliveryRate: row.on_time_delivery_rate,
      qualityDefectRate: row.quality_defect_rate,
      averageResponseTime: row.average_response_time,
      orderFulfillmentRate: row.order_fulfillment_rate,
      totalSpend: row.total_spend,
      paymentCompliance: row.payment_compliance,
      overallScore: row.overall_score,
      rating: row.rating
    };
  } catch (error) {
    console.error('[Supplier] Get performance error:', error);
    return null;
  }
}

// ============================================
// Get Suppliers List
// ============================================

export async function getSuppliers(params?: {
  search?: string;
  status?: string;
  limit?: number;
}): Promise<Supplier[]> {
  try {
    const session = await getSession();
    
    let query;
    
    if (params?.search) {
      query = sql`
        SELECT * FROM suppliers
        WHERE tenant_id = ${session.user.tenantId}
          AND (company_name ILIKE ${'%' + params.search + '%'}
            OR contact_name ILIKE ${'%' + params.search + '%'}
            OR email ILIKE ${'%' + params.search + '%'})
        ORDER BY created_at DESC
        LIMIT ${params?.limit || 100}
      `;
    } else if (params?.status) {
      query = sql`
        SELECT * FROM suppliers
        WHERE tenant_id = ${session.user.tenantId}
          AND status = ${params.status}
        ORDER BY created_at DESC
        LIMIT ${params?.limit || 100}
      `;
    } else {
      query = sql`
        SELECT * FROM suppliers
        WHERE tenant_id = ${session.user.tenantId}
        ORDER BY created_at DESC
        LIMIT ${params?.limit || 100}
      `;
    }
    
    const result = await query;
    
    return result.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      companyName: row.company_name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      taxNumber: row.tax_number,
      taxOffice: row.tax_office,
      category: row.category,
      status: row.status,
      reliabilityScore: row.reliability_score,
      averageDeliveryTime: row.average_delivery_time,
      fulfillmentRate: row.fulfillment_rate,
      qualityRating: row.quality_rating,
      paymentTerms: row.payment_terms,
      creditLimit: parseFloat(row.credit_limit),
      currentBalance: parseFloat(row.current_balance),
      assignedTo: row.assigned_to,
      notes: row.notes,
      tags: row.tags || [],
      totalOrders: row.total_orders,
      lastOrderDate: row.last_order_date,
      lastInteractionDate: row.last_interaction_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    console.error('[Supplier] Get suppliers error:', error);
    return [];
  }
}

// ============================================
// Get Supplier Statistics
// ============================================

export async function getSupplierStats(): Promise<{
  totalSuppliers: number;
  activeSuppliers: number;
  preferredSuppliers: number;
  blacklistedSuppliers: number;
}> {
  try {
    const session = await getSession();
    
    const result = await sql`
      SELECT 
        COUNT(*) as total_suppliers,
        COUNT(*) FILTER (WHERE status = 'active') as active_suppliers,
        COUNT(*) FILTER (WHERE status = 'preferred') as preferred_suppliers,
        COUNT(*) FILTER (WHERE status = 'blacklisted') as blacklisted_suppliers
      FROM suppliers
      WHERE tenant_id = ${session.user.tenantId}
    `;
    
    const row = result[0];
    return {
      totalSuppliers: parseInt(row.total_suppliers) || 0,
      activeSuppliers: parseInt(row.active_suppliers) || 0,
      preferredSuppliers: parseInt(row.preferred_suppliers) || 0,
      blacklistedSuppliers: parseInt(row.blacklisted_suppliers) || 0
    };
  } catch (error) {
    console.error('[Supplier] Get stats error:', error);
    return {
      totalSuppliers: 0,
      activeSuppliers: 0,
      preferredSuppliers: 0,
      blacklistedSuppliers: 0
    };
  }
}
