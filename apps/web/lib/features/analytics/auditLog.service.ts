/**
 * Audit Log Service
 * Enterprise-grade audit trail for all financial operations
 * Tracks who did what, when, and with what data
 */

import 'server-only';
import { sql } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
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
// Audit Log Service — writes to the single audit trail (activity_logs)
// ============================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AuditLogService {
  /**
   * Record a finance/QR event. Never throws: the business change has already committed,
   * and a failed audit write is logged instead of undoing it.
   */
  static async log(input: AuditLogInput): Promise<boolean> {
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || null;
      await recordAudit(sql, {
        tenantId: input.tenantId,
        actorId: input.userId || null,
        entityType: input.entityType,
        entityId: input.entityId && UUID.test(input.entityId) ? input.entityId : input.tenantId,
        action: input.action,
        changes: input.oldValues || input.newValues ? { old: input.oldValues ?? null, new: input.newValues ?? null } : null,
        metadata: {
          ...(input.metadata || {}),
          ...(input.entityId && !UUID.test(input.entityId) ? { entityRef: input.entityId } : {}),
          role: input.userRole || null,
          email: input.userEmail || null,
          ip: ipAddress,
          userAgent: headersList.get('user-agent')?.slice(0, 200) || null,
        },
      });
      return true;
    } catch (error) {
      console.error('[AuditLogService] Failed to log audit event:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /** Audit summary for the finance dashboard (owner/admin), from activity_logs. */
  static async getSummary(tenantId: string, days: number = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [totals, byAction, byUser, recent] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM activity_logs WHERE tenant_id = ${tenantId} AND created_at >= ${startDate}`,
      sql`SELECT action, COUNT(*)::int AS count FROM activity_logs WHERE tenant_id = ${tenantId} AND created_at >= ${startDate} GROUP BY action ORDER BY count DESC`,
      sql`SELECT a.actor_id, COALESCE(u.email, '') AS email, COUNT(*)::int AS count FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.tenant_id = ${tenantId} AND a.created_at >= ${startDate} AND a.actor_id IS NOT NULL GROUP BY a.actor_id, u.email ORDER BY count DESC LIMIT 10`,
      sql`SELECT id, entity_type, entity_id, action, actor_id, actor_name, changes, metadata, created_at FROM activity_logs WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 10`,
    ]);
    return {
      totalEvents: Number(totals[0]?.total ?? 0),
      eventsByAction: Object.fromEntries((byAction as any[]).map((row) => [row.action, Number(row.count)])),
      eventsByUser: (byUser as any[]).map((row) => ({ userId: row.actor_id, email: row.email || 'Bilinmiyor', count: Number(row.count) })),
      recentActivity: (recent as any[]).map((row) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        userId: row.actor_id,
        userName: row.actor_name,
        changes: row.changes,
        metadata: row.metadata,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
    };
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
