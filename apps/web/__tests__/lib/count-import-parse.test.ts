import { parseCountDocument, splitMaterial, trNumber, type TextItem } from '@/lib/features/warehouse/count-import/parse';
import { itemIdentity, rowStates } from '@/lib/features/warehouse/count-import/identity';

// Synthetic positioned text shaped like the printed count list; no real stock figures.
const at = (page: number, y: number, ...cells: Array<[number, string]>): TextItem[] => cells.map(([x, text]) => ({ page, x, y, text }));
const header = (page: number, y: number) => at(page, y, [45, 'Profil'], [103, 'Kod'], [213, 'Malzeme'], [352, 'Boy'], [421, 'Gramaj'], [506, 'Ağırlık']);

const DOC: TextItem[] = [
  ...at(1, 811, [514, '01.01.2026']), ...at(1, 799, [530, 'Sayfa 1/2']), ...at(1, 796, [170, 'MALZEME SAYIM LİSTESİ']),
  ...at(1, 751, [40, 'PERGOLA TENTE']),
  ...header(1, 728),
  ...at(1, 704, [102, '108'], [144, '40x60 / 7016 Mat'], [338, '1.000,00 m'], [416, '0,900 kg/m'], [510, '900,00 kg']),
  ...at(1, 673, [102, '108'], [144, '40x60 / Boyasız'], [338, '10,00 m'], [416, '0,900 kg/m'], [518, '9,00 kg']),
  // Weight does not add up: 20 m × 1 kg/m is 20 kg, not 25.
  ...at(1, 642, [99, '6056'], [144, 'Oval Dere'], [342, '20,00 m'], [416, '1,000 kg/m'], [518, '25,00 kg']),
  ...at(1, 611, [102, '330'], [144, 'Sineklik'], [342, '5,00 m']),
  ...at(1, 580, [144, 'Motor Kapağı'], [342, '3,50 m']),
  ...at(1, 549, [96, 'T-2983'], [144, 'Pistonlu Kasa'], [345, '2,00 m'], [418, '2,000 kg/m'], [523, '4,00 kg']),
  ...at(1, 489, [40, 'TENTE AKSESUARLARI']),
  ...at(1, 469, [93, 'Malzeme'], [202, 'Ölçü'], [250, 'Miktar'], [364, 'Malzeme'], [473, 'Ölçü'], [522, 'Miktar']),
  ...at(1, 452, [35, 'Hazır Makas'], [198, '450 cm'], [248, '3 Adet'], [307, 'Makas Köşebent'], [518, '9 Adet']),
  ...at(1, 435, [35, 'Hazır Makas'], [198, '500 cm'], [248, '1 Adet'], [307, 'Boyasız Borulu Yay'], [515, '2 Takım']),
  ...at(1, 418, [35, 'Boyalı Uzun Düz Demir - Dev Delik'], [246, '4 Adet']),
  ...at(1, 256, [39, 'DİĞER TENTE MALZEMELERİ'], [257, 'DEMİRLER']),
  ...at(1, 236, [87, 'Malzeme'], [195, 'Miktar'], [311, 'Malzeme'], [440, 'Detay'], [517, 'Miktar']),
  ...at(1, 220, [35, 'Ek Profil'], [191, '30,00 m'], [253, '50x100'], [517, '3 Boy']),
  ...at(1, 203, [253, '50x100 Delikli'], [445, '4 m'], [515, '6 Adet']),
  ...at(1, 186, [253, '50x100 Delikli'], [420, 'Delik arası 102 cm'], [513, '2 Adet']),
  ...at(2, 751, [40, 'CAM MALZEMELERİ']),
  ...at(2, 731, [40, 'MOTORLU GİYOTİN']),
  ...header(2, 711),
  ...at(2, 692, [100, '6367'], [144, 'Kutu'], [343, '4,00 m'], [418, '1,500 kg/m'], [523, '6,00 kg']),
  ...at(2, 672, [100, '6367'], [144, 'Kutu'], [343, '1,00 m'], [418, '1,500 kg/m'], [523, '1,50 kg']),
  ...at(2, 652, [144, 'Piston'], [344, '7 Adet']),
];

