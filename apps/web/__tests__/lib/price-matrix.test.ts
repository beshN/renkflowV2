import { parseCsv, readNumber, toCsv } from '@/lib/features/products/csv';
import { matrixTemplate, priceFromMatrix, readMatrixCsv } from '@/lib/features/products/price-matrix';

// Made-up figures for the test only.
const HEADER = 'aile;satir_turu;varyant;en_min_mm;en_max_mm;acilim_min_mm;acilim_max_mm;opsiyon;fiyat_esasi;birim_fiyat;para_birimi';
const file = (...rows: string[]) => [HEADER, ...rows].join('\n');

describe('csv', () => {
  it('reads semicolon or comma files, quotes and a BOM', () => {
    expect(parseCsv('﻿a;b\n"x;y";"he said ""hi"""\r\n')).toEqual([['a', 'b'], ['x;y', 'he said "hi"']]);
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv(toCsv([['a;b', 'c']]))).toEqual([['a;b', 'c']]);
  });

  it('takes the delimiter from the header row, not from a comment or quoted text', () => {
    expect(parseCsv('"# not; read"\na,b\n1,2')).toEqual([['# not; read'], ['a', 'b'], ['1', '2']]);
    expect(parseCsv('"x,y";b\n1;2')).toEqual([['x,y', 'b'], ['1', '2']]);
  });

  it('reads numbers as typed in Turkey and refuses the rest', () => {
    expect(readNumber('1.250,50')).toBe(1250.5);
    expect(readNumber('1250,5')).toBe(1250.5);
    expect(readNumber('1.250')).toBe(1250);
    expect(readNumber('1250.5')).toBe(1250.5);
    expect(readNumber('')).toBeNull();
    expect(readNumber('12a')).toBeNull();
    expect(readNumber('1,2,3')).toBeNull();
  });
});

describe('price matrix', () => {
  it('gives a template with the columns and no prices', () => {
    const rows = parseCsv(matrixTemplate('pergola')).filter((r) => !r[0].startsWith('#'));
    expect(rows).toEqual([HEADER.split(';')]);
    expect(() => matrixTemplate('yok')).toThrow();
  });

  it('reads a filled matrix and prices a measure inside its band, with options', () => {
    const read = readMatrixCsv(
      file(
        'pergola;taban;*;1000;3000;1000;3000;;adet;10.000;TRY',
        'Pergola;Taban;*;3001;6000;1000;3000;;m2;2.000,50;TRY',
        'pergola;taban;PRG-A;1000;3000;1000;3000;;adet;12.000;TRY',
        'pergola;opsiyon;*;;;;;motor;adet;1.500;TRY',
        'pergola;opsiyon;*;;;;;led;m2;100;TRY',
      ),
      'pergola',
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(priceFromMatrix(read.matrix, { variant: 'PRG-B', a: 2000, b: 2000, options: { motor: true, led: false } })).toMatchObject({ status: 'priced', currency: 'TRY', unitPrice: 11500, unpricedOptions: [] });
    // The variant's own band wins over "*".
    expect(priceFromMatrix(read.matrix, { variant: 'PRG-A', a: 3000, b: 1000, options: {} })).toMatchObject({ unitPrice: 12000 });
    // m² priced band and option: 4 m × 2,5 m = 10 m².
    expect(priceFromMatrix(read.matrix, { variant: 'x', a: 4000, b: 2500, options: { led: 1 } })).toMatchObject({ unitPrice: 21005 });
  });

  it('says when the measure is outside the matrix or an option has no price, never guesses', () => {
    const read = readMatrixCsv(file('pergola;taban;*;1000;3000;1000;3000;;adet;10;TRY'));
    if (!read.ok) throw new Error('expected ok');
    expect(priceFromMatrix(read.matrix, { variant: '*', a: 3500, b: 2000, options: {} })).toMatchObject({ status: 'not_covered' });
    expect(priceFromMatrix(read.matrix, { variant: '*', a: 2000, b: 2000, options: { sineklik: true } })).toMatchObject({ status: 'priced', unitPrice: 10, unpricedOptions: ['sineklik'] });
  });

  it('counts a chosen option as many times as its number and points errors at the file line', () => {
    const read = readMatrixCsv(file('pergola;taban;"*";1000;3000;1000;3000;;adet;10;TRY', 'pergola;opsiyon;*;;;;;motor;adet;5;TRY'));
    if (!read.ok) throw new Error('expected ok');
    expect(priceFromMatrix(read.matrix, { variant: '*', a: 2000, b: 2000, options: { motor: 2 } })).toMatchObject({ unitPrice: 20, lines: [{}, { label: 'Opsiyon: motor × 2', amount: 10 }] });
    // A cell with a line break (Alt+Enter in Excel) does not shift the line numbers after it.
    const broken = readMatrixCsv(file('pergola;taban;"çok\nsatırlı";1000;3000;1000;3000;;adet;10;TRY', 'pergola;taban;*;1000;3000;1000;3000;;adet;;TRY'));
    expect(broken).toMatchObject({ ok: false, errors: ['Satır 4: birim fiyat boş veya okunamadı'] });
  });

  it('rejects the whole file and lists every problem', () => {
    const read = readMatrixCsv(
      file(
        'pergola;taban;*;1000;3000;1000;3000;;adet;;TRY',
        'pergola;taban;*;2000;4000;2000;4000;;adet;5;TRY',
        'pergola;taban;*;5000;4000;1000;2000;;kg;5;TRY',
        'pergola;opsiyon;*;;;;;1motor;adet;-1;EUR',
        'tavan;indirim;*;;;;;;adet;1;TRY',
      ),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    const all = read.errors.join('\n');
    expect(all).toMatch(/Satır 2: birim fiyat boş/);
    expect(all).toMatch(/Satır 4: kademe alt sınırı/);
    expect(all).toMatch(/Satır 4: fiyat_esasi/);
    expect(all).toMatch(/Satır 5: .*negatif/);
    expect(all).toMatch(/Satır 5: opsiyon, reçete parametre kodu/);
    expect(all).toMatch(/Satır 6: bilinmeyen aile/);
    expect(all).toMatch(/Satır 6: satir_turu/);
    expect(all).toMatch(/tek para birimi/);
    expect(all).toMatch(/Satır 2 ve 3: aynı varyantta ölçü kademeleri çakışıyor/);
  });

  it('refuses a file without the columns, rows or for another family', () => {
    expect(readMatrixCsv('a;b\n1;2')).toMatchObject({ ok: false, errors: [expect.stringMatching(/Eksik sütun/)] });
    expect(readMatrixCsv(HEADER)).toMatchObject({ ok: false });
    expect(readMatrixCsv(matrixTemplate('pergola'))).toMatchObject({ ok: false, errors: ['Dosyada fiyat satırı yok'] });
  });
});
