import fs from 'node:fs';
import path from 'node:path';
import type { FoyLayout } from '@/lib/features/foy/layout';
import { parseNumber } from '@/lib/features/foy/layout';
import { parseFoy } from '@/lib/features/foy/parse';
import { checkFoy, foyFeatures } from '@/lib/features/foy/rules';
import { checkedLabels, type FoyDoc } from '@/lib/features/foy/types';

/**
 * Golden tests on six real Renk imalat föyleri (customer names replaced). The layouts were taken
 * from the PDFs with lib/features/foy/pdf.server.ts; the values below were read off the sheets by eye.
 */
const load = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/foy', `${name}.json`), 'utf8')) as FoyLayout;
const read = (name: string) => parseFoy(load(name));
const cut = (d: FoyDoc) => d.cutList.map((r) => [r.profile, r.kind, r.lengthCm, r.widthCm, r.quantity]);
const bays = (d: FoyDoc, k = 0) => d.systems[k].bays.map((b) => [b.ironInner, b.railInner]);
const severities = (d: FoyDoc) => Object.fromEntries(checkFoy(d).map((c) => [c.id, c.severity]));

describe('föy sayı okuma', () => {
  it.each([['390,5 cm', 390.5], ['446,7', 446.7], ['1381,1', 1381.1], ['1.381,1', 1381.1], ['5 Adet', 5], ['991X400', null], ['-', null]])('%s → %s', (raw, value) => {
    expect(parseNumber(raw)).toBe(value);
  });
});

