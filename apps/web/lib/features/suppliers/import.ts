import {
  parseCustomerImport,
  type ParsedCustomerImport,
} from '@/lib/features/customers/import';

export function parseSupplierImport(text: string): ParsedCustomerImport {
  const parsed = parseCustomerImport(text);
  for (const field of ['city', 'district'] as const) {
    if (parsed.columns[field]) parsed.ignored.push(parsed.columns[field]!);
    delete parsed.columns[field];
  }
  for (const row of parsed.rows) {
    const name = row.data.companyName || row.data.fullName;
    const contact =
      row.data.companyName && row.data.fullName !== row.data.companyName
        ? row.data.fullName
        : '';
    if (name.length < 2 || name.length > 180)
      row.errors.push('Tedarikçi adı 2–180 karakter olmalı');
    if (contact.length > 180)
      row.errors.push('Yetkili en fazla 180 karakter olabilir');
    if ((row.data.notes?.length ?? 0) > 2000)
      row.errors.push('Not en fazla 2000 karakter olabilir');
    row.data.companyName = name;
    row.data.fullName = contact;
  }
  return parsed;
}

export const SUPPLIER_IMPORT_TEMPLATE =
  'Firma;Yetkili;Telefon;E-posta;VKN/TCKN;Vergi Dairesi;Adres;Not\r\nÖrnek Profil Ltd.;Ali Kaya;0216 111 22 33;satis@ornek.com;1234567890;Kadıköy;Sanayi Cad. 1;Profil tedarikçisi\r\n';
