/**
 * Notification Service
 * 
 * Features:
 * - In-app notifications (database + real-time)
 * - Email notifications (Resend)
 * - Push notifications (Web Push API)
 * - Notification preferences per user
 * - Batch processing and queuing
 */

import { sql } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { Order, OrderStatus } from '@/lib/types';
import crypto from 'node:crypto';

// web-push is optional - lazy loaded when needed
let webpush: typeof import('web-push') | null = null;
if (process.env.VAPID_PRIVATE_KEY) {
  import('web-push').then(wp => { webpush = wp; });
}

// ============================================
// Types
// ============================================

interface EmailTemplate {
  subject: string;
  html: string;
}

export type NotificationType = 
  | 'order:created'
  | 'order:updated'
  | 'order:status_changed'
  | 'order:delivered'
  | 'order:delayed'
  | 'work_order:assigned'
  | 'mention'
  | 'system'
  | 'reminder';

export type NotificationChannel = 'in_app' | 'email' | 'push';

export interface Notification {
  id: string;
  userId: string;
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  email: Record<NotificationType, boolean>;
  push: Record<NotificationType, boolean>;
  inApp: Record<NotificationType, boolean>;
}

export interface PushSubscription {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ============================================
// In-App Notifications
// ============================================

export async function createNotification(
  userId: string,
  tenantId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
  channels: NotificationChannel[] = ['in_app']
): Promise<Notification | null> {
  // Every in-app notice honours the person's preference for this kind (Ayarlar → Bildirimler).
  if (await inAppTurnedOff(userId, type)) return null;
  const id = `ntf_${crypto.randomBytes(16).toString('hex')}`;
  const notificationResult = await sql`
    INSERT INTO notifications (
      id, user_id, tenant_id, type, title, message, data, channels, read, created_at
    ) VALUES (
      ${id}, ${userId}, ${tenantId}, ${type}, ${title}, ${message}, 
      ${data ? JSON.stringify(data) : null}::text::jsonb,
      ${JSON.stringify(channels)}::text::jsonb,
      false, 
      NOW()
    )
    RETURNING *
  `;
  const notificationRows = notificationResult as any[];
  const notification = notificationRows[0];

  return {
    id: notification.id,
    userId: notification.user_id,
    tenantId: notification.tenant_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data,
    channels: notification.channels,
    read: notification.read,
    readAt: notification.read_at,
    createdAt: new Date(notification.created_at),
  };
}

/** Whether the person turned off in-app notices of this kind (a failed read never silences one). */
async function inAppTurnedOff(userId: string, type: NotificationType) {
  try {
    const prefs = await getNotificationPreferences(userId);
    return (prefs?.inApp as Record<string, unknown> | undefined)?.[type] === false;
  } catch {
    return false;
  }
}

export async function getUserNotifications(
  userId: string,
  tenantId: string,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
  const { unreadOnly = false, limit = 20, offset = 0 } = options;

  // Get total unread count
  const unreadCountResult = await sql`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ${userId} AND tenant_id = ${tenantId} AND read = false
  `;
  const unreadRows = unreadCountResult as any[];
  const unreadResult = unreadRows[0];

  // Get notifications
  let query = sql`
    SELECT *
    FROM notifications
    WHERE user_id = ${userId} AND tenant_id = ${tenantId}
  `;

  if (unreadOnly) {
    query = sql`${query} AND read = false`;
  }

  const notifications = await sql`
    ${query}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  // Get total count
  const totalCountResult = await sql`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ${userId} AND tenant_id = ${tenantId}
  `;
  const totalRows = totalCountResult as any[];
  const totalResult = totalRows[0];
  const notificationsRows = notifications as any[];

  return {
    notifications: notificationsRows.map(mapNotificationRow),
    total: parseInt(totalResult.count),
    unreadCount: parseInt(unreadResult.count),
  };
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
  tenantId: string
): Promise<void> {
  await sql`
    UPDATE notifications
    SET read = true, read_at = NOW()
    WHERE id = ${notificationId} AND user_id = ${userId} AND tenant_id = ${tenantId}
  `;
}

export async function markAllNotificationsAsRead(userId: string, tenantId: string): Promise<void> {
  await sql`
    UPDATE notifications
    SET read = true, read_at = NOW()
    WHERE user_id = ${userId} AND tenant_id = ${tenantId} AND read = false
  `;
}

export async function deleteNotification(
  notificationId: string,
  userId: string,
  tenantId: string
): Promise<void> {
  await sql`
    DELETE FROM notifications
    WHERE id = ${notificationId} AND user_id = ${userId} AND tenant_id = ${tenantId}
  `;
}

// ============================================
// Email Notifications
// ============================================

export async function sendOrderStatusEmail(
  email: string,
  order: Order,
  oldStatus?: OrderStatus
): Promise<void> {
  const statusMessages: Partial<Record<OrderStatus, string>> = {
    pending: 'Siparişiniz alındı ve inceleniyor.',
    in_production: 'Siparişiniz üretim aşamasında.',
    delivered: 'Siparişiniz teslim edildi.',
  };
  const statusMessage = statusMessages[order.status] ?? 'Siparişiniz güncellendi.';

  const template: EmailTemplate = {
    subject: `Sipariş Durumu Güncellendi - #${order.orderNumber}`,
    html: `
      <h1>Sipariş Durumu Güncellendi</h1>
      <p>Merhaba ${order.customerName},</p>
      <p><strong>#${order.orderNumber}</strong> numaralı siparişinizin durumu güncellendi:</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: bold;">
          ${oldStatus ? `${oldStatus} → ${order.status}` : order.status}
        </p>
        <p style="margin: 8px 0 0 0; color: #6b7280;">
          ${statusMessage}
        </p>
      </div>
      <p><strong>Ürün:</strong> ${order.productName}</p>
      <p><strong>Tutar:</strong> ${order.totalAmount} ${order.currency}</p>
      <p>Siparişinizi takip etmek için dashboard'a giriş yapabilirsiniz.</p>
    `,
  };