describe('makaslı pergola föyü', () => {
  it('A: üç bölme, demir sayfaları, iki ışık seçili', () => {
    const d = read('pergola-a');
    expect(d.template).toBe('pergola');
    expect([d.date, d.customer, d.address, d.ral, d.finish, d.fabric, d.assembly, d.crated]).toEqual(['2026-10-12', 'MÜŞTERİ A', 'MÜŞTERİ A', '9005', 'Mat', '3D KREM', null, true]);
    expect(checkedLabels(d.series)).toEqual(['Classic']);
    expect(checkedLabels(d.lights)).toEqual(['Beyaz', 'Gün Işığı']);
    expect(d.notes).toEqual(['LED PROFİLLER 9005 MAT OLACAK.', 'SAÇAK OLACAK.', 'BECKER MOTOR OLACAK.', 'HER PROFİLDE LED OLACAK.', 'DEMİRLER ARKA SAYFADA.']);
    expect(d.systems).toHaveLength(1);
    expect(bays(d)).toEqual([[375, 374], [385, 384], [200, 199]]);
    expect([d.systems[0].railOuter, d.systems[0].projection]).toEqual([1001, 350]);
    expect(cut(d)).toEqual([
      ['50*100', 'demir', 200, null, 1], ['Dere', 'dere', 390.5, null, 1], ['Dere', 'dere', 610.5, null, 1],
      ['40 * 60', 'led', 362, null, 5], ['40 * 60', 'led', 372, null, 5], ['40 * 60', 'led', 187, null, 5],
      ['Boru', 'boru', 386.5, null, 1], ['Boru', 'boru', 606.5, null, 1], ['Kumaş', 'kumas', 991, 400, 1], ['Sac', 'sac', null, null, null],
    ]);
    expect(d.fabricSize).toEqual({ widthCm: 991, lengthCm: 400 });
    expect(d.valanceSize).toEqual({ widthCm: 991, heightCm: 36 });
    expect(d.ironNotes.join(' ')).toMatch(/4 ADET.*50\*100 DEMİR.*DİKEY DEMİRLER/);
    expect(foyFeatures(d)).toMatchObject({ motor: 'Becker', ledEveryProfile: true, valance: 'var', systems: 1 });
    const s = severities(d);
    for (const id of ['rail_inner_0', 'rail_outer_0', 'dere', 'boru', 'led_length', 'led_count', 'fabric_width', 'fabric_length', 'valance']) expect([id, s[id]]).toEqual([id, 'ok']);
    expect(checkFoy(d).filter((c) => c.severity === 'warn')).toEqual([]);
  });

  it('B: müşteri alanı boş, sayfa ters dönük, logolu saçak, fazla LED profili', () => {
    const d = read('pergola-b-dptu');
    expect([d.date, d.customer, d.address, d.ral, d.fabric, d.assembly, d.crated]).toEqual(['2026-10-09', null, 'MÜŞTERİ B / ŞUBE', '7021', 'KREM HASIR', 'demonte', true]);
    expect(checkedLabels(d.series)).toEqual(['Classic']);
    expect(d.lights.map((o) => o.label)).toEqual(['Beyaz', 'Gün Işığı', 'Amber']);
    expect(checkedLabels(d.lights)).toEqual(['Gün Işığı']);
    expect(d.notes).toEqual(['DÜZ SOMFY MOTOR+BUTON OLACAK', 'DİMERLİ', 'LOGOLU SAÇAK', 'DEMİR OLMAYACAK']);
    expect(bays(d)).toEqual([[446.7, 445.7], [446.7, 445.7], [446.7, 445.7]]);
    expect(d.systems[0]).toMatchObject({ railOuter: 1381.1, projection: 500, height: 102 });
    expect(cut(d)).toEqual([
      ['Dere', 'dere', 462.2, null, 2], ['Dere', 'dere', 456.7, null, 1], ['40 * 60', 'led', 433.5, null, 32],
      ['Boru', 'boru', 458.2, null, 2], ['Boru', 'boru', 456.7, null, 1], ['Kumaş', 'kumas', 1371, 550, 1],
    ]);
    expect(d.valanceSize).toEqual({ widthCm: 1371, heightCm: 56 });
    expect(foyFeatures(d)).toMatchObject({ motor: 'Somfy', motorControl: 'Buton', dimmer: true, valance: 'logolu', noSteel: true });
    const s = severities(d);
    expect(s).toMatchObject({ customer: 'warn', rail_outer_0: 'ok', dere: 'ok', boru: 'ok', led_length: 'ok', led_count: 'info', fabric_width: 'ok', fabric_length: 'ok', valance: 'ok' });
    expect(checkFoy(d).find((c) => c.id === 'led_count')!.detail).toMatch(/32.*24/);
  });

  it('C: iki bölme, 100×100 dikme', () => {
    const d = read('pergola-c');
    expect([d.date, d.customer, d.ral, d.fabric, d.assembly]).toEqual(['2026-10-09', 'MÜŞTERİ C POZ-2', '9005', '3D SİYAH', 'montajli']);
    expect(checkedLabels(d.lights)).toEqual(['Gün Işığı']);
    expect(bays(d)).toEqual([[335, 334], [335, 334]]);
    expect(d.systems[0]).toMatchObject({ railOuter: 701, projection: 400 });
    expect(cut(d).slice(0, 5)).toEqual([['50*100', 'demir', 335, null, 2], ['100*100', 'demir', 375, null, 3], ['Dere', 'dere', 701, null, 1], ['40 * 60', 'led', 322, null, 12], ['Boru', 'boru', 693, null, 1]]);
    expect(foyFeatures(d).valance).toBe('düz');
    expect(checkFoy(d).filter((c) => c.severity !== 'ok')).toEqual([]);
  });

  it('D: iki eşit bölme, baskısız saçak', () => {
    const d = read('pergola-d');
    expect([d.date, d.ral, d.fabric]).toEqual(['2026-10-08', '7016', '3D ANTRASIT']);
    expect(checkedLabels(d.lights)).toEqual(['Beyaz']);
    expect(bays(d)).toEqual([[392.5, 391.5], [392.5, 391.5]]);
    expect(d.systems[0]).toMatchObject({ railOuter: 816, projection: 300 });
    expect(cut(d).slice(0, 4)).toEqual([['Dere', 'dere', 408, null, 2], ['40 * 60', 'led', 379.5, null, 8], ['Boru', 'boru', 404, null, 2], ['Kumaş', 'kumas', 806, 350, 1]]);
    expect(foyFeatures(d)).toMatchObject({ motor: 'Becker', valance: 'baskısız' });
    expect(checkFoy(d).filter((c) => c.severity !== 'ok')).toEqual([]);
  });

  it('F: karşılıklı iki sistem, saçak montajdan sonra', () => {
    const d = read('pergola-f-two-systems');
    expect([d.date, d.customer, d.ral, d.assembly]).toEqual(['2026-10-02', 'MÜŞTERİ F KAFE', '1013', 'montajli']);
    expect(d.lights.map((o) => o.label)).toEqual(['Amber', 'Gün Işığı', 'Işıksız']);
    expect(checkedLabels(d.lights)).toEqual(['Gün Işığı']);
    expect(d.systems).toHaveLength(2);
    for (const k of [0, 1]) {
      expect(bays(d, k)).toEqual([[335, 334], [335, 334]]);
      expect(d.systems[k]).toMatchObject({ railOuter: 701, projection: 400 });
    }
    expect(cut(d)).toEqual([['50*100', 'demir', 335, null, 4], ['Dere', 'dere', 701, null, 2], ['40 * 60', 'led', 322, null, 24], ['Boru', 'boru', 693, null, 2], ['Kumaş', 'kumas', 691, 450, 2]]);
    expect(d.valanceSize).toBeNull();
    expect(foyFeatures(d)).toMatchObject({ noTopSheet: true, weldOnSite: true, valanceAfterInstall: true, systems: 2 });
    const s = severities(d);
    expect(s).toMatchObject({ dere: 'ok', boru: 'ok', led_count: 'ok', fabric_width: 'ok', valance: 'info' });
    expect(checkFoy(d).filter((c) => c.severity === 'warn')).toEqual([]);
  });
});

