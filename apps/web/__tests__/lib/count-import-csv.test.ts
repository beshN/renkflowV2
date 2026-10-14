import { countCsvTemplate, parseCountCsv } from '@/lib/features/warehouse/count-import/csv';

const parse = (row: string, extra = '') => parseCountCsv('Malzeme;Miktar;Birim' + extra + '\n' + row);
test('Turkish template keeps pieces, metres and whole bars distinct', () => {
  const doc = parseCountCsv(countCsvTemplate());
  expect(doc.rows.map((r) => [r.unit, r.quantity, r.pieceLengthMm, r.issues])).toEqual([['adet', 20, null, []], ['m', 120, null, []], ['boy', 10, 6000, []]]);
  expect(doc.pages).toBe(0);
});
test('BOM, comma delimiter, quoted multiline cells and file line numbers', () => {
  const doc = parseCountCsv('\uFEFFMalzeme,Miktar,Birim\n"Köşe\nparçası",12,adet\nKapak,3,takım');
  expect(doc.rows[0].name).toBe('Köşe\nparçası');
  expect(doc.rows[1].ref).toBe('csv-4');
});
test('unsafe structure and excessive rows fail before creating a suggestion', () => {
  expect(() => parseCountCsv('Malzeme;Miktar\nKapak;2')).toThrow(/Birim/);
  expect(() => parseCountCsv('Malzeme;Miktar;Birim;Adet\nKapak;2;adet;3')).toThrow(/birden fazla/);
  expect(() => parse('Kapak;2;adet;?',';Bilinmez')).toThrow(/Bilinmeyen/);
  expect(() => parse('"Kapak;2;adet')).toThrow(/tırnak/);
  expect(() => parseCountCsv('Malzeme;Miktar;Birim\n' + 'Kapak;2;adet\n'.repeat(501))).toThrow(/500/);
});
test.each(['Kapak;0;adet', 'Kapak;-2;adet', 'Kapak;1,5;takım', 'Kapak;2;kg', 'Kapak;1,0000001;adet', 'Kapak;nan;adet'])('invalid quantity/unit never applies: %s', (row) => {
  expect(parse(row).rows[0].issues.length).toBeGreaterThan(0);
});
test('profile code, weight and whole bar length are explicit', () => {
  expect(parse('Profil;120;m').rows[0].issues.join()).toMatch(/Profil kodu.*gramaj/);
  expect(parse('Profil;10;boy').rows[0].issues.join()).toMatch(/çubuk boyu/);
  const bad = parse('Profil;120;m;900;1,25;200', ';Kod;Gramaj (kg/m);Ağırlık (kg)');
  expect(bad.rows[0].issues.join()).toMatch(/Gramaj tutarsız/);
  const good = parse('Profil;10;boy;900;6000;1,25;75', ';Kod;Çubuk boyu (mm);Gramaj (kg/m);Ağırlık (kg)');
  expect(good.rows[0].issues).toEqual([]);
});
test('conflicting states, sizes and colours cannot silently create a different card', () => {
  expect(parse('40x60 / Mavi;2;adet;40x40;Kırmızı;boyasız', ';Ölçü;Renk;İşlenmiş hâl').rows[0].issues.join()).toMatch(/farklı ölçüler.*farklı renkler.*boya rengi/);
  expect(parse('Kapak;2;adet;boyalı|boyasız', ';İşlenmiş hâl').rows[0].issues.join()).toMatch(/aynı satır/);
});
test('same material in different sections is flagged on both rows', () => {
  const doc = parseCountCsv('Bölüm;Malzeme;Miktar;Birim\nA;Kapak;2;adet\nB;Kapak;3;adet');
  expect(doc.rows.every((r) => r.issues.join().includes('iki kez'))).toBe(true);
});

test('dictionary prototype names are never accepted as units or states', () => {
  expect(parse('Kapak;2;constructor').rows[0].issues.join()).toMatch(/Birim/);
  expect(parse('Kapak;2;adet;constructor', ';İşlenmiş hâl').rows[0].issues.join()).toMatch(/bilinmiyor/);
  expect(() => parse('Kapak;2;adet;value', ';constructor')).toThrow(/Bilinmeyen/);
});
test('raw colour retains unpainted material identity', () => {
  expect(parse('Profil;10;boy;900;6000;Boyasız', ';Kod;Çubuk boyu (mm);Renk').rows[0]).toMatchObject({states:['boyasiz'], issues:[]});
});
