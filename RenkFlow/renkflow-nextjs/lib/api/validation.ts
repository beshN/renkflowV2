import { z } from 'zod';
import { CurrencySchema } from '@/lib/types/currency';

/**
 * Type-Safe API Validation Layer
 * - Zod schemas for all data types
 * - Runtime type checking
 * - FormData parsing utilities
 */

// ============================================
// Base Schemas
// ============================================

export const OrderStatusSchema = z.enum(['pending', 'in_production', 'delivered']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url().optional(),
  type: z.string().optional(),
  size: z.number().optional(),
  uploadedAt: z.string().optional(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerName: z.string().min(1, 'Müşteri adı gerekli'),
  email: z.string().email('Geçerli email giriniz').optional().or(z.literal('')),
  phone: z.string().optional(),
  productName: z.string().min(1, 'Ürün adı gerekli'),
  quantity: z.number().int().positive('Miktar pozitif olmalı'),
  totalAmount: z.number().nonnegative('Toplam tutar negatif olamaz'),
  currency: CurrencySchema.default('TRY'),
  status: OrderStatusSchema,
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
  documents: z.array(DocumentSchema).optional().default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  tenantId: z.string().optional(),
});
export type Order = z.infer<typeof OrderSchema>;

// ============================================
// Form Schemas
// ============================================

export const NewOrderFormSchema = z.object({
  customerName: z.string().min(1, 'Müşteri adı gerekli'),
  email: z.string().email('Geçerli email giriniz').optional().or(z.literal('')),
  phone: z.string().optional(),
  productName: z.string().min(1, 'Ürün adı gerekli'),
  quantity: z.coerce.number().int().positive('Miktar pozitif olmalı'),
  totalAmount: z.coerce.number().nonnegative('Toplam tutar negatif olamaz'),
  currency: CurrencySchema.default('TRY'),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
});
export type NewOrderFormData = z.infer<typeof NewOrderFormSchema>;

export const UpdateOrderFormSchema = NewOrderFormSchema.partial().extend({
  status: OrderStatusSchema.optional(),
});
export type UpdateOrderFormData = z.infer<typeof UpdateOrderFormSchema>;

export const LoginFormSchema = z.object({
  email: z.string().email('Geçerli email giriniz'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
});
export type LoginFormData = z.infer<typeof LoginFormSchema>;

export const RegisterFormSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  email: z.string().email('Geçerli email giriniz'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
});
export type RegisterFormData = z.infer<typeof RegisterFormSchema>;

export const ResetPasswordFormSchema = z.object({
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
  confirmPassword: z.string(),
  token: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
});
export type ResetPasswordFormData = z.infer<typeof ResetPasswordFormSchema>;

// ============================================
// API Response Schemas
// ============================================

export const APISuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
  });

export const APIErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z
    .union([
      z.record(z.string(), z.string()),
      z.record(z.string(), z.any()),
      z.array(z.any()),
      z.string(),
    ])
    .optional(),
});

export const APIResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    APISuccessSchema(dataSchema),
    APIErrorSchema,
  ]);

// ============================================
// FormData Parsing Utilities
// ============================================

export interface ParseFormDataResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError['issues'];
}

/**
 * Parse and validate FormData with a Zod schema
 */
export function parseFormData<T extends z.ZodTypeAny>(
  formData: FormData,
  schema: T
): ParseFormDataResult<z.infer<T>> {
  const data: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    // Handle array fields (e.g., items[], documents[])
    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      if (!data[arrayKey]) {
        data[arrayKey] = [];
      }
      (data[arrayKey] as unknown[]).push(value);
    } else if (key.includes('[') && key.includes(']')) {
      // Handle nested fields (e.g., address[city])
      const match = key.match(/^(\w+)\[(\w+)\]$/);
      if (match) {
        const [, parent, child] = match;
        if (!data[parent]) {
          data[parent] = {};
        }
        (data[parent] as Record<string, unknown>)[child] = value;
      }
    } else {
      // Handle file uploads
      if (value instanceof File) {
        data[key] = value;
      } else {
        data[key] = value;
      }
    }
  });

  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error.issues };
}

/**
 * Parse JSON body with a Zod schema
 */
export function parseJSON<T extends z.ZodTypeAny>(
  json: unknown,
  schema: T
): ParseFormDataResult<z.infer<T>> {
  const result = schema.safeParse(json);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error.issues };
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(errors: z.ZodError['issues']) {
  const errorMap: Record<string, string> = {};
  
  errors.forEach((error) => {
    const path = error.path.join('.');
    errorMap[path] = error.message;
  });

  return {
    success: false as const,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errorMap,
  };
}

/**
 * Safe async handler wrapper for API routes
 */
export function withValidation<T extends z.ZodTypeAny, R>(
  schema: T,
  handler: (data: z.infer<T>) => Promise<R>
) {
  return async (input: unknown): Promise<R | ReturnType<typeof createValidationErrorResponse>> => {
    const result = parseJSON(input, schema);
    
    if (!result.success) {
      return createValidationErrorResponse(result.errors!);
    }
    
    return handler(result.data!);
  };
}

// ============================================
// Type Guards
// ============================================

export function isOrder(value: unknown): value is Order {
  return OrderSchema.safeParse(value).success;
}

export function isValidOrderStatus(value: unknown): value is OrderStatus {
  return OrderStatusSchema.safeParse(value).success;
}

export function isDocument(value: unknown): value is Document {
  return DocumentSchema.safeParse(value).success;
}
