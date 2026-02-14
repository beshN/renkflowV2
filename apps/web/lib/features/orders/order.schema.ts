import { z } from 'zod';
import { CurrencySchema } from '@/lib/types/currency';
import {
  ORDER_ALLOWED_FILE_TYPES,
  ORDER_MAX_UPLOAD_COUNT,
  ORDER_MAX_UPLOAD_SIZE_BYTES,
} from '@/lib/features/orders/constants';

// ============================================
// Sanitization Utilities
// ============================================

/**
 * Remove potentially dangerous characters for SQL/XSS prevention
 */
function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Strict sanitization for names (letters, spaces, Turkish chars only)
 */
function sanitizeName(str: string): string {
  return str
    .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ\s'-]/g, '')
    .trim();
}

/**
 * Sanitize phone number (digits, +, spaces, dashes only)
 */
function sanitizePhone(str: string): string {
  return str.replace(/[^0-9+\s\-()]/g, '').trim();
}

// ============================================
// Custom Zod Transformers
// ============================================

const sanitizedString = z.string().transform(sanitizeString);
const sanitizedName = z.string().transform(sanitizeName);
const sanitizedPhone = z.string().transform(sanitizePhone);

function parseLocalizedFloat(value: string): number | undefined {
  const normalized = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? undefined : parsed;
}

const safePositiveInt = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  },
  z.number()
    .int('Tam sayı olmalıdır')
    .positive('Pozitif olmalıdır')
    .max(999999, 'Çok büyük değer')
    .finite('Geçersiz sayı')
);

const safePositiveNumber = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      return parseLocalizedFloat(val);
    }
    return val;
  },
  z.number()
    .positive('Pozitif olmalıdır')
    .max(99999999.99, 'Çok büyük değer')
    .finite('Geçersiz sayı')
);

const safeNonNegativeNumber = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      return parseLocalizedFloat(val);
    }
    return val;
  },
  z.number()
    .min(0, 'Negatif olamaz')
    .max(99999999.99, 'Çok büyük değer')
    .finite('Geçersiz sayı')
);

const optionalDate = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'Geçerli bir tarih giriniz',
    })
    .refine((date) => new Date(date) >= new Date(new Date().setHours(0, 0, 0, 0)), {
      message: 'Teslimat tarihi geçmiş olamaz',
    })
    .optional()
);

const optionalEmail = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  z.string().email('Geçerli bir e-posta adresi giriniz').max(254, 'E-posta çok uzun').optional()
);

const optionalPhone = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  sanitizedPhone
    .pipe(z.string().min(10, 'Geçerli bir telefon numarası giriniz').max(20, 'Telefon numarası çok uzun'))
    .optional()
);

const optionalNotes = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  sanitizedString.pipe(z.string().max(2000, 'Notlar çok uzun')).optional()
);

// ============================================
// Order Schemas
// ============================================

export const orderItemSchema = z.object({
  productName: sanitizedString.pipe(z.string().min(1, 'Ürün adı gereklidir').max(200, 'Ürün adı çok uzun')),
  quantity: safePositiveInt,
  unitPrice: safePositiveNumber.optional(),
  totalPrice: safePositiveNumber.optional(),
  description: sanitizedString.pipe(z.string().max(1000, 'Açıklama çok uzun')).optional(),
});

export const createOrderSchema = z.object({
  customerName: sanitizedName.pipe(
    z.string().min(2, 'Müşteri adı en az 2 karakter olmalıdır').max(100, 'Müşteri adı çok uzun')
  ),
  email: optionalEmail,
  phone: optionalPhone,
  productName: sanitizedString.pipe(
    z.string().min(1, 'Ürün adı gereklidir').max(200, 'Ürün adı çok uzun')
  ),
  quantity: safePositiveInt.refine((val) => val <= 10000, {
    message: 'Miktar 10.000\'den fazla olamaz',
  }),
  totalAmount: safeNonNegativeNumber,
  currency: CurrencySchema.default('TRY'),
  deliveryDate: optionalDate,
  notes: optionalNotes,
});

export const updateOrderSchema = z.object({
  customerName: sanitizedName.pipe(z.string().min(2).max(100)).optional(),
  email: optionalEmail,
  phone: optionalPhone,
  productName: sanitizedString.pipe(z.string().min(1).max(200)).optional(),
  quantity: safePositiveInt.optional(),
  totalAmount: safeNonNegativeNumber.optional(),
  currency: CurrencySchema.optional(),
  deliveryDate: optionalDate,
  notes: optionalNotes,
  status: z.enum(['pending', 'in_production', 'delivered']).optional(),
});

export const orderIdSchema = z
  .string()
  .uuid('Geçersiz sipariş ID formatı')
  .or(z.string().regex(/^ORD\d+$/, 'Geçersiz sipariş numarası'));

export const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'in_production', 'delivered'], {
    message: 'Geçersiz durum değeri',
  }),
});

// ============================================
// File Upload Validation
// ============================================

export const fileUploadSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().max(ORDER_MAX_UPLOAD_SIZE_BYTES, 'Dosya boyutu 10MB\'dan büyük olamaz'),
  type: z.string().refine((type) => ORDER_ALLOWED_FILE_TYPES.includes(type as (typeof ORDER_ALLOWED_FILE_TYPES)[number]), {
    message: 'Desteklenmeyen dosya türü',
  }),
});

export function validateFiles(files: File[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (files.length > ORDER_MAX_UPLOAD_COUNT) {
    errors.push(`En fazla ${ORDER_MAX_UPLOAD_COUNT} dosya yüklenebilir`);
  }

  for (const file of files) {
    if (file.size > ORDER_MAX_UPLOAD_SIZE_BYTES) {
      errors.push(`${file.name}: Dosya boyutu 10MB'dan büyük`);
    }
    if (!ORDER_ALLOWED_FILE_TYPES.includes(file.type as (typeof ORDER_ALLOWED_FILE_TYPES)[number])) {
      errors.push(`${file.name}: Desteklenmeyen dosya türü`);
    }
    if (/[<>:"/\\|?*]/.test(file.name)) {
      errors.push(`${file.name}: Dosya adında geçersiz karakterler var`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// Type Exports
// ============================================

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

// ============================================
// Validation Helpers
// ============================================

export function validateCreateOrder(data: unknown): CreateOrderInput {
  return createOrderSchema.parse(data);
}

export function validateUpdateOrder(data: unknown): UpdateOrderInput {
  return updateOrderSchema.parse(data);
}

export function safeValidateCreateOrder(data: unknown) {
  return createOrderSchema.safeParse(data);
}

export function safeValidateUpdateOrder(data: unknown) {
  return updateOrderSchema.safeParse(data);
}

export function formatValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }

  return errors;
}