const doc = parseCountDocument(DOC);
const find = (name: string, extra: (r: (typeof doc.rows)[number]) => boolean = () => true) => doc.rows.find((r) => r.name === name && extra(r))!;

describe('count list numbers and names', () => {
  it('reads Turkish numbers and refuses what is not one', () => {
    expect(trNumber('2.295,68')).toBe(2295.68);
    expect(trNumber('49,50')).toBe(49.5);
    expect(trNumber('900')).toBe(900);
    expect(trNumber('1.2.3')).toBeNull();
    expect(trNumber('abc')).toBeNull();
  });

  it('splits a profile name into size, colour and processed states', () => {
    expect(splitMaterial('40x60 / 7016 Mat')).toEqual({ size: '40x60', color: '7016 Mat', states: [] });
    expect(splitMaterial('40x60 / Boyasız')).toEqual({ size: '40x60', color: null, states: ['boyasiz'] });
    expect(splitMaterial('Kısa Düz Demir - Boyalı').states).toEqual(['boyali']);
    expect(splitMaterial('16.5x16.5 Dikme').size).toBe('16.5x16.5');
  });
});

describe('count list tables', () => {
  it('reads header, date, every table and side-by-side columns', () => {
    expect(doc.title).toBe('MALZEME SAYIM LİSTESİ');
    expect(doc.date).toBe('01.01.2026');
    expect(doc.rows).toHaveLength(18);
    expect(find('40x60 / 7016 Mat')).toMatchObject({ code: '108', size: '40x60', color: '7016 Mat', quantity: 1000, unit: 'm', weightPerMeterKg: 0.9, weightKg: 900, issues: [] });
    expect(find('Makas Köşebent')).toMatchObject({ section: 'TENTE AKSESUARLARI', quantity: 9, unit: 'adet', issues: [] });
    expect(find('Boyasız Borulu Yay')).toMatchObject({ quantity: 2, unit: 'takim', states: ['boyasiz'] });
    expect(find('Ek Profil')).toMatchObject({ section: 'DİĞER TENTE MALZEMELERİ', quantity: 30, unit: 'm', issues: [] });
    expect(find('Kutu', (r) => r.quantity === 4).section).toBe('CAM MALZEMELERİ / MOTORLU GİYOTİN');
  });

  it('keeps piece lengths and processed states that make separate items', () => {
    expect(find('Hazır Makas', (r) => r.quantity === 3)).toMatchObject({ pieceLengthMm: 4500, states: ['hazir'] });
    expect(find('Hazır Makas', (r) => r.quantity === 1)).toMatchObject({ pieceLengthMm: 5000 });
    expect(find('Boyalı Uzun Düz Demir - Dev Delik').states).toEqual(['boyali', 'delikli']);
    expect(find('50x100 Delikli', (r) => r.quantity === 6)).toMatchObject({ section: 'DEMİRLER', pieceLengthMm: 4000, unit: 'adet', issues: [] });
    expect(find('50x100 Delikli', (r) => r.quantity === 2)).toMatchObject({ detail: 'Delik arası 102 cm', pieceLengthMm: null });
  });

  it('marks what it cannot vouch for instead of filling it in', () => {
    expect(find('Oval Dere').issues.join()).toMatch(/Gramaj tutarsız: 20 m × 1 kg\/m = 20\.00 kg, yazılan 25 kg/);
    expect(find('Sineklik').issues).toEqual(['Gramaj (kg/m) yok; ağırlık doğrulanamadı']);
    expect(find('Motor Kapağı').issues).toEqual(['Profil kodu yok', 'Gramaj (kg/m) yok; ağırlık doğrulanamadı']);
    expect(find('50x100', (r) => r.unit === 'boy').issues).toEqual(['Adet "boy" ama çubuk boyu yazmıyor']);
    expect(find('Kutu', (r) => r.quantity === 1).issues).toContain('Aynı kalem listede iki kez geçiyor');
    // Counted pieces in a profile-shaped table need no profile code or weight.
    expect(find('Piston')).toMatchObject({ quantity: 7, unit: 'adet', issues: [] });
    expect(find('Pistonlu Kasa')).toMatchObject({ code: 'T-2983', issues: [] });
  });

  it('flags a row whose quantity cannot be read', () => {
    const broken = parseCountDocument([...header(1, 728), ...at(1, 700, [102, '108'], [144, '40x60 / 7037'], [338, '12,5,0 m'], [416, '0,900 kg/m'], [510, '9,00 kg'])]);
    expect(broken.rows[0].issues).toContain('Miktar veya birim okunamadı');
  });
});

