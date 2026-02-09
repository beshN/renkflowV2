'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { uploadFile, generateFilePath } from '@/lib/storage/gcs';
import { withServerActionTiming } from '@/lib/utils/metrics';
import {
  getServerUserContext,
  requirePermission,
  AuthenticationError,
  AuthorizationError,
} from '@/lib/auth/serverAuth';
import { hasPermission, type Permission, type UserRole } from '@/lib/auth/permissions';
import {
  OrderQrActionKeySchema,
  type OrderQrActionKey,
  getOrderQrActionDefinition,
} from '@/lib/orders/qrActions';
import { AuditLogService } from '@/lib/services/auditLog.service';

const MAX_QR_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

const CreateOrderQrTokenSchema = z.object({
  orderId: z.string().uuid(),
  label: z.string().trim().max(120).optional(),
  allowedActions: z.array(OrderQrActionKeySchema).min(1),
  expiresAt: z.string().datetime().optional(),
});

const ExecuteOrderQrActionSchema = z.object({
  token: z.string().trim().min(32),
  actionKey: OrderQrActionKeySchema,
  payload: z.unknown().optional(),
});

const OrderIdSchema = z.string().uuid();
const OrderQrTokenIdSchema = z.string().uuid();

export interface OrderQrTokenDTO {
  id: string;
  orderId: string;
  label: string | null;
  allowedActions: OrderQrActionKey[];
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  token: string;
}

export interface ResolvedOrderQrToken {
  tokenId: string;
  label: string | null;
  expiresAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    productName: string | null;
    status: 'pending' | 'in_production' | 'delivered';
    deliveryDate: string | null;
  };
  allowedActions: OrderQrActionKey[];
}

function sanitizeOrderQrMetadata(row: Record<string, unknown>) {
  return {
    id: String(row.order_id),
    orderNumber: String(row.order_number),
    customerName: String(row.customer_name),
    productName: row.product_name ? String(row.product_name) : null,
    status: row.status as 'pending' | 'in_production' | 'delivered',
    deliveryDate: row.delivery_date ? String(row.delivery_date) : null,
  };
}

function parseAllowedActions(input: unknown): OrderQrActionKey[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => (typeof entry === 'string' ? entry : null))
    .filter((entry): entry is string => !!entry)
    .filter((entry): entry is OrderQrActionKey => OrderQrActionKeySchema.safeParse(entry).success);
}

function normalizeTokenLabel(label: string | undefined): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureActionPermissions(role: UserRole, permissions: Permission[]): void {
  const missing = permissions.filter((permission) => !hasPermission(role, permission));
  if (missing.length > 0) {
    throw new AuthorizationError(`Eksik yetki: ${missing.join(', ')}`);
  }
}

async function findActiveTokenByToken(token: string, tenantId: string) {
  const result = await sql`
    SELECT
      t.id as token_id,
      t.tenant_id,
      t.order_id,
      t.label,
      t.allowed_actions,
      t.expires_at,
      t.active,
      o.order_number,
      o.customer_name,
      o.product_name,
      o.status,
      o.delivery_date
    FROM order_qr_tokens t
    JOIN orders o ON o.id = t.order_id
    WHERE t.token = ${token}
      AND t.tenant_id = ${tenantId}
      AND t.active = true
      AND (t.expires_at IS NULL OR t.expires_at > NOW())
    LIMIT 1
  `;

  const rows = result as Record<string, unknown>[];
  return rows[0] ?? null;
}

async function logQrAuditEvent(input: {
  tenantId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: 'order.qr_token.create' | 'order.qr_token.deactivate' | 'order.qr_action.execute';
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await AuditLogService.log({
      tenantId: input.tenantId,
      userId: input.userId,
      userEmail: input.userEmail,
      userRole: input.userRole,
      action: input.action,
      entityType: 'order_qr_token',
      entityId: input.entityId,
      metadata: input.metadata,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[order.qr.actions] audit log write failed:', error);
    }
  }
}

export async function createOrderQrToken(input: {
  orderId: string;
  label?: string;
  allowedActions: OrderQrActionKey[];
  expiresAt?: string;
}): Promise<OrderQrTokenDTO> {
  return withServerActionTiming('order.qr.createOrderQrToken', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'orders.qr.manage');

    const validated = CreateOrderQrTokenSchema.parse(input);

    const distinctActions = [...new Set(validated.allowedActions)] as OrderQrActionKey[];

    for (const actionKey of distinctActions) {
      const definition = getOrderQrActionDefinition(actionKey);
      ensureActionPermissions(context.role, definition.requiredPermissions);
    }

    const orderCheck = await sql`
      SELECT id FROM orders
      WHERE id = ${validated.orderId} AND tenant_id = ${context.tenantId}
      LIMIT 1
    `;
    const orderRows = orderCheck as Array<{ id: string }>;
    if (orderRows.length === 0) {
      throw new Error('Sipariş bulunamadı');
    }

    const token = crypto.randomBytes(32).toString('base64url');

    const result = await sql`
      INSERT INTO order_qr_tokens (
        tenant_id,
        order_id,
        token,
        label,
        allowed_actions,
        expires_at,
        active,
        created_by
      ) VALUES (
        ${context.tenantId},
        ${validated.orderId},
        ${token},
        ${normalizeTokenLabel(validated.label)},
        ${JSON.stringify(distinctActions)}::jsonb,
        ${validated.expiresAt ? new Date(validated.expiresAt).toISOString() : null},
        true,
        ${context.userId}
      )
      RETURNING id, order_id, label, allowed_actions, active, expires_at, created_at, token
    `;

    const rows = result as Array<Record<string, unknown>>;
    const created = rows[0];

    await logQrAuditEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: context.email,
      userRole: context.role,
      action: 'order.qr_token.create',
      entityId: String(created.id),
      metadata: {
        orderId: validated.orderId,
        allowedActions: distinctActions,
      },
    });

    revalidatePath(`/orders/${validated.orderId}`);

    return {
      id: String(created.id),
      orderId: String(created.order_id),
      label: created.label ? String(created.label) : null,
      allowedActions: parseAllowedActions(created.allowed_actions),
      active: Boolean(created.active),
      expiresAt: created.expires_at ? String(created.expires_at) : null,
      createdAt: String(created.created_at),
      token: String(created.token),
    };
  });
}

