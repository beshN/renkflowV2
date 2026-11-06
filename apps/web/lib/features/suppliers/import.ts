import { csvRecords, mapColumns } from '@/lib/features/import/csv';
import { phoneKey } from '@/lib/features/customers/import';
import { foldText } from '@/lib/shared/text/fold';

const HEADERS = {
  name: ['ad', 'adi', 'isim', 'name', 'tedarikci', 'tedarikciadi', 'firma', 'firmaadi', 'unvan'],
  code: ['kod', 'code', 'tedarikcikodu'], contact_name: ['yetkili', 'ilgili', 'contactname'],
  phone: ['telefon', 'tel', 'gsm', 'phone'], email: ['eposta', 'email', 'mail'],
  address: ['adres', 'address'], tax_number: ['vkn', 'vergino', 'verginumarasi', 'taxnumber'],
  tax_office: ['vergidairesi', 'taxoffice'], payment_terms: ['vade', 'vadegun', 'paymentterms'], notes: ['not', 'notlar', 'aciklama', 'notes'],
};
export type SupplierImportFields = Record<Exclude<keyof typeof HEADERS, 'payment_terms'>, string | null> & { name: string; payment_terms: number | null };
export function supplierIdentity(d: SupplierImportFields) {
  const phone = phoneKey(d.phone);
  return { tax: d.tax_number, email: d.email?.toLowerCase(), phone: phone.length === 10 ? phone : null, name: foldText(d.name) };
}
export function parseSupplierImport(text: string) {
  const records = csvRecords(text);
  if (records.length < 2) throw new Error('Dosyada başlık satırı ve en az bir tedarikçi olmalı');
  const { map, ignored } = mapColumns(records[0].cells, HEADERS);
  if (map.name === undefined) throw new Error('Tedarikçi adı sütunu bulunamadı');
  if (records.length > 2001) throw new Error('Tek seferde en fazla 2000 tedarikçi aktarılabilir');
  const rows = records.slice(1).map(r => {
    const values = Object.fromEntries(Object.keys(HEADERS).map(f => {
      const at = map[f as keyof typeof HEADERS];
      return [f, at === undefined ? null : r.cells[at]?.trim().replace(/\s+/g, ' ') || null];
    }));
    const terms = values.payment_terms;
    const data = { ...values, name: values.name || '', email: values.email?.toLowerCase() || null, payment_terms: terms === null ? null : Number(terms) } as SupplierImportFields;
    const errors: string[] = [];
    if (!data.name) errors.push('Tedarikçi adı boş');
    if (data.name.length > 180) errors.push('Tedarikçi adı en fazla 180 karakter olabilir');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('E-posta geçersiz');
    if (terms !== null && (!/^\d+$/.test(terms) || !Number.isInteger(data.payment_terms) || data.payment_terms! > 365)) errors.push('Vade 0–365 arasında tam sayı gün olmalı');
    return { line: r.line, data, errors };
  });
  return { rows, ignored, columns: Object.fromEntries(Object.entries(map).map(([f, at]) => [f, records[0].cells[at!]])) };
}
export const SUPPLIER_IMPORT_TEMPLATE = 'Ad;Kod;Yetkili;Telefon;E-posta;Adres;VKN;Vergi Dairesi;Vade;Not\r\n';
