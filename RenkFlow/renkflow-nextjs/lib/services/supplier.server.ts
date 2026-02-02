/**
 * Supplier Service
 * Tedarikçi veritabanı işlemleri
 */

import { sql } from '@/lib/db';
import { 
  type Supplier
} from '@/lib/types/supplier';

// ============================================
// Supplier Queries
// ============================================

export async function getSuppliers(params?: {
  search?: string;
  status?: string;
  limit?: number;
}): Promise<Supplier[]> {
  try {
    let query;
    
    if (params?.search) {
      query = sql`
        SELECT * FROM suppliers
        WHERE company_name ILIKE ${'%' + params.search + '%'}
          OR contact_name ILIKE ${'%' + params.search + '%'}
          OR email ILIKE ${'%' + params.search + '%'}
          OR phone ILIKE ${'%' + params.search + '%'}
        ORDER BY created_at DESC
        LIMIT ${params?.limit || 100}
      `;
    } else if (params?.status) {
      query = sql`
        SELECT * FROM suppliers
        WHERE status = ${params.status}
        ORDER BY created_at DESC
        LIMIT ${params?.limit || 100}
      `;
    } else {
      query = sql`
        SELECT * FROM suppliers
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
    console.error('[SupplierService] Get suppliers error:', error);
    return [];
  }
}
