import { MATERIAL_IMPORT_TEMPLATE, parseMaterialCsv } from '@/lib/features/products/material-import';
const parse = (rows: string, extra = '') => parseMaterialCsv('Stok kodu;Ad;Tür;Birim' + extra + '\n' + rows);
test('template imports finished goods, profiles and consumables with explicit units', () => {
  const parsed = parseMaterialCsv(MATERIAL_IMPORT_TEMPLATE);
  expect(parsed.columns.sku).toBe('Stok kodu');
  expect(parsed.rows.every((r) => !r.errors.length)).toBe(true);
  expect(parsed.rows.map((r) => r.data?.itemType)).toEqual(['finished_good', 'raw_material', 'consumable']);
  expect(parsed.rows[1].data).toMatchObject({uom:'m', standardLengthMm:6000, weightPerMeterKg:1.25, processedStates:['boyali']});
});
test.each([
  ['X;Profil;hammadde;m', '', /boyunu/],
  ['X;Vida;sarf;adet;1,5', ';Minimum stok', /tam sayı/],
  ['X;Profil;hammadde;m;6000;1,25;100', ';Standart boy (mm);Gramaj (kg/m);Parça boyu (mm)', /kartta değil/],
  ['X;Profil;hammadde;m;6000;1,25;boyalı|boyasız', ';Standart boy (mm);Gramaj (kg/m);İşlenmiş hâl', /aynı kartta/],
])('invalid stock card stays an error: %s', (row, extra, message) => {
  expect(parse(row as string, extra as string).rows[0].errors.join()).toMatch(message as RegExp);
});
test('Turkish numbers, BOM and CSV line positions', () => {
  const parsed = parseMaterialCsv('\uFEFFStok kodu,Ad,Tür,Birim,Minimum stok\n"X","Örnek\nVida",sarf,adet,"1.250"\nY,Mamul,mamul,adet,0');
  expect(parsed.rows[0].data?.minStock).toBe(1250);
  expect(parsed.rows[1].line).toBe(4);
});
test('duplicate stock codes and profile identities mark both rows', () => {
  expect(parse('x;Kapak;sarf;adet\nX;Kapak;sarf;adet').rows.every((r) => r.errors.join().includes('tekrarlanıyor'))).toBe(true);
  const profile = parse('X;Bir;hammadde;adet;108;40x60\nY;İki;hammadde;adet;108;40X60', ';Profil kodu;Ölçü');
  expect(profile.rows.every((r) => r.errors.join().includes('tekrarlanıyor'))).toBe(true);
});
test('unknown/repeated headers, stock quantities, binary text and oversized lists fail', () => {
  expect(() => parse('X;Bir;sarf;adet;3',';Stok miktarı')).toThrow(/stok miktarı/);
  expect(() => parse('X;Bir;sarf;adet;X',';SKU')).toThrow(/birden fazla/);
  expect(() => parse('X;Bi\0r;sarf;adet')).toThrow(/CSV/);
  expect(() => parse('X;Bir;sarf;adet\n'.repeat(501))).toThrow(/500/);
});
test('prototype keys cannot masquerade as type or unit', () => {
  expect(parse('X;Bir;constructor;constructor').rows[0].errors.length).toBeGreaterThan(0);
});