export async function listOrderQrTokens(orderId: string): Promise<OrderQrTokenDTO[]> {
  return withServerActionTiming('order.qr.listOrderQrTokens', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'orders.qr.manage');
    const validatedOrderId = OrderIdSchema.parse(orderId);

    const result = await sql`
      SELECT id, order_id, label, allowed_actions, active, expires_at, created_at, token
      FROM order_qr_tokens
      WHERE tenant_id = ${context.tenantId}
        AND order_id = ${validatedOrderId}
      ORDER BY created_at DESC
    `;

    const rows = result as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id),
      orderId: String(row.order_id),
      label: row.label ? String(row.label) : null,
      allowedActions: parseAllowedActions(row.allowed_actions),
      active: Boolean(row.active),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      createdAt: String(row.created_at),
      token: String(row.token),
    }));
  });
}

export async function deactivateOrderQrToken(tokenId: string): Promise<{ success: true }> {
  return withServerActionTiming('order.qr.deactivateOrderQrToken', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'orders.qr.manage');
    const validatedTokenId = OrderQrTokenIdSchema.parse(tokenId);

    const result = await sql`
      UPDATE order_qr_tokens
      SET active = false
      WHERE id = ${validatedTokenId}
        AND tenant_id = ${context.tenantId}
      RETURNING id, order_id
    `;

    const rows = result as Array<{ id: string; order_id: string }>;
    if (rows.length === 0) {
      throw new Error('QR token bulunamadı');
    }

    await logQrAuditEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: context.email,
      userRole: context.role,
      action: 'order.qr_token.deactivate',
      entityId: rows[0].id,
      metadata: { orderId: rows[0].order_id },
    });

    revalidatePath(`/orders/${rows[0].order_id}`);

    return { success: true };
  });
}

export async function resolveOrderQrToken(token: string): Promise<ResolvedOrderQrToken> {
  return withServerActionTiming('order.qr.resolveOrderQrToken', async () => {
    const context = await getServerUserContext();

    const qrToken = token.trim();
    if (qrToken.length < 32) {
      throw new Error('Geçersiz QR token');
    }

    const row = await findActiveTokenByToken(qrToken, context.tenantId);
    if (!row) {
      throw new Error('QR token geçersiz, pasif veya süresi dolmuş');
    }

    const tokenActions = parseAllowedActions(row.allowed_actions);
    const allowedActions = tokenActions.filter((actionKey) => {
      const definition = getOrderQrActionDefinition(actionKey);
      return definition.requiredPermissions.every((permission) => hasPermission(context.role, permission));
    });

    if (allowedActions.length === 0) {
      throw new AuthorizationError('Bu QR eylemleri için yetkiniz bulunmuyor');
    }

    return {
      tokenId: String(row.token_id),
      label: row.label ? String(row.label) : null,
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      order: sanitizeOrderQrMetadata(row),
      allowedActions,
    };
  });
}

function sanitizeUploadedFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

type ServerUserContext = Awaited<ReturnType<typeof getServerUserContext>>;

async function appendOrderNote(
  tenantId: string,
  orderId: string,
  authorName: string,
  note: string
): Promise<void> {
  const noteLine = `[${new Date().toISOString()}] ${authorName}: ${note}`;
  await sql`
    UPDATE orders
    SET notes = CASE
      WHEN notes IS NULL OR notes = '' THEN ${noteLine}
      ELSE notes || E'\n' || ${noteLine}
    END,
    updated_at = NOW()
    WHERE id = ${orderId} AND tenant_id = ${tenantId}
  `;
}

