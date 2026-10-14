// Customer list (CSV from Excel, another program or an old system) → validated rows. Pure: runs in
// the browser for the preview and on the server before writing.

import { parseCsvRecords } from '@/lib/features/products/csv';
import { foldText } from '@/lib/shared/text/fold';

export type CustomerImportFields = {
  fullName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  notes: string | null;
};
export type CustomerImportRow = { line: number; data: CustomerImportFields; errors: string[] };
export type ParsedCustomerImport = { rows: CustomerImportRow[]; columns: Partial<Record<keyof CustomerImportFields, string>>; ignored: string[] };

export const MAX_IMPORT_ROWS = 2000;

const HEADERS: Record<keyof CustomerImportFields, string[]> = {
  fullName: ['adsoyad', 'ad', 'adi', 'isim', 'musteri', 'musteriadi', 'yetkili', 'kisi', 'name', 'fullname', 'unvan', 'cari', 'cariadi', 'cariunvani'],
  companyName: ['firma', 'firmaadi', 'sirket', 'sirketadi', 'company', 'kurum'],
  phone: ['telefon', 'tel', 'gsm', 'cep', 'ceptelefonu', 'phone', 'mobile'],
  email: ['eposta', 'email', 'mail', 'epostaadresi'],
  taxNumber: ['vkn', 'tckn', 'vkntckn', 'vergino', 'verginumarasi', 'taxnumber', 'vergikimlikno'],
  taxOffice: ['vergidairesi', 'vd', 'taxoffice'],
  address: ['adres', 'acikadres', 'faturaadresi', 'address'],
  city: ['il', 'sehir', 'city'],
  district: ['ilce', 'district', 'semt'],
  notes: ['not', 'notlar', 'aciklama', 'notes'],
};

const key = (header: string) => foldText(header).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Which file column feeds which field; exact names first, then prefixes ("Telefon (iş)"). */
function mapColumns(header: string[]) {
  const keys = header.map(key);
  const used = new Set<number>();
  const map: Partial<Record<keyof CustomerImportFields, number>> = {};
  for (const exact of [true, false]) {
    for (const field of Object.keys(HEADERS) as (keyof CustomerImportFields)[]) {
      if (map[field] !== undefined) continue;
      const at = keys.findIndex((k, i) => !used.has(i) && HEADERS[field].some((name) => (exact ? k === name : k.startsWith(name) && name.length >= 3)));
      if (at !== -1) { map[field] = at; used.add(at); }
    }
  }
  return { map, ignored: header.filter((h, i) => h.trim() && !used.has(i)) };
}

export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const tenth = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
  return ((tenth + 10) % 10) === d[9] && d.slice(0, 10).reduce((s, x) => s + x, 0) % 10 === d[10];
}

export const phoneKey = (value?: string | null) => (value || '').replace(/\D/g, '').slice(-10);

/** The identifiers a row is matched by: tax number, e-mail, phone (last 10 digits), folded name. */
export function identityKeys(d: Pick<CustomerImportFields, 'taxNumber' | 'email' | 'phone' | 'fullName' | 'companyName'>) {
  return {
    tax: d.taxNumber || null,
    email: d.email?.toLowerCase() || null,
    phone: phoneKey(d.phone).length === 10 ? phoneKey(d.phone) : null,
    name: foldText(d.companyName || d.fullName),
  };
}

const clean = (value: string | undefined, max: number) => {
  const v = (value ?? '').trim().replace(/\s+/g, ' ');
  return v ? v.slice(0, max) : null;
};

export function parseCustomerImport(text: string): ParsedCustomerImport {
  const records = parseCsvRecords(text).filter((r) => r.cells.some((c) => c.trim()));
  if (records.length < 2) throw new Error('Dosyada başlık satırı ve en az bir müşteri olmalı');
  const { map, ignored } = mapColumns(records[0].cells);
  if (map.fullName === undefined && map.companyName === undefined) throw new Error('Ad ya da firma sütunu bulunamadı (örnek başlıklar: "Ad Soyad", "Firma")');
  const body = records.slice(1);
  if (body.length > MAX_IMPORT_ROWS) throw new Error(`Tek seferde en fazla ${MAX_IMPORT_ROWS} müşteri aktarılabilir (dosyada ${body.length})`);

  const cell = (cells: string[], field: keyof CustomerImportFields) => (map[field] === undefined ? undefined : cells[map[field]!]);
  const seen = new Map<string, number>();
  const rows = body.map((r): CustomerImportRow => {
    const errors: string[] = [];
    const companyName = clean(cell(r.cells, 'companyName'), 200);
    const fullName = clean(cell(r.cells, 'fullName'), 200) ?? companyName ?? '';
    const email = clean(cell(r.cells, 'email'), 320)?.toLowerCase() ?? null;
    const taxNumber = clean(cell(r.cells, 'taxNumber'), 40)?.replace(/\s/g, '') ?? null;
    const data: CustomerImportFields = {
      // A row with only a company name uses it as the card name too.
      fullName, companyName,
      phone: clean(cell(r.cells, 'phone'), 60), email, taxNumber, taxOffice: clean(cell(r.cells, 'taxOffice'), 120),
      address: clean(cell(r.cells, 'address'), 1000), city: clean(cell(r.cells, 'city'), 80), district: clean(cell(r.cells, 'district'), 80), notes: clean(cell(r.cells, 'notes'), 5000),
    };
    if (!fullName) errors.push('Ad ya da firma boş');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('E-posta geçersiz');
    if (taxNumber && !/^\d{10}$/.test(taxNumber) && !(/^\d{11}$/.test(taxNumber) && isValidTckn(taxNumber))) errors.push('VKN 10 haneli ya da TCKN 11 haneli ve geçerli olmalı');
    const ids = identityKeys(data);
    for (const [kind, value] of [['tax', ids.tax], ['email', ids.email], ['phone', ids.phone]] as const) {
      if (!value) continue;
      const earlier = seen.get(`${kind}:${value}`);
      if (earlier) errors.push(`Satır ${earlier} ile aynı ${kind === 'tax' ? 'vergi numarası' : kind === 'email' ? 'e-posta' : 'telefon'}`);
      else seen.set(`${kind}:${value}`, r.line);
    }
    return { line: r.line, data, errors };
  });
  const columns = Object.fromEntries(Object.entries(map).map(([field, i]) => [field, records[0].cells[i!]])) as ParsedCustomerImport['columns'];
  return { rows, columns, ignored };
}

/** Template the import page offers for download. */
export const CUSTOMER_IMPORT_TEMPLATE = 'Ad Soyad;Firma;Telefon;E-posta;VKN/TCKN;Vergi Dairesi;Adres;İl;İlçe;Not\r\nAyşe Yılmaz;;0555 111 22 33;ayse@ornek.com;;;Moda Cad. 1;İstanbul;Kadıköy;Pergola teklifi istedi\r\n';
