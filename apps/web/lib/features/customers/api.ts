import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AuthenticationError,
  AuthorizationError,
  getServerUserContext,
  requirePermission,
  type Permission,
  type ServerUserContext,
} from '@/lib/features/auth/serverAuth';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

/** Firm and role come from the signed session and current membership, never from the first membership row. */
export async function requireCustomerActor(permission: Permission): Promise<ServerUserContext> {
  const context = await getServerUserContext();
  requirePermission(context, permission);
  return context;
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);

// Stored shape (013_erp_core.sql): [{ name, phone, email, title }]
const ContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(60).optional(),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
});

const customerFields = {
  fullName: z.string().trim().min(1, 'Müşteri adı zorunludur.').max(200),
  companyName: optionalText(200),
  email: z.string().trim().max(320).email('Geçerli bir e-posta girin.').optional().or(z.literal('')).transform((value) => value || null),
  phone: optionalText(60),
  address: optionalText(1000),
  taxNumber: optionalText(40),
  taxOffice: optionalText(120),
  billingAddress: optionalText(1000),
  shippingAddress: optionalText(1000),
  // Separate fields for e-Belge (migration 054).
  city: optionalText(80),
  district: optionalText(80),
  creditLimit: z.number().finite().nonnegative().max(9_999_999_999.99).nullable().optional(), // numeric(12,2)
  paymentTerms: z.number().int().min(0).max(365).optional(),
  notes: optionalText(5000),
  contacts: z.array(ContactSchema).max(50).optional(),
};

export const CreateCustomerSchema = z.object(customerFields).strict();
const UpdateCustomerSchema = z.object(customerFields).partial().strict();

/**
 * Zod still runs the null-transforms for keys that are absent from a partial object,
 * so only the keys the client actually sent may become SET clauses.
 */
export function parseCustomerUpdate(body: unknown) {
  const parsed = UpdateCustomerSchema.parse(body);
  const sent = new Set(body && typeof body === 'object' ? Object.keys(body) : []);
  const updates = Object.entries(parsed).filter(([key]) => sent.has(key)) as Array<[keyof typeof customerFields, unknown]>;
  if (updates.length === 0) throw new z.ZodError([{ code: 'custom', path: [], message: 'Güncellenecek alan bulunamadı.', input: body }]);
  return updates.map(([field, value]) => [CUSTOMER_COLUMNS[field], value] as const);
}

export const CUSTOMER_COLUMNS: Record<keyof typeof customerFields, string> = {
  fullName: 'full_name',
  companyName: 'company_name',
  email: 'email',
  phone: 'phone',
  address: 'address',
  taxNumber: 'tax_number',
  taxOffice: 'tax_office',
  billingAddress: 'billing_address',
  shippingAddress: 'shipping_address',
  city: 'city',
  district: 'district',
  creditLimit: 'credit_limit',
  paymentTerms: 'payment_terms',
  notes: 'notes',
  contacts: 'contacts',
};

export function customerErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthenticationError) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
  if (error instanceof AuthorizationError) return NextResponse.json({ error: 'Müşteri kayıtlarına erişim yetkiniz yok.' }, { status: 403 });
  if (error instanceof WorkOrderApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Geçersiz müşteri bilgisi.' }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  console.error('[Customers]', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