  await sendEmail({ to: email, subject: template.subject, html: template.html });
}

export async function sendOrderCreatedEmail(
  email: string,
  order: Order
): Promise<void> {
  const template: EmailTemplate = {
    subject: `Yeni Sipariş Alındı - #${order.orderNumber}`,
    html: `
      <h1>Yeni Siparişiniz</h1>
      <p>Merhaba ${order.customerName},</p>
      <p><strong>#${order.orderNumber}</strong> numaralı siparişiniz başarıyla oluşturuldu.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Ürün:</strong> ${order.productName}</p>
        <p style="margin: 8px 0 0 0;"><strong>Tutar:</strong> ${order.totalAmount} ${order.currency}</p>
      </div>
      <p>Siparişiniz incelendikten sonra üretime başlanacaktır.</p>
    `,
  };

  await sendEmail({ to: email, subject: template.subject, html: template.html });
}

// ============================================
// Push Notifications
// ============================================

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
    VALUES (${userId}, ${subscription.endpoint}, ${subscription.p256dh}, ${subscription.auth}, NOW())
    ON CONFLICT (endpoint) DO UPDATE SET
      p256dh = ${subscription.p256dh},
      auth = ${subscription.auth},
      updated_at = NOW()
  `;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await sql`
    DELETE FROM push_subscriptions
    WHERE endpoint = ${endpoint}
  `;
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const subscriptions = await sql`
    SELECT * FROM push_subscriptions
    WHERE user_id = ${userId}
  `;

  const subscriptionsRows = subscriptions as any[];
  if (subscriptionsRows.length === 0) return;

  if (!webpush) {
    console.warn('Web push is not configured. Skipping push notification.');
    return;
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys are missing. Skipping push notification.');
    return;
  }

  webpush.setVapidDetails(
    'mailto:support@renkflow.com',
    vapidPublicKey,
    vapidPrivateKey
  );

  const payload = JSON.stringify({
    title,
    body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data,
    actions: [
      { action: 'open', title: 'Görüntüle' },
      { action: 'close', title: 'Kapat' },
    ],
  });

  for (const sub of subscriptionsRows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
    } catch (error) {
      // Subscription expired or invalid
      if ((error as any).statusCode === 410) {
        await removePushSubscription(sub.endpoint);
      }
      console.error('Push notification failed:', error);
    }
  }
}

// ============================================
// Notification Preferences
// ============================================

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  const prefsResult = await sql`
    SELECT * FROM notification_preferences
    WHERE user_id = ${userId}
  `;
  const prefsRows = prefsResult as any[];
  const prefs = prefsRows[0];

  if (!prefs) return null;

  return {
    userId: prefs.user_id,
    email: jsonValue(prefs.email),
    push: jsonValue(prefs.push),
    inApp: jsonValue(prefs.in_app),
  };
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  await sql`
    INSERT INTO notification_preferences (user_id, email, push, in_app, updated_at)
    VALUES (
      ${userId},
      ${preferences.email ? JSON.stringify(preferences.email) : '{}'}::text::jsonb,
      ${preferences.push ? JSON.stringify(preferences.push) : '{}'}::text::jsonb,
      ${preferences.inApp ? JSON.stringify(preferences.inApp) : '{}'}::text::jsonb,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = COALESCE(${preferences.email ? JSON.stringify(preferences.email) : null}::text::jsonb, notification_preferences.email),
      push = COALESCE(${preferences.push ? JSON.stringify(preferences.push) : null}::text::jsonb, notification_preferences.push),
      in_app = COALESCE(${preferences.inApp ? JSON.stringify(preferences.inApp) : null}::text::jsonb, notification_preferences.in_app),
      updated_at = NOW()
  `;
}

// ============================================
// Smart Notification Orchestrator
// ============================================

export async function notifyOrderStatusChange(
  order: Order,
  tenantId: string,
  oldStatus: OrderStatus,
  changedBy: string
): Promise<void> {
  // Get tenant members
  const members = await sql`
    SELECT u.id, u.email, u.name
    FROM tenant_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.tenant_id = ${tenantId}
  `;

  const membersRows = members as any[];
  for (const member of membersRows) {
    const prefs = await getNotificationPreferences(member.id);

    // In-app notification for all
    if (!prefs || prefs.inApp['order:status_changed'] !== false) {
      await createNotification(
        member.id,
        tenantId,
        'order:status_changed',
        'Sipariş Durumu Güncellendi',
        `#${order.orderNumber} siparişinin durumu ${oldStatus} → ${order.status} olarak değiştirildi.`,
        { orderId: order.id, oldStatus, newStatus: order.status },
        ['in_app']
      );
    }

    // Email notification if enabled
    if (prefs?.email['order:status_changed'] !== false) {
      await sendOrderStatusEmail(member.email, order, oldStatus);
    }

    // Push notification if enabled
    if (prefs?.push['order:status_changed'] !== false) {
      await sendPushNotification(
        member.id,
        'Sipariş Durumu Güncellendi',
        `#${order.orderNumber} - ${order.status}`,
        { orderId: order.id }
      );
    }
  }
}

