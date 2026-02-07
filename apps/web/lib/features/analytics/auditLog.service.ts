/**
 * Audit Log Service
 * Enterprise-grade audit trail for all financial operations
 * Tracks who did what, when, and with what data
 */

import 'server-only';
import { sql, getSql } from '@/lib/db';
import { headers } from 'next/headers';

// ============================================
// Types
// ============================================

export type AuditAction =
  // Payment actions
  | 'payment.create'
  | 'payment.update'
  | 'payment.delete'
  | 'payment.batch_delete'
  // Document actions
  | 'document.upload'
  | 'document.delete'
  | 'document.batch_delete'
  // Employee actions
  | 'employee.create'
  | 'employee.update'
  | 'employee.delete'
  | 'employee.batch_update'
  // Ledger actions
  | 'ledger.create'
  | 'ledger.update'
  | 'ledger.delete'
  // Order actions
  | 'order.create'
  | 'order.update'
  | 'order.delete'
  // Order QR actions
  | 'order.qr_token.create'
  | 'order.qr_token.deactivate'
  | 'order.qr_action.execute'
  // Export actions
  | 'export.payments'
  | 'export.documents'
  | 'export.employees'
  | 'export.ledger'
  // Auth actions
  | 'auth.login'
  | 'auth.logout'
  | 'auth.permission_denied';

export type EntityType = 
  | 'payment' 
  | 'order_document' 
  | 'employee' 
  | 'employee_ledger_entry' 
  | 'order'
  | 'order_qr_token'
  | 'user'
  | 'tenant';

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: AuditAction;
  entityType: EntityType;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogInput {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilters {
  action?: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// Audit Log Service
// ============================================

export class AuditLogService {
  /**
   * Log an audit event
   */
  static async log(input: AuditLogInput): Promise<string> {
    try {
      // Get request metadata from headers
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || 
                        headersList.get('x-real-ip') || 
                        null;
      const userAgent = headersList.get('user-agent') || null;

      const result = await sql`
        INSERT INTO audit_logs (
          tenant_id,
          user_id,
          user_email,
          user_role,
          action,
          entity_type,
          entity_id,
          old_values,
          new_values,
          ip_address,
          user_agent,
          request_id,
          metadata
        ) VALUES (
          ${input.tenantId},
          ${input.userId || null},
          ${input.userEmail || null},
          ${input.userRole || null},
          ${input.action},
          ${input.entityType},
          ${input.entityId || null},
          ${input.oldValues ? JSON.stringify(input.oldValues) : null}::jsonb,
          ${input.newValues ? JSON.stringify(input.newValues) : null}::jsonb,
          ${ipAddress}::inet,
          ${userAgent},
          ${crypto.randomUUID()},
          ${JSON.stringify(input.metadata || {})}::jsonb
        )
        RETURNING id
      `;

      const resultRows = result as any[];
      return resultRows[0].id;
    } catch (error) {
      console.error('[AuditLogService] Failed to log audit event:', error);
      // Don't throw - audit logging should not break the main operation
      return '';
    }
  }

  /**
   * Get audit logs for a tenant with optional filters
   */
  static async getLogs(
    tenantId: string,
    filters: AuditLogFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    // Use parameterized query with optional filters using COALESCE pattern
    const action = filters.action || null;
    const entityType = filters.entityType || null;
    const entityId = filters.entityId || null;
    const userId = filters.userId || null;
    const startDate = filters.startDate || null;
    const endDate = filters.endDate || null;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total FROM audit_logs
      WHERE tenant_id = ${tenantId}
        AND (${action}::text IS NULL OR action = ${action})
        AND (${entityType}::text IS NULL OR entity_type = ${entityType})
        AND (${entityId}::text IS NULL OR entity_id = ${entityId})
        AND (${userId}::text IS NULL OR user_id = ${userId})
        AND (${startDate}::timestamptz IS NULL OR created_at >= ${startDate}::timestamptz)
        AND (${endDate}::timestamptz IS NULL OR created_at <= ${endDate}::timestamptz)
    `;
    const countRows = countResult as any[];
    const total = parseInt(countRows[0]?.total || '0', 10);

    // Get paginated results
    const logsResult = await sql`
      SELECT * FROM audit_logs
      WHERE tenant_id = ${tenantId}
        AND (${action}::text IS NULL OR action = ${action})
        AND (${entityType}::text IS NULL OR entity_type = ${entityType})
        AND (${entityId}::text IS NULL OR entity_id = ${entityId})
        AND (${userId}::text IS NULL OR user_id = ${userId})
        AND (${startDate}::timestamptz IS NULL OR created_at >= ${startDate}::timestamptz)
        AND (${endDate}::timestamptz IS NULL OR created_at <= ${endDate}::timestamptz)
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const logsRows = logsResult as any[];
    const logs: AuditLogEntry[] = logsRows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      userEmail: row.user_email,
      userRole: row.user_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldValues: row.old_values,
      newValues: row.new_values,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestId: row.request_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));

    return { logs, total };
  }

  /**
   * Get audit history for a specific entity
   */
  static async getEntityHistory(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    limit: number = 20
  ): Promise<AuditLogEntry[]> {
    const result = await sql`
      SELECT * FROM audit_logs
      WHERE tenant_id = ${tenantId}
      AND entity_type = ${entityType}
      AND entity_id = ${entityId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const resultRows = result as any[];
    return resultRows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      userEmail: row.user_email,
      userRole: row.user_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldValues: row.old_values,
      newValues: row.new_values,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestId: row.request_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get audit summary for dashboard
   */
  static async getSummary(
    tenantId: string,
    days: number = 7
  ): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByUser: { userId: string; email: string; count: number }[];
    recentActivity: AuditLogEntry[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total events
    const totalResult = await sql`
      SELECT COUNT(*) as total FROM audit_logs
      WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate.toISOString()}
    `;

    // Events by action
    const actionResult = await sql`
      SELECT action, COUNT(*) as count FROM audit_logs
      WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate.toISOString()}
      GROUP BY action
      ORDER BY count DESC
    `;

    // Events by user
    const userResult = await sql`
      SELECT user_id, user_email, COUNT(*) as count FROM audit_logs
      WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate.toISOString()}
      AND user_id IS NOT NULL
      GROUP BY user_id, user_email
      ORDER BY count DESC
      LIMIT 10
    `;

    // Recent activity
    const recentResult = await sql`
      SELECT * FROM audit_logs
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const totalRows = totalResult as any[];
    const actionRows = actionResult as any[];
    const userRows = userResult as any[];
    const recentRows = recentResult as any[];

    return {
      totalEvents: parseInt(totalRows[0].total, 10),
      eventsByAction: actionRows.reduce((acc: Record<string, number>, row: any) => {
        acc[row.action] = parseInt(row.count, 10);
        return acc;
      }, {}),
      eventsByUser: userRows.map((row: any) => ({
        userId: row.user_id,
        email: row.user_email || 'Unknown',
        count: parseInt(row.count, 10),
      })),
      recentActivity: recentRows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        userEmail: row.user_email,
        userRole: row.user_role,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        requestId: row.request_id,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
    };
  }

  /**
   * Helper to create diff between old and new values
   */
  static createDiff(
    oldObj: Record<string, unknown>,
    newObj: Record<string, unknown>
  ): { changed: Record<string, { old: unknown; new: unknown }> } {
    const changed: Record<string, { old: unknown; new: unknown }> = {};

    // Find changed keys
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    
    for (const key of allKeys) {
      if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        changed[key] = {
          old: oldObj[key],
          new: newObj[key],
        };
      }
    }

    return { changed };
  }
}

