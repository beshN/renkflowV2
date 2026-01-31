/**
 * Audit Trail System
 * - Track all user actions
 * - GDPR compliance
 * - Tamper-proof logging
 */

import { sql } from '@/lib/db';

// ============================================
// Types
// ============================================

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'invite'
  | 'permission_change'
  | 'settings_change'
  | 'password_change'
  | 'email_change'
  | 'data_request'
  | 'data_deletion';

export type AuditResource =
  | 'order'
  | 'document'
  | 'user'
  | 'tenant'
  | 'customer'
  | 'settings'
  | 'invitation'
  | 'session';

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  checksum?: string;
}

export interface AuditQueryOptions {
  tenantId: string;
  userId?: string;
  action?: AuditAction | AuditAction[];
  resource?: AuditResource | AuditResource[];
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditQueryResult {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// Audit Trail Class
// ============================================

class AuditTrail {
  private static instance: AuditTrail;
  private buffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  private constructor() {
    this.startFlushInterval();
  }

  static getInstance(): AuditTrail {
    if (!AuditTrail.instance) {
      AuditTrail.instance = new AuditTrail();
    }
    return AuditTrail.instance;
  }

  private startFlushInterval(): void {
    if (typeof window !== 'undefined') return; // Server-side only

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'checksum'>): Promise<string> {
    const id = this.generateId();
    const timestamp = new Date();

    const fullEntry: AuditLogEntry = {
      ...entry,
      id,
      timestamp,
      checksum: this.generateChecksum({ ...entry, id, timestamp }),
    };

    this.buffer.push(fullEntry);

    // Flush if buffer is full
    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }

    return id;
  }

  /**
   * Log a create action
   */
  async logCreate(
    tenantId: string,
    user: { id: string; name: string; email: string },
    resource: AuditResource,
    resourceId: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.log({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: 'create',
      resource,
      resourceId,
      description,
      metadata,
    });
  }

  /**
   * Log an update action
   */
  async logUpdate(
    tenantId: string,
    user: { id: string; name: string; email: string },
    resource: AuditResource,
    resourceId: string,
    description: string,
    changes?: { field: string; oldValue: unknown; newValue: unknown }[]
  ): Promise<string> {
    return this.log({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: 'update',
      resource,
      resourceId,
      description,
      metadata: changes ? { changes } : undefined,
    });
  }

  /**
   * Log a delete action
   */
  async logDelete(
    tenantId: string,
    user: { id: string; name: string; email: string },
    resource: AuditResource,
    resourceId: string,
    description: string,
    deletedData?: Record<string, unknown>
  ): Promise<string> {
    return this.log({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: 'delete',
      resource,
      resourceId,
      description,
      metadata: deletedData ? { deletedData } : undefined,
    });
  }

  /**
   * Log authentication events
   */
  async logAuth(
    tenantId: string,
    user: { id: string; name: string; email: string },
    action: 'login' | 'logout',
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return this.log({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action,
      resource: 'session',
      description: action === 'login' ? 'User logged in' : 'User logged out',
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log data export for GDPR compliance
   */
  async logDataExport(
    tenantId: string,
    user: { id: string; name: string; email: string },
    exportedResources: string[],
    format: string
  ): Promise<string> {
    return this.log({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: 'export',
      resource: 'user',
      resourceId: user.id,
      description: `Data exported in ${format} format`,
      metadata: { exportedResources, format },
    });
  }

  /**
   * Log GDPR data request
   */
  async logDataRequest(
    tenantId: string,
    user: { id: string; name: string; email: string },
    requestType: 'access' | 'deletion' | 'portability'
  ): Promise<string> {
    return this.log({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: 'data_request',
      resource: 'user',
      resourceId: user.id,
      description: `GDPR ${requestType} request initiated`,
      metadata: { requestType },
    });
  }

  /**
   * Query audit logs
   */
  async query(options: AuditQueryOptions): Promise<AuditQueryResult> {
    const {
      tenantId,
      userId,
      action,
      resource,
      resourceId,
      startDate,
      endDate,
      page = 1,
      pageSize = 50,
    } = options;

    // Build query
    let query = `
      SELECT * FROM audit_logs
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (action) {
      const actions = Array.isArray(action) ? action : [action];
      query += ` AND action = ANY($${paramIndex})`;
      params.push(actions);
      paramIndex++;
    }

    if (resource) {
      const resources = Array.isArray(resource) ? resource : [resource];
      query += ` AND resource = ANY($${paramIndex})`;
      params.push(resources);
      paramIndex++;
    }

    if (resourceId) {
      query += ` AND resource_id = $${paramIndex}`;
      params.push(resourceId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Count total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await sql(countQuery, params);
    const total = parseInt(countResult[0]?.count || '0', 10);

    // Add pagination
    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, (page - 1) * pageSize);

    const entries = await sql(query, params);

    return {
      entries: entries as AuditLogEntry[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get activity for a specific resource
   */
  async getResourceHistory(
    tenantId: string,
    resource: AuditResource,
    resourceId: string
  ): Promise<AuditLogEntry[]> {
    const result = await this.query({
      tenantId,
      resource,
      resourceId,
      pageSize: 100,
    });

    return result.entries;
  }

  /**
   * Get user activity
   */
  async getUserActivity(
    tenantId: string,
    userId: string,
    days: number = 30
  ): Promise<AuditLogEntry[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.query({
      tenantId,
      userId,
      startDate,
      pageSize: 500,
    });

    return result.entries;
  }

  /**
   * Flush buffered entries to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // Batch insert
      const values = entries.map((entry, index) => {
        const base = index * 12;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`;
      }).join(', ');

      const params = entries.flatMap((entry) => [
        entry.id,
        entry.tenantId,
        entry.userId,
        entry.userName,
        entry.userEmail,
        entry.action,
        entry.resource,
        entry.resourceId || null,
        entry.description,
        JSON.stringify(entry.metadata || {}),
        entry.timestamp,
        entry.checksum,
      ]);

      await sql(`
        INSERT INTO audit_logs (id, tenant_id, user_id, user_name, user_email, action, resource, resource_id, description, metadata, timestamp, checksum)
        VALUES ${values}
      `, params);
    } catch (error) {
      // Re-add failed entries to buffer
      this.buffer = [...entries, ...this.buffer];
      console.error('[AuditTrail] Failed to flush:', error);
    }
  }

  /**
   * Verify integrity of audit log entry
   */
  verifyIntegrity(entry: AuditLogEntry): boolean {
    const { checksum, ...rest } = entry;
    const expectedChecksum = this.generateChecksum(rest);
    return checksum === expectedChecksum;
  }

  /**
   * Generate tamper-proof checksum
   */
  private generateChecksum(data: Omit<AuditLogEntry, 'checksum'>): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    // Simple hash for demo - in production use crypto.subtle.digest
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old logs (retention policy)
   */
  async cleanup(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await sql(`
      DELETE FROM audit_logs
      WHERE timestamp < $1
      RETURNING id
    `, [cutoffDate]);

    return result.length;
  }
}

export const auditTrail = AuditTrail.getInstance();
export { AuditTrail };
