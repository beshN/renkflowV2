/**
 * Audit Logging Service
 * 
 * Features:
 * - Comprehensive activity tracking
 * - Data change logging with before/after states
 * - Compliance reporting (GDPR, SOC2)
 * - Tamper-evident log storage
 */

import crypto from 'node:crypto';
import { sql } from '@/lib/db';
import { Order } from '@/lib/types';
import {
  IS_BUILD_TIME,
  IS_PRODUCTION,
  resolveAuthSecret,
} from '@/lib/shared/config/runtime-env';

// ============================================
// Types
// ============================================

export type AuditAction =
  | 'order:created'
  | 'order:updated'
  | 'order:deleted'
  | 'order:status_changed'
  | 'document:uploaded'
  | 'document:deleted'
  | 'user:login'
  | 'user:login_failed'
  | 'user:logout'
  | 'user:invited'
  | 'user:role_changed'
  | 'settings:updated'
  | 'export:generated'
  | 'report:viewed';

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  hash: string; // For tamper detection
}

// ============================================
// Core Audit Functions
// ============================================

export async function logAuditEvent(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'hash'>
): Promise<void> {
  const id = generateAuditId();
  const timestamp = new Date();
  const hash = generateLogHash({ ...entry, id, timestamp });

  await sql`
    INSERT INTO audit_logs (
      id,
      tenant_id,
      user_id,
      user_email,
      action,
      entity_type,
      entity_id,
      before_state,
      after_state,
      metadata,
      ip_address,
      user_agent,
      timestamp,
      hash
    ) VALUES (
      ${id},
      ${entry.tenantId},
      ${entry.userId},
      ${entry.userEmail},
      ${entry.action},
      ${entry.entityType},
      ${entry.entityId},
      ${entry.before ? JSON.stringify(entry.before) : null},
      ${entry.after ? JSON.stringify(entry.after) : null},
      ${entry.metadata ? JSON.stringify(entry.metadata) : null},
      ${entry.ipAddress || null},
      ${entry.userAgent || null},
      ${timestamp.toISOString()},
      ${hash}
    )
  `;
}

export async function logOrderChange(
  order: Order,
  before: Partial<Order>,
  after: Partial<Order>,
  userId: string,
  userEmail: string,
  requestInfo?: { ip?: string; userAgent?: string }
): Promise<void> {
  if (!order.tenantId) {
    return;
  }
  const action: AuditAction = before.id ? 'order:updated' : 'order:created';
  
  await logAuditEvent({
    tenantId: order.tenantId,
    userId,
    userEmail,
    action,
    entityType: 'order',
    entityId: order.id,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    metadata: {
      orderNumber: order.orderNumber,
      status: order.status,
    },
    ipAddress: requestInfo?.ip,
    userAgent: requestInfo?.userAgent,
  });
}

export async function logLoginEvent(
  userId: string,
  email: string,
  tenantId: string,
  success: boolean,
  requestInfo: { ip: string; userAgent: string }
): Promise<void> {
  await logAuditEvent({
    tenantId,
    userId,
    userEmail: email,
    action: success ? 'user:login' : 'user:login_failed',
    entityType: 'user',
    entityId: userId,
    metadata: { success },
    ipAddress: requestInfo.ip,
    userAgent: requestInfo.userAgent,
  });
}

// ============================================
// Audit Log Querying
// ============================================