// Export action labels for UI
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'payment.create': 'Ödeme Oluşturuldu',
  'payment.update': 'Ödeme Güncellendi',
  'payment.delete': 'Ödeme Silindi',
  'payment.batch_delete': 'Toplu Ödeme Silindi',
  'document.upload': 'Belge Yüklendi',
  'document.delete': 'Belge Silindi',
  'document.batch_delete': 'Toplu Belge Silindi',
  'employee.create': 'Çalışan Eklendi',
  'employee.update': 'Çalışan Güncellendi',
  'employee.delete': 'Çalışan Silindi',
  'employee.batch_update': 'Toplu Çalışan Güncellendi',
  'ledger.create': 'Bordro Kaydı Eklendi',
  'ledger.update': 'Bordro Kaydı Güncellendi',
  'ledger.delete': 'Bordro Kaydı Silindi',
  'order.create': 'Sipariş Oluşturuldu',
  'order.update': 'Sipariş Güncellendi',
  'order.delete': 'Sipariş Silindi',
  'order.qr_token.create': 'Sipariş QR Token Oluşturuldu',
  'order.qr_token.deactivate': 'Sipariş QR Token Pasife Alındı',
  'order.qr_action.execute': 'Sipariş QR Aksiyonu Çalıştırıldı',
  'export.payments': 'Ödemeler Dışa Aktarıldı',
  'export.documents': 'Belgeler Dışa Aktarıldı',
  'export.employees': 'Çalışanlar Dışa Aktarıldı',
  'export.ledger': 'Bordro Dışa Aktarıldı',
  'auth.login': 'Giriş Yapıldı',
  'auth.logout': 'Çıkış Yapıldı',
  'auth.permission_denied': 'Erişim Reddedildi',
};
