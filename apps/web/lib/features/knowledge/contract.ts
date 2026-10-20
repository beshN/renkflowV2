import { z } from 'zod';
import { ORDER_ALLOWED_FILE_TYPES } from '@/lib/features/orders/constants';
export const VisibilitySchema = z.enum(['company', 'office', 'managers']);
export type KnowledgeVisibility = z.infer<typeof VisibilitySchema>;
export const KNOWLEDGE_VISIBILITY: Record<KnowledgeVisibility, string> = {
  company: 'Tüm ekip',
  office: 'Ofis ve yönetim',
  managers: 'Yalnız yöneticiler',
};
export function mayReadKnowledge(
  role: string,
  visibility: KnowledgeVisibility,
) {
  return (
    visibility === 'company' ||
    ['owner', 'admin'].includes(role) ||
    (visibility === 'office' && ['office', 'accountant'].includes(role))
  );
}
export const KnowledgeFileSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    mime: z.enum(ORDER_ALLOWED_FILE_TYPES),
    blobPath: z.string().max(700).optional(),
    base64: z
      .string()
      .max(14_000_000)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .optional(),
  })
  .refine(
    (d) => Boolean(d.blobPath) !== Boolean(d.base64),
    'Tek dosya kaynağı gerekli.',
  );
export const KnowledgeWriteSchema = z
  .object({
    id: z.string().uuid().optional(),
    version: z.number().int().nonnegative().default(0),
    title: z.string().trim().min(1).max(180),
    content: z.string().max(100_000).default(''),
    categoryId: z.string().uuid().nullable().default(null),
    visibility: VisibilitySchema.default('company'),
    note: z.string().trim().max(500).default(''),
    file: KnowledgeFileSchema.optional(),
    removeFile: z.boolean().default(false),
  })
  .refine(
    (d) => !(d.file && d.removeFile),
    'Dosyayı değiştirin veya kaldırın.',
  );
