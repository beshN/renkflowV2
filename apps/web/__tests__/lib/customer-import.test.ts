/**
 * Customer list import: column mapping, cleaning, validation and duplicates inside the file.
 */
import {
  CUSTOMER_IMPORT_TEMPLATE,
  identityKeys,
  MAX_IMPORT_ROWS,
  parseCustomerImport,
} from '@/lib/features/customers/import';

describe('customer import file', () => {
  it('maps Turkish headers in any order and cleans values', () => {
    const p = parseCustomerImport(
      [
        'E-Posta;Ad Soyad;GSM;Vergi No;Vergi Dairesi;İl;İlçe;Adres;Bölge',
        '  AYSE@Ornek.com ;Ayşe   Yılmaz;0555 111 22 33;10000000146;Kadıköy;İstanbul;Kadıköy;Moda Cad. 1;Anadolu',
      ].join('\n'),
    );
    expect(p.columns).toMatchObject({
      email: 'E-Posta',
      fullName: 'Ad Soyad',
      phone: 'GSM',
      taxNumber: 'Vergi No',
      taxOffice: 'Vergi Dairesi',
      city: 'İl',
      district: 'İlçe',
      address: 'Adres',
    });
    expect(p.ignored).toEqual(['Bölge']);
    expect(p.rows[0].data).toMatchObject({
      fullName: 'Ayşe Yılmaz',
      email: 'ayse@ornek.com',
      phone: '0555 111 22 33',
      taxNumber: '10000000146',
      city: 'İstanbul',
    });
    expect(p.rows[0].errors).toEqual([]);
    expect(p.rows[0].line).toBe(2);
  });

  it('uses the company name when there is no person', () => {
    const p = parseCustomerImport(
      'Firma,Telefon\nIşık İnşaat A.Ş.,02161112233',
    );
    expect(p.rows[0].data).toMatchObject({
      fullName: 'Işık İnşaat A.Ş.',
      companyName: 'Işık İnşaat A.Ş.',
    });
  });

  it('reads the downloadable template', () => {
    const p = parseCustomerImport(CUSTOMER_IMPORT_TEMPLATE);
    expect(Object.keys(p.columns).sort()).toEqual([
      'address',
      'city',
      'companyName',
      'district',
      'email',
      'fullName',
      'notes',
      'phone',
      'taxNumber',
      'taxOffice',
    ]);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0].errors).toEqual([]);
  });

  it('flags invalid values and duplicates inside the file', () => {
    const p = parseCustomerImport(
      [
        'Ad Soyad;E-posta;Telefon;VKN/TCKN',
        'Ali;ali@ornek;0555 000 00 01;123',
        ';;;',
        'Veli;veli@ornek.com;+90 (555) 000 00 02;10000000147',
        'Veli Kopya;VELI@ornek.com;5550000002;',
        ';x@y.com;;',
      ].join('\n'),
    );
    expect(p.rows.map((r) => [r.line, r.errors])).toEqual([
      [
        2,
        [
          'E-posta geçersiz',
          'VKN 10 haneli ya da TCKN 11 haneli ve geçerli olmalı',
        ],
      ],
      [4, ['VKN 10 haneli ya da TCKN 11 haneli ve geçerli olmalı']],
      [5, ['Satır 4 ile aynı e-posta', 'Satır 4 ile aynı telefon']],
      [6, ['Ad ya da firma boş']],
    ]);
  });

  it('explains files it cannot use', () => {
    expect(() => parseCustomerImport('Telefon;E-posta\n1;2')).toThrow(
      'Ad ya da firma sütunu bulunamadı',
    );
    expect(() => parseCustomerImport('Ad Soyad')).toThrow('en az bir müşteri');
    const big = [
      'Ad Soyad',
      ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Kişi ${i}`),
    ].join('\n');
    expect(() => parseCustomerImport(big)).toThrow('en fazla');
  });

  it('matches people by tax number, e-mail, last 10 phone digits and folded name', () => {
    expect(
      identityKeys({
        taxNumber: '1234567890',
        email: 'A@B.com',
        phone: '+90 555 000 00 02',
        fullName: 'Veli',
        companyName: 'IŞIK YAPI',
      }),
    ).toEqual({
      tax: '1234567890',
      email: 'a@b.com',
      phone: '5550000002',
      name: 'işik yapi',
    });
  });
  it('rejects unclosed quoted CSV and flags oversized fields instead of silently importing them', () => {
    expect(() => parseCustomerImport('Ad Soyad;Not\nAli;"kapanmamış')).toThrow(
      'kapanmamış tırnak',
    );
    const parsed = parseCustomerImport(`Ad Soyad\n${'a'.repeat(201)}`);
    expect(parsed.rows[0].errors).toContain(
      'Ad en fazla 200 karakter olabilir',
    );
  });
});