type QrActionHandlerInput = {
  context: ServerUserContext;
  orderId: string;
  payload: unknown;
};

type QrActionHandler = (input: QrActionHandlerInput) => Promise<string>;

const qrActionHandlers: Record<OrderQrActionKey, QrActionHandler> = {
  'status.set_pending': async ({ context, orderId }) => {
    await sql`
      UPDATE orders
      SET status = 'pending', updated_at = NOW()
      WHERE id = ${orderId} AND tenant_id = ${context.tenantId}
    `;
    return 'Sipariş durumu güncellendi';
  },
  'status.set_in_production': async ({ context, orderId }) => {
    await sql`
      UPDATE orders
      SET status = 'in_production', updated_at = NOW()
      WHERE id = ${orderId} AND tenant_id = ${context.tenantId}
    `;
    return 'Sipariş durumu güncellendi';
  },
  'status.set_delivered': async ({ context, orderId }) => {
    await sql`
      UPDATE orders
      SET status = 'delivered', updated_at = NOW()
      WHERE id = ${orderId} AND tenant_id = ${context.tenantId}
    `;
    return 'Sipariş durumu güncellendi';
  },
  'note.add': async ({ context, orderId, payload }) => {
    const notePayload = payload as { note: string };
    await appendOrderNote(context.tenantId, orderId, context.name || context.email, notePayload.note);
    return 'Sipariş notu eklendi';
  },
  'photo.upload': async ({ context, orderId, payload }) => {
    const photoPayload = payload as {
      fileName: string;
      mimeType: string;
      base64Data: string;
      note?: string;
    };

    const base64Part = photoPayload.base64Data.includes(',')
      ? photoPayload.base64Data.split(',')[1]
      : photoPayload.base64Data;

    const buffer = Buffer.from(base64Part, 'base64');
    if (!buffer || buffer.length === 0) {
      throw new Error('Yükleme verisi okunamadı');
    }
    if (buffer.length > MAX_QR_UPLOAD_SIZE_BYTES) {
      throw new Error('Dosya çok büyük (maks. 10MB)');
    }

    const safeName = sanitizeUploadedFileName(photoPayload.fileName);
    const key = generateFilePath(orderId, safeName);
    await uploadFile(key, buffer, photoPayload.mimeType);

    await sql`
      INSERT INTO documents (
        tenant_id,
        order_id,
        name,
        file_path,
        file_type,
        size,
        uploaded_by
      ) VALUES (
        ${context.tenantId},
        ${orderId},
        ${safeName},
        ${key},
        ${photoPayload.mimeType},
        ${buffer.length},
        ${context.userId}
      )
    `;

    if (photoPayload.note && photoPayload.note.trim().length > 0) {
      await appendOrderNote(context.tenantId, orderId, context.name || context.email, photoPayload.note.trim());
    }

    return 'Fotoğraf/doküman yüklendi';
  },
};

export async function executeOrderQrAction(input: {
  token: string;
  actionKey: OrderQrActionKey;
  payload?: unknown;
}): Promise<{
  success: true;
  actionKey: OrderQrActionKey;
  order: ResolvedOrderQrToken['order'];
  message: string;
}> {
  return withServerActionTiming('order.qr.executeOrderQrAction', async () => {
    const context = await getServerUserContext();
    const validated = ExecuteOrderQrActionSchema.parse(input);

    const row = await findActiveTokenByToken(validated.token, context.tenantId);
    if (!row) {
      throw new Error('QR token geçersiz, pasif veya süresi dolmuş');
    }

    const tokenActions = parseAllowedActions(row.allowed_actions);
    if (!tokenActions.includes(validated.actionKey)) {
      throw new AuthorizationError('Bu aksiyon bu QR token için aktif değil');
    }

    const definition = getOrderQrActionDefinition(validated.actionKey);
    ensureActionPermissions(context.role, definition.requiredPermissions);

    const parsedPayload = definition.payloadSchema.parse(validated.payload ?? {});
    const orderId = String(row.order_id);
    const handler = qrActionHandlers[validated.actionKey];
    const message = await handler({
      context,
      orderId,
      payload: parsedPayload,
    });

    const orderResult = await sql`
      SELECT id as order_id, order_number, customer_name, product_name, status, delivery_date
      FROM orders
      WHERE id = ${orderId} AND tenant_id = ${context.tenantId}
      LIMIT 1
    `;

    const orderRows = orderResult as Record<string, unknown>[];
    if (orderRows.length === 0) {
      throw new Error('Sipariş bulunamadı');
    }

    await logQrAuditEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: context.email,
      userRole: context.role,
      action: 'order.qr_action.execute',
      entityId: String(row.token_id),
      metadata: {
        orderId,
        actionKey: validated.actionKey,
      },
    });

    revalidatePath(`/orders/${orderId}`);

    return {
      success: true,
      actionKey: validated.actionKey,
      order: sanitizeOrderQrMetadata(orderRows[0]),
      message,
    };
  });
}

export { AuthenticationError, AuthorizationError };
