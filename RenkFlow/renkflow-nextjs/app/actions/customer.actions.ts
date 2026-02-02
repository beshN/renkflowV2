'use server';

/**
 * Customer CRM Server Actions
 * Müşteri ilişkileri yönetimi için server fonksiyonları
 */

import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  CreateCustomerSchema,
  CreateInteractionSchema,
  type Customer,
  type CustomerInteraction,
} from '@/lib/types/customer';

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
// Customer CRUD
// ============================================

export async function createCustomer(
  data: z.infer<typeof CreateCustomerSchema>
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const session = await getSession();
    
    // Validate input
    const validatedData = CreateCustomerSchema.parse(data);
    
    // Check if customer already exists
    const existing = await sql`
      SELECT id FROM customers
      WHERE company_name = ${validatedData.companyName}
        AND tenant_id = ${session.user.tenantId}
      LIMIT 1
    `;
    
    if (existing.length > 0) {
      return { success: false, error: 'Bu firma zaten kayıtlı' };
    }
    
    // Create customer
    const result = await sql`
      INSERT INTO customers (
        tenant_id, company_name, contact_name, email, phone,
        alternate_phone, address, tax_number, tax_office,
        industry, website, status, credit_limit, assigned_to,
        source, notes, tags
      ) VALUES (
        ${session.user.tenantId}, ${validatedData.companyName},
        ${validatedData.contactName || null}, ${validatedData.email || null},
        ${validatedData.phone || null}, ${validatedData.alternatePhone || null},
        ${validatedData.address ? JSON.stringify(validatedData.address) : null},
        ${validatedData.taxNumber || null}, ${validatedData.taxOffice || null},
        ${validatedData.industry || null}, ${validatedData.website || null},
        ${validatedData.status || 'active'}, ${validatedData.creditLimit || 0},
        ${validatedData.assignedTo || null}, ${validatedData.source || null},
        ${validatedData.notes || null}, ${validatedData.tags || []}
      )
      RETURNING *
    `;
    
    revalidatePath('/crm');
    
    const row = result[0];
    return {
      success: true,
      customer: {
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
        creditLimit: parseFloat(row.credit_limit),
        currentBalance: parseFloat(row.current_balance),
        totalRevenue: parseFloat(row.total_revenue),
        assignedTo: row.assigned_to,
        assignedToName: row.assigned_to_name,
        source: row.source,
        notes: row.notes,
        tags: row.tags || [],
        totalOrders: row.total_orders,
        lastOrderDate: row.last_order_date,
        lastContactDate: row.last_contact_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    };
  } catch (error) {
    console.error('[CRM] Create customer error:', error);
    return { success: false, error: 'Müşteri oluşturulamadı' };
  }
}

// ============================================
// Customer Interactions
// ============================================

export async function createInteraction(
  data: z.infer<typeof CreateInteractionSchema>
): Promise<{ success: boolean; interaction?: CustomerInteraction; error?: string }> {
  try {
    const session = await getSession();
    
    // Validate input
    const validatedData = CreateInteractionSchema.parse(data);
    
    // Create interaction
    const result = await sql`
      INSERT INTO customer_interactions (
        tenant_id, customer_id, type, subject, content,
        duration, outcome, scheduled_at, reminder_at,
        created_by, created_by_name
      ) VALUES (
        ${session.user.tenantId}, ${validatedData.customerId},
        ${validatedData.type}, ${validatedData.subject},
        ${validatedData.content}, ${validatedData.duration || null},
        ${validatedData.outcome || null}, ${validatedData.scheduledAt || null},
        ${validatedData.reminderAt || null}, ${session.user.id},
        ${session.user.name || 'System'}
      )
      RETURNING *
    `;
    
    revalidatePath(`/crm/${validatedData.customerId}`);
    
    const row = result[0];
    return {
      success: true,
      interaction: {
        id: row.id,
        tenantId: row.tenant_id,
        customerId: row.customer_id,
        type: row.type,
        subject: row.subject,
        content: row.content,
        duration: row.duration,
        outcome: row.outcome,
        scheduledAt: row.scheduled_at,
        completedAt: row.completed_at,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        reminderAt: row.reminder_at,
        isCompleted: row.is_completed,
        createdAt: row.created_at
      }
    };
  } catch (error) {
    console.error('[CRM] Create interaction error:', error);
    return { success: false, error: 'Etkileşim kaydedilemedi' };
  }
}

// ============================================
// Customer Statistics
// ============================================

export async function getCustomerStats(): Promise<{
  totalCustomers: number;
  activeCustomers: number;
  vipCustomers: number;
  newThisMonth: number;
  churnedThisMonth: number;
}> {
  try {
    const session = await getSession();
    
    const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') AS active_customers,
        COUNT(*) FILTER (WHERE status = 'vip') AS vip_customers,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month') AS new_this_month,
        COUNT(*) FILTER (WHERE status = 'churned' AND updated_at >= NOW() - INTERVAL '1 month') AS churned_this_month,
        COUNT(*) AS total_customers
      FROM customers
      WHERE tenant_id = ${session.user.tenantId}
    `;
    
    const row = stats[0];
    return {
      totalCustomers: row.total_customers,
      activeCustomers: row.active_customers,
      vipCustomers: row.vip_customers,
      newThisMonth: row.new_this_month,
      churnedThisMonth: row.churned_this_month
    };
  } catch (error) {
    console.error('[CRM] Get stats error:', error);
    return {
      totalCustomers: 0,
      activeCustomers: 0,
      vipCustomers: 0,
      newThisMonth: 0,
      churnedThisMonth: 0
    };
  }
}
