import { z } from 'zod';
import { can, type Access } from '@/lib/security/access-matrix';

export const LotIdentifierSchema = z.string().trim().max(64).nullish().transform(value => value || null);
export const LotTraceQuerySchema = z.object({
  heat: LotIdentifierSchema,
  supplierLot: LotIdentifierSchema,
}).refine(value => Boolean(value.heat || value.supplierLot), 'Döküm veya tedarikçi lot numarası gerekli');

export function canTraceLots(access: Access): boolean {
  return ['owner', 'admin', 'office'].includes(access.base)
    && can(access, 'inventory', 'view') && can(access, 'production', 'view');
}
