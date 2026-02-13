/**
 * Customer Service
 * Müşteri CRM veritabanı işlemleri
 */

import { sql } from '@/lib/db';
import { 
  type Customer, 
  type CreateCustomerInput,
  type CreateInteractionInput
} from '@/lib/types/customer';

// ============================================
// Customer Queries
// ============================================

export async function getCustomers(params?: {
  search?: string;
  status?: string;
  limit?: number;
}): Promise<Customer[]> {
  try {
    let query;
    
    if (params?.search) {
      query = sql`
        SELECT * FROM customers
        WHERE company_name ILIKE ${'%' + params.search + '%'}
          OR contact_name ILIKE ${'%' + params.search + '%'}
          OR email ILIKE ${'%' + params.search + '%'}
          OR phone ILIKE ${'%' + params.search + '%'}
        ORDER BY created_at DESC
        LIMIT ${params?.limit || 100}
      `;
    } else if (params?.status) {
      query = sql`
        SELECT * FROM customers
        WHERE status = ${params.status}
        ORDER BY created_at DESC
        LIMIT ${params?.limit || 100}
      `;
    } else {
      query = sql`
        SELECT * FROM customers
        ORDER BY created_at DESC
        LIMIT ${params?.limit || 100}
      `;
    }
    
    const result = await query;
    const rows = result as any[];
    
    return rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      companyName: row.company_name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      alternatePhone: row.alternate_phone,
      address: row.address,
      taxNumber: row.tax_number,
      taxOffice: row.tax_office,
      industry: row.industry,
      website: row.website,
      status: row.status,
      category: row.category,
      priority: row.priority,
      creditLimit: parseFloat(row.credit_limit) || 0,
      currentBalance: parseFloat(row.current_balance) || 0,
      totalRevenue: parseFloat(row.total_revenue) || 0,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      source: row.source,
      notes: row.notes,
      tags: row.tags || [],
      totalOrders: row.total_orders,
      lastOrderDate: row.last_order_date instanceof Date ? row.last_order_date.toISOString() : row.last_order_date,
      lastContactDate: row.last_contact_date instanceof Date ? row.last_contact_date.toISOString() : row.last_contact_date,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
    }));
  } catch (error) {
    console.error('[CustomerService] Get customers error:', error);
    return [];
  }
}
