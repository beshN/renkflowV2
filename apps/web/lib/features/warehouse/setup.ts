import { z } from 'zod';
export const WAREHOUSE_TYPES = { RAW: 'Hammadde', WIP: 'Üretim / yarı mamul', FINISHED: 'Mamul / sevkiyat', REUSABLE_REMNANTS: 'Kullanılabilir artıklar', SCRAP: 'Hurda', REJECTED: 'Kalite bekleyen / reddedilen' } as const;
export const WarehouseInputSchema = z.object({
  name: z.string().trim().min(2, 'Depo adı en az 2 karakter olmalı').max(100),
  code: z.string().trim().max(40).regex(/^[A-Za-z0-9ÇĞİÖŞÜçğıöşü._-]*$/, 'Depo kodunda boşluk kullanmayın').transform(v => v.toLocaleUpperCase('tr-TR')).default(''),
  type: z.enum(['RAW', 'WIP', 'FINISHED', 'REUSABLE_REMNANTS', 'SCRAP', 'REJECTED']).default('RAW'),
});
