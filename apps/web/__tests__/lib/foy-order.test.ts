import fs from 'node:fs';
import path from 'node:path';
import type { FoyLayout } from '@/lib/features/foy/layout';
import { parseFoy } from '@/lib/features/foy/parse';
import { checkFoy } from '@/lib/features/foy/rules';
import { matchCustomers, normalizeName } from '@/lib/features/foy/match';
import { foyToOrder, cutListText } from '@/lib/features/foy/to-order';
import { NewOrderFormSchema } from '@/lib/shared/types';

const read = (name: string) => parseFoy(JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/foy', `${name}.json`), 'utf8')) as FoyLayout);

describe('föy müşteri eşleştirme', () => {
  const cards = [
    { id: '1', name: 'Black Coffee' },
    { id: '2', name: 'Müşteri C' },
    { id: '3', name: 'Aktaş Pergola Ltd. Şti.' },
    { id: '4', name: 'Başka Firma' },
  ];
  it('yazım farkını bulur ama "aynı" demez', () => {
    expect(matchCustomers(['BLAK COFFEE'], cards)[0]).toMatchObject({ id: '1', reason: 'benzer' });
  });
  it('şirket ekini ve büyük harfi yok sayar', () => {
    expect(normalizeName('AKTAŞ PERGOLA LTD. ŞTİ.')).toBe('aktas pergola');
    expect(matchCustomers(['AKTAŞ PERGOLA'], cards)[0]).toMatchObject({ id: '3', reason: 'aynı' });
  });
  it('şube ekli adı kartın adıyla eşler', () => {
    expect(matchCustomers(['MÜŞTERİ C POZ-2'], cards)[0]).toMatchObject({ id: '2', reason: 'içeriyor' });
  });
  it('boş ya da kısa adla eşleştirmez', () => {
    expect(matchCustomers([null, '', 'ab'], cards)).toEqual([]);
  });
});

describe('föy → sipariş', () => {
  it('tek sistemli pergola: mm ölçüler, föy değerleri parametrede, şema doğrulanır', () => {
    const d = read('pergola-a');
    const o = NewOrderFormSchema.parse(foyToOrder(d, checkFoy(d), { customerName: 'Müşteri A', fileName: 'a.pdf' }));
    expect(o).toMatchObject({ productName: 'Makaslı pergola · Classic', quantity: 1, totalAmount: 0 });
    expect(o.items).toHaveLength(1);
    expect(o.items![0]).toMatchObject({ color: 'RAL 9005 Mat', widthMm: 10010, projectionMm: 3500, motorType: 'Becker', ledType: 'Beyaz, Gün Işığı', fabricType: '3D KREM' });
    expect(o.items![0].customParameters).toMatchObject({ bolme_sayisi: 3, demir_icten_ice: '375 / 385 / 200', ray_icten_ice: '374 / 384 / 199', ray_distan_disa_cm: 1001, acilim_cm: 350, kumas_cm: '991×400', sacak_cm: '991×36', sandikli: true });
    expect(String(o.items![0].customParameters!.kesim_listesi)).toContain('Dere 390,5 ×1');
    expect(JSON.parse(o.customFields!.foy).doc.systems[0].railOuter).toBe(1001);
    expect(o.notes).toContain('föy tarihi 12.10.2026');
  });
  it('karşılıklı iki sistem iki satır olur', () => {
    const d = read('pergola-f-two-systems');
    const o = NewOrderFormSchema.parse(foyToOrder(d, checkFoy(d), { customerName: 'Müşteri F' }));
    expect(o.quantity).toBe(2);
    expect(o.items!.map((i) => i.productName)).toEqual(['Makaslı pergola · Classic (1. sistem)', 'Makaslı pergola · Classic (2. sistem)']);
    expect(o.items![0].notes).toContain('Saçak montajdan sonra ölçülecek');
  });
  it('uyarılar siparişin notuna yazılır', () => {
    const d = read('pergola-b-dptu');
    const o = NewOrderFormSchema.parse(foyToOrder(d, checkFoy(d), { customerName: 'Müşteri B' }));
    expect(o.notes).toContain('Müşteri alanı boş');
    expect(o.items![0].motorType).toBe('Somfy + Buton');
  });
  it('rüzgâr kırıcı teslim tarihini taşır', () => {
    const d = read('windbreaker-e');
    const o = NewOrderFormSchema.parse(foyToOrder(d, checkFoy(d), { customerName: 'Müşteri E' }));
    expect(o).toMatchObject({ productName: 'Pistonlu rüzgâr kırıcı', deliveryDate: '2026-10-30', quantity: 1 });
  });
  it('kesim listesi metni boş satırları atlar', () => {
    expect(cutListText([{ profile: 'Sac', kind: 'sac', lengthCm: null, widthCm: null, quantity: null }, { profile: '40 * 60', kind: 'led', lengthCm: 362, widthCm: null, quantity: 5 }])).toBe('40*60 362 ×5');
  });
});