describe('count rows to stock cards', () => {
  const row = (over: Record<string, unknown>): any => ({ ref: 'r', page: 1, section: 'S', code: null, name: '', size: null, color: null, states: [], quantity: 1, unit: 'adet', pieceLengthMm: null, weightPerMeterKg: null, weightKg: null, detail: null, issues: [], unplaced: [], ...over });

  it('treats a painted colour as the painted state; the colour stays on the bars', () => {
    expect(rowStates(row({ color: '7016 Mat' }))).toEqual(['boyali']);
    expect(rowStates(row({ color: null, states: ['boyasiz'] }))).toEqual(['boyasiz']);
    expect(itemIdentity(row({ code: '108', name: '40x60 / 7016 Mat', size: '40x60', color: '7016 Mat', unit: 'm' }))).toEqual({ name: '108 40x60 Boyalı', sku: '108-40X60-BOYALI', states: ['boyali'] });
  });

  it('does not repeat a state the name already says, and keeps the piece length', () => {
    expect(itemIdentity(row({ name: "102'lik Galvanizli Boru", states: ['galvanizli'], unit: 'm' })).name).toBe("102'lik Galvanizli Boru");
    expect(itemIdentity(row({ name: 'Hazır Makas', states: ['hazir'], pieceLengthMm: 4500 }))).toEqual({ name: 'Hazır Makas 450 cm', sku: 'HAZIR-MAKAS-4500', states: ['hazir'] });
    expect(itemIdentity(row({ name: 'Boyalı Uzun Düz Demir - Dev Delik', states: ['boyali', 'delikli'] })).name).toBe('Boyalı Uzun Düz Demir - Dev Delik');
  });
});

describe('count list edge cases', () => {
  it('reads upper-case Turkish state words', () => {
    expect(splitMaterial('40x60 / BOYASIZ')).toEqual({ size: '40x60', color: null, states: ['boyasiz'] });
    expect(splitMaterial('HAZIR MAKAS').states).toEqual(['hazir']);
  });

  it('keeps an all-caps data row, a dated row and a table that runs onto the next page', () => {
    const doc = parseCountDocument([
      ...at(1, 760, [40, 'AKSESUAR']),
      ...at(1, 740, [93, 'Malzeme'], [202, 'Ölçü'], [250, 'Miktar'], [440, 'Detay']),
      ...at(1, 720, [35, 'KAPAK'], [248, '10 ADET']),
      ...at(1, 700, [35, 'Vida'], [248, '4 Adet'], [440, '12.03.2025']),
      ...at(1, 790, [514, '01.01.2026']), ...at(1, 780, [530, 'Sayfa 1/2']),
      ...at(2, 790, [514, '01.01.2026']), ...at(2, 780, [530, 'Sayfa 2/2']),
      ...at(2, 720, [35, 'Somun'], [248, '6 Adet']),
      ...at(2, 700, [35, 'Pul'], [198, '0 cm'], [248, '2 Adet']),
    ]);
    expect(doc.rows.map((r) => [r.name, r.quantity, r.unit, r.section])).toEqual([
      ['KAPAK', 10, 'adet', 'AKSESUAR'],
      ['Vida', 4, 'adet', 'AKSESUAR'],
      ['Somun', 6, 'adet', 'AKSESUAR'],
      ['Pul', 2, 'adet', 'AKSESUAR'],
    ]);
    expect(doc.rows[3]).toMatchObject({ pieceLengthMm: null, issues: ['Parça boyu sıfır veya negatif'] });
  });
});
