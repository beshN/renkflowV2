import {
  parseSupplierImport,
  SUPPLIER_IMPORT_TEMPLATE,
} from '@/lib/features/suppliers/import';

describe('supplier CSV', () => {
  it('keeps company and contact separate', () => {
    const parsed = parseSupplierImport(SUPPLIER_IMPORT_TEMPLATE);
    expect(parsed.rows[0].data).toMatchObject({
      fullName: 'Ali Kaya',
      companyName: 'Örnek Profil Ltd.',
      email: 'satis@ornek.com',
    });
    expect(parsed.rows[0].errors).toEqual([]);
  });
  it('recognizes a supplier header without inventing a contact', () => {
    expect(
      parseSupplierImport('Tedarikçi;Telefon\nCam Sistemleri;05551112233')
        .rows[0].data,
    ).toMatchObject({ fullName: '', companyName: 'Cam Sistemleri' });
  });
  it('names unsupported columns and respects supplier field limits', () => {
    const parsed = parseSupplierImport(
      `Firma;Not;İl\n${'A'.repeat(181)};${'B'.repeat(2001)};İstanbul`,
    );
    expect(parsed.ignored).toContain('İl');
    expect(parsed.columns.city).toBeUndefined();
    expect(parsed.rows[0].errors).toEqual([
      'Tedarikçi adı 2–180 karakter olmalı',
      'Not en fazla 2000 karakter olabilir',
    ]);
  });
});
