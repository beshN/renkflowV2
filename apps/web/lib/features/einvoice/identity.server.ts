import 'server-only';

import { z } from 'zod';

import { changedFields, recordAudit } from '@/lib/audit/audit-log';
import { columnExists } from '@/lib/db/schema-guard';
import { isValidSeriesPrefix } from './numbering';
import { isValidTckn } from './ubl';

// The firm's legal identity: printed on every invoice and required before an e-Belge is issued.

const FIELDS = ['legal_name', 'tax_number', 'tax_office', 'address_line', 'district', 'city', 'postal_code', 'mersis_no', 'trade_registry_no', 'phone', 'invoice_email', 'iban', 'e_fatura_prefix', 'e_arsiv_prefix'] as const;

/** IBAN check digits (ISO 13616 mod 97); Turkish IBANs are TR + 24 digits. */
export function isValidIban(value: string): boolean {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

const optional = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullish();

export const LegalIdentityInput = z.object({
  legalName: z.string().trim().min(2, 'Unvan en az 2 karakter olmalı').max(250),
  taxNumber: z.string().trim().refine((v) => /^\d{10}$/.test(v) || (/^\d{11}$/.test(v) && isValidTckn(v)), 'VKN 10 haneli, TCKN 11 haneli ve geçerli olmalı'),
  taxOffice: z.string().trim().min(2, 'Vergi dairesi gerekli').max(120),
  addressLine: z.string().trim().min(5, 'Açık adres gerekli').max(300),
  district: z.string().trim().min(2, 'İlçe gerekli').max(80),
  city: z.string().trim().min(2, 'İl gerekli').max(80),
  postalCode: z.string().trim().regex(/^(\d{5})?$/, 'Posta kodu 5 haneli olmalı').transform((v) => v || null).nullish(),
  mersisNo: z.string().trim().regex(/^(\d{16})?$/, 'MERSİS numarası 16 haneli olmalı').transform((v) => v || null).nullish(),
  tradeRegistryNo: optional(40),
  phone: optional(40),
  invoiceEmail: z.string().trim().max(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Geçersiz e-posta').transform((v) => v || null).nullish(),
  iban: z.string().trim().refine((v) => !v || isValidIban(v), 'IBAN doğrulanamadı (TR ile başlayan 26 karakter)').transform((v) => (v ? v.replace(/\s/g, '').toUpperCase() : null)).nullish(),
  eFaturaPrefix: z.string().trim().toUpperCase().refine(isValidSeriesPrefix, 'Seri öneki üç büyük harf olmalı'),
  eArsivPrefix: z.string().trim().toUpperCase().refine(isValidSeriesPrefix, 'Seri öneki üç büyük harf olmalı'),
}).strict().refine((v) => v.eFaturaPrefix !== v.eArsivPrefix, { message: 'e-Fatura ve e-Arşiv önekleri farklı olmalı', path: ['eArsivPrefix'] });

export type LegalIdentity = z.infer<typeof LegalIdentityInput>;

const toDto = (row: Record<string, any>) => ({
  legalName: row.legal_name ?? '', taxNumber: row.tax_number ?? '', taxOffice: row.tax_office ?? '', addressLine: row.address_line ?? '',
  district: row.district ?? '', city: row.city ?? '', postalCode: row.postal_code ?? '', mersisNo: row.mersis_no ?? '', tradeRegistryNo: row.trade_registry_no ?? '',
  phone: row.phone ?? '', invoiceEmail: row.invoice_email ?? '', iban: row.iban ?? '', eFaturaPrefix: row.e_fatura_prefix ?? 'RNK', eArsivPrefix: row.e_arsiv_prefix ?? 'RNA',
});

/** null until migration 053 is applied. */
export async function getLegalIdentity(db: any, tenantId: string) {
  if (!(await columnExists('tenants', 'legal_name'))) return null;
  const [row] = await db`SELECT name, ${db(FIELDS as unknown as string[])} FROM tenants WHERE id = ${tenantId}`;
  if (!row) return null;
  return { ...toDto(row), legalName: row.legal_name ?? row.name ?? '' };
}

export async function saveLegalIdentity(db: any, actor: { tenantId: string; userId: string }, raw: unknown) {
  const d = LegalIdentityInput.parse(raw);
  const values = {
    legal_name: d.legalName, tax_number: d.taxNumber, tax_office: d.taxOffice, address_line: d.addressLine, district: d.district, city: d.city,
    postal_code: d.postalCode ?? null, mersis_no: d.mersisNo ?? null, trade_registry_no: d.tradeRegistryNo ?? null, phone: d.phone ?? null,
    invoice_email: d.invoiceEmail ?? null, iban: d.iban ?? null, e_fatura_prefix: d.eFaturaPrefix, e_arsiv_prefix: d.eArsivPrefix,
  };
  return db.begin(async (tx: any) => {
    const [before] = await tx`SELECT ${tx(FIELDS as unknown as string[])} FROM tenants WHERE id = ${actor.tenantId} FOR UPDATE`;
    await tx`UPDATE tenants SET ${tx(values)}, updated_at = now() WHERE id = ${actor.tenantId}`;
    const changes = changedFields(before ?? {}, values);
    if (Object.keys(changes).length) {
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant', entityId: actor.tenantId, action: 'legal_identity_updated', changes });
    }
    return toDto(values);
  });
}
