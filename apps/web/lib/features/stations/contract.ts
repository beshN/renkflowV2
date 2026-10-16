import { z } from 'zod';
export const STATION_KINDS = [
  'warehouse',
  'cutting',
  'assembly',
  'packing',
] as const;
export type StationKind = (typeof STATION_KINDS)[number];
export const STATION_LABELS: Record<StationKind, string> = {
  warehouse: 'Depo',
  cutting: 'Kesim',
  assembly: 'Montaj',
  packing: 'Paketleme',
};
export const StationDefinitionSchema = z
  .object({
    checklistLabels: z
      .array(z.string().trim().min(2).max(180))
      .max(30)
      .default([]),
    name: z.string().trim().min(2).max(100),
    kind: z.enum(STATION_KINDS),
    workCenterCode: z.string().trim().min(1).max(80).nullable().default(null),
    warehouseId: z.string().uuid().nullable().default(null),
    instructionIds: z.array(z.string().uuid()).max(20).default([]),
  })
  .superRefine((d, ctx) => {
    if (
      d.kind === 'warehouse'
        ? !d.warehouseId || d.workCenterCode !== null
        : !d.workCenterCode || d.warehouseId !== null
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Depo için bir depo, üretim istasyonu için bir iş merkezi seçin.',
      });
  });
export type StationCapability = {
  deviceId: string;
  tokenHash: string;
  version: number;
  workCenterCode: string;
};
export type StationCheck = {
  key: string;
  label: string;
  checked: boolean;
  version: number;
};
export const stationCookieName = (secure: boolean) =>
  secure ? '__Host-rf-station' : 'rf-station-local';

export const STATION_DEFAULT_CHECKS: Record<StationKind, string[]> = {
  warehouse: [],
  cutting: [
    'Profil ve renk iş emriyle eşleşiyor',
    'Testere payı ve kesim ölçüleri doğrulandı',
  ],
  assembly: [
    'Ölçüler ve renk doğrulandı',
    'Bağlantılar ve sabitlemeler kontrol edildi',
    'Mekanizma çalışması kontrol edildi',
  ],
  packing: [
    'Ürün yüzeyi ve koruyucu ambalaj kontrol edildi',
    'Sipariş etiketi ve paket adedi doğrulandı',
  ],
};