// ============================================
// Helpers
// ============================================

/** jsonb written before the ::jsonb cast holds a JSON string; read both shapes the same way. */
function jsonValue<T>(value: unknown): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

function mapNotificationRow(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data: jsonValue(row.data),
    channels: jsonValue(row.channels),
    read: row.read,
    readAt: row.read_at ? new Date(row.read_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Tells each person the work orders just assigned to them: one notification per person, unless
 * they turned this kind of notification off. Never throws: the assignment already happened.
 */
export async function notifyWorkOrdersAssigned(
  tenantId: string,
  jobs: Array<{ id: string; title: string; assignedTo: string; assigneeRole?: string; color?: string | null }>,
  except?: string,
) {
  const byPerson = new Map<string, typeof jobs>();
  for (const job of jobs) if (job.assignedTo !== except) byPerson.set(job.assignedTo, [...(byPerson.get(job.assignedTo) ?? []), job]);
  await Promise.all(
    [...byPerson].map(async ([userId, list]) => {
      try {
        const prefs = await getNotificationPreferences(userId);
        if ((prefs?.inApp as Record<string, unknown> | undefined)?.['work_order:assigned'] === false) return;
        // A worker follows work in the factory screen; the others in production.
        const href = list[0].assigneeRole === 'worker' ? '/factory' : '/production';
        // The colour goes as text ("RAL 7016 Mat"); the notice screen draws the swatch from it.
        const named = (j: (typeof list)[number]) => (j.color ? `${j.title} (${j.color})` : j.title);
        const message = list.length === 1 ? `${named(list[0])} size atandı.` : `${list.length} üretim emri size atandı: ${list.slice(0, 3).map(named).join('; ')}${list.length > 3 ? '; …' : ''}`;
        const colors = [...new Set(list.map((j) => j.color).filter((c): c is string => Boolean(c)))];
        await createNotification(userId, tenantId, 'work_order:assigned', list.length === 1 ? 'Yeni üretim emri' : `${list.length} yeni üretim emri`, message, { workOrderIds: list.map((j) => j.id), href, colors });
      } catch (error) {
        console.error('[notifications] work order assignment notice failed', error instanceof Error ? error.message : error);
      }
    }),
  );
}