describe('pistonlu rüzgâr kırıcı föyü', () => {
  it('E: üst tablo metinden, ölçü tablosu resim', () => {
    const d = read('windbreaker-e');
    expect(d.template).toBe('windbreaker');
    expect([d.customer, d.date, d.ral, d.finish, d.assembly]).toEqual(['MÜŞTERİ E', '2026-10-13', '9005', 'Mat', 'demonte']);
    expect(d.windbreaker).toMatchObject({ orderDate: '2026-10-13', deliveryDate: '2026-10-30', systemCount: 1, planter: null, crate: null });
    expect(d.windbreaker!.pistonTable).toEqual([{ widthCm: 100, kg: 11 }, { widthCm: 120, kg: 13 }, { widthCm: 140, kg: 15 }, { widthCm: 160, kg: 17 }]);
    expect(d.unreadPages).toEqual([2]);
    expect(severities(d).image_pages).toBe('warn');
  });
});

describe('kurallar sentetik föyde uyarı verir', () => {
  it('ray dıştan dışa, dere ve kumaş eni bozulunca', () => {
    const d = read('pergola-a');
    d.systems[0].railOuter = 1005;
    d.cutList = d.cutList.filter((r) => !(r.kind === 'dere' && r.lengthCm === 610.5));
    const s = severities(d);
    expect(s).toMatchObject({ rail_outer_0: 'warn', dere: 'warn', fabric_width: 'warn' });
  });
  it('LED profili az ise uyarır', () => {
    const d = read('pergola-d');
    d.cutList = d.cutList.map((r) => (r.kind === 'led' ? { ...r, quantity: 6 } : r));
    expect(severities(d).led_count).toBe('warn');
  });
});

describe('demir çizimleri: boy ve adet', () => {
  const iron = (name: string) => read(name).ironCuts.map((c) => [c.profile, c.lengthCm, c.quantity, c.orientation, c.page]);
  it('G: dikey 280 × 3 ve yatay 392,5 × 2, deliklerin aralık ölçüleri boy sayılmaz', () => {
    expect(iron('pergola-g')).toEqual([['50*100', 280, 3, 'dikey', 2], ['50*100', 392.5, 2, 'yatay', 3]]);
  });
  it('D: aynı çizim düzeni', () => {
    expect(iron('pergola-d')).toEqual([['50*100', 280, 3, 'dikey', 2], ['50*100', 392.5, 2, 'yatay', 3]]);
  });
  it('A: üç bölmeli yatay demirde boyu seçemezse null bırakır, tahmin etmez', () => {
    expect(iron('pergola-a')).toEqual([['50*100', 280, 4, 'dikey', 2], ['50*100', null, 1, 'yatay', 3]]);
  });
  it('demir sayfası olmayan föyde boş', () => {
    expect(iron('pergola-c')).toEqual([]);
  });
});
