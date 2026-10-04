import { z } from 'zod';
import type { Permission } from '@/lib/auth/permissions';

export const OrderQrActionKeySchema = z.enum([
  'status.set_pending',
  'status.set_in_production',
  'status.set_delivered',
  'note.add',
  'photo.upload',
]);

export type OrderQrActionKey = z.infer<typeof OrderQrActionKeySchema>;

const NotePayloadSchema = z.object({
  note: z.string().trim().min(1, 'Not boş olamaz').max(2000, 'Not çok uzun'),
});

const PhotoPayloadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) =>
        value === 'application/pdf' ||
        /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/.test(value),
      'Yalnızca görsel veya PDF yüklenebilir'
    ),
  base64Data: z.string().trim().min(1).max(14_000_000).optional(),
  blobPath: z.string().max(700).optional(),
  note: z.string().trim().max(500).optional(),
}).refine(d => Boolean(d.base64Data) !== Boolean(d.blobPath), "Bir dosya kaynağı gerekli");

const EmptyPayloadSchema = z.object({}).passthrough();

export type QrActionPayloadMap = {
  'status.set_pending': z.infer<typeof EmptyPayloadSchema>;
  'status.set_in_production': z.infer<typeof EmptyPayloadSchema>;
  'status.set_delivered': z.infer<typeof EmptyPayloadSchema>;
  'note.add': z.infer<typeof NotePayloadSchema>;
  'photo.upload': z.infer<typeof PhotoPayloadSchema>;
};

export interface OrderQrActionDefinition<K extends OrderQrActionKey = OrderQrActionKey> {
  key: K;
  label: string;
  description: string;
  requiredPermissions: Permission[];
  payloadSchema: z.ZodType<QrActionPayloadMap[K]>;
}

export const ORDER_QR_ACTIONS: Record<OrderQrActionKey, OrderQrActionDefinition> = {
  'status.set_pending': {
    key: 'status.set_pending',
    label: 'Beklemede',
    description: 'Sipariş durumunu Beklemede olarak günceller',
    requiredPermissions: ['orders.qr.execute', 'orders.qr.status'],
    payloadSchema: EmptyPayloadSchema,
  },
  'status.set_in_production': {
    key: 'status.set_in_production',
    label: 'Üretimde',
    description: 'Sipariş durumunu Üretimde olarak günceller',
    requiredPermissions: ['orders.qr.execute', 'orders.qr.status'],
    payloadSchema: EmptyPayloadSchema,
  },
  'status.set_delivered': {
    key: 'status.set_delivered',
    label: 'Teslim Edildi',
    description: 'Sipariş durumunu Teslim Edildi olarak günceller',
    requiredPermissions: ['orders.qr.execute', 'orders.qr.status'],
    payloadSchema: EmptyPayloadSchema,
  },
  'note.add': {
    key: 'note.add',
    label: 'Not Ekle',
    description: 'Sipariş notlarına yeni satır ekler',
    requiredPermissions: ['orders.qr.execute', 'orders.qr.note'],
    payloadSchema: NotePayloadSchema,
  },
  'photo.upload': {
    key: 'photo.upload',
    label: 'Fotoğraf Yükle',
    description: 'Siparişe fotoğraf/doküman yükler',
    requiredPermissions: ['orders.qr.execute', 'orders.qr.photo'],
    payloadSchema: PhotoPayloadSchema,
  },
};

export const ORDER_QR_ACTION_LIST = Object.values(ORDER_QR_ACTIONS);

export function getOrderQrActionDefinition(
  actionKey: OrderQrActionKey
): OrderQrActionDefinition<OrderQrActionKey> {
  return ORDER_QR_ACTIONS[actionKey];
}

export function isOrderQrActionKey(value: string): value is OrderQrActionKey {
  return OrderQrActionKeySchema.safeParse(value).success;
}