export interface AuditQueryOptions {
  tenantId: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export async function queryAuditLogs(
  options: AuditQueryOptions
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const {
    tenantId,
    action,
    entityType,
    entityId,
    userId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  let query = sql`
    SELECT *
    FROM audit_logs
    WHERE tenant_id = ${tenantId}
  `;

  if (action) query = sql`${query} AND action = ${action}`;
  if (entityType) query = sql`${query} AND entity_type = ${entityType}`;
  if (entityId) query = sql`${query} AND entity_id = ${entityId}`;
  if (userId) query = sql`${query} AND user_id = ${userId}`;
  if (startDate) query = sql`${query} AND timestamp >= ${startDate.toISOString()}`;
  if (endDate) query = sql`${query} AND timestamp <= ${endDate.toISOString()}`;

  const countResult = await sql`SELECT COUNT(*) as total FROM (${query}) as count_query`;

  const entries = await sql`
    ${query}
    ORDER BY timestamp DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const entriesRows = entries as any[];
  const countRows = countResult as any[];
  return {
    entries: entriesRows.map(mapAuditEntry),
    total: parseInt(countRows[0].total),
  };
}

export async function getEntityHistory(
  entityType: string,
  entityId: string,
  tenantId: string
): Promise<AuditLogEntry[]> {
  const entries = await sql`
    SELECT *
    FROM audit_logs
    WHERE tenant_id = ${tenantId}
      AND entity_type = ${entityType}
      AND entity_id = ${entityId}
    ORDER BY timestamp DESC
  `;

  const entriesRows = entries as any[];
  return entriesRows.map(mapAuditEntry);
}

// ============================================
// Compliance Reporting
// ============================================

export async function generateGDPRReport(
  userId: string,
  tenantId: string
): Promise<{
  personalData: Record<string, unknown>;
  auditTrail: AuditLogEntry[];
  dataLocations: string[];
}> {
  // Get user data
  const userResult = await sql`SELECT * FROM users WHERE id = ${userId}`;
  const userRows = userResult as any[];
  const user = userRows[0];
  
  // Get user's audit trail
  const { entries: auditTrail } = await queryAuditLogs({
    tenantId,
    userId,
    limit: 1000,
  });

  // Get all orders created by user
  const orders = await sql`SELECT * FROM orders WHERE created_by = ${userId}`;
  const ordersRows = orders as any[];

  return {
    personalData: {
      user: sanitizeUserData(user),
      orders: ordersRows.map(o => ({ id: o.id, customerEmail: o.email })),
    },
    auditTrail,
    dataLocations: ['users', 'orders', 'audit_logs', 'documents'],
  };
}

export async function exportAuditLog(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<string> {
  const { entries } = await queryAuditLogs({
    tenantId,
    startDate,
    endDate,
    limit: 10000,
  });

  // Generate CSV
  const headers = ['timestamp', 'user_email', 'action', 'entity_type', 'entity_id', 'ip_address'];
  const rows = entries.map(e => [
    e.timestamp.toISOString(),
    e.userEmail,
    e.action,
    e.entityType,
    e.entityId,
    e.ipAddress || '',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// ============================================
// Integrity Verification
// ============================================

export async function verifyLogIntegrity(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{ valid: boolean; tamperedEntries: string[] }> {
  const entries = await sql`
    SELECT *
    FROM audit_logs
    WHERE tenant_id = ${tenantId}
      AND timestamp >= ${startDate.toISOString()}
      AND timestamp <= ${endDate.toISOString()}
    ORDER BY timestamp ASC
  `;

  const tamperedEntries: string[] = [];
  const entriesRows = entries as any[];

  for (const entry of entriesRows) {
    const recomputedHash = generateLogHash({
      ...entry,
      timestamp: new Date(entry.timestamp),
    });

    if (recomputedHash !== entry.hash) {
      tamperedEntries.push(entry.id);
    }
  }

  return {
    valid: tamperedEntries.length === 0,
    tamperedEntries,
  };
}

// ============================================
// Helpers
// ============================================

function generateAuditId(): string {
  return `aud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateLogHash(entry: any): string {
  const secret =
    process.env.AUDIT_LOG_SECRET ||
    resolveAuthSecret({
      context: 'audit.logging',
      allowMissing: IS_BUILD_TIME,
      allowDevelopmentFallback: !IS_PRODUCTION && !IS_BUILD_TIME,
      developmentFallback: 'development-only-audit-secret',
    }) ||
    'development-only-audit-secret';
  const data = JSON.stringify({
    tenantId: entry.tenantId,
    userId: entry.userId,
    action: entry.action,
    entityId: entry.entityId,
    timestamp: entry.timestamp.toISOString(),
    before: entry.before,
    after: entry.after,
  });

  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
}

function mapAuditEntry(row: any): AuditLogEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    userEmail: row.user_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row.before_state,
    after: row.after_state,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    timestamp: new Date(row.timestamp),
    hash: row.hash,
  };
}

function sanitizeUserData(user: any): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.created_at,
    // Exclude sensitive fields like password hash
  };
}
