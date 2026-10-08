import {
  RAL_CLASSIC, RAL_GROUPS, canonicalColor, colorInfo, colorKey, parseColor, ralByCode, sameColor, searchRal, textOn,
} from '@/lib/features/colors/color-spec';
import { colorKey as stockColorKey } from '@/lib/features/inventory/vocabulary';
import { optimizeCuts, type CuttingParameters } from '@/lib/features/manufacturing/cutting-engine';

describe('RAL Classic data', () => {
  it('has every RAL Classic colour once, each with a code, Turkish/English/German name, hex and group', () => {
    expect(RAL_CLASSIC).toHaveLength(216);
    expect(new Set(RAL_CLASSIC.map((c) => c.code)).size).toBe(216);
    for (const c of RAL_CLASSIC) {
      expect(c.code).toMatch(/^[1-9]\d{3}$/);
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.name && c.nameEn && c.nameDe).toBeTruthy();
      expect(RAL_GROUPS.find((g) => g.key === c.group)!.digit).toBe(c.code[0]);
    }
    expect(ralByCode('7016')).toMatchObject({ name: 'Antrasit gri', nameEn: 'Anthracite grey', group: 'gri' });
    // Fluorescent colours cannot be shown on a screen; the data says so.
    expect(ralByCode('1026')?.note).toBe('luminous');
  });
});

describe('colour comparison: one colour however it was written', () => {
  // Every spelling found in records written before the RAL list, plus what the picker writes.
  const same7016Mat = [
    'RAL 7016 Mat', '7016 Mat', '7016 MAT', '7016  mat', ' 7016 Mat ', '7016 mat', 'ral 7016 mat', 'RAL7016 Mat',
    'RAL-7016 MAT', 'Ral 7016  Mat', 'RAL\t7016 Mat', '7016-Mat', '7016/mat', 'RAL 7016 MATT', 'RAL 7016', '7016',
    'ral7016', 'RAL.7016 mat', '7016 , Mat', ' RAL  7016  Mat',
  ];
  it.each(same7016Mat)('%j is RAL 7016 Mat', (text) => {
    expect(colorKey(text)).toBe(colorKey('RAL 7016 Mat'));
    expect(canonicalColor(text)).toBe('RAL 7016 Mat');
  });

  it.each([
    ['RAL 7016 Parlak', '7016 parlak'], ['RAL 9016 İnce doku', '9016 ince doku'], ['RAL 9016 İnce doku', '9016 İNCE DOKU'],
    ['RAL 9016 İnce doku', '9016 incedoku'], ['RAL 1013 Kum', '1013 kumlu'], ['Boyasız', 'boyasiz'], ['Boyasız', 'BOYASIZ'],
    ['Boyasız', 'Ham alüminyum'], ['Eloksal natürel', 'eloksal naturel'], ['Eloksal natürel', 'Natürel eloksal'],
    ['Eloksal siyah', 'SİYAH ELOKSAL'], ['Ahşap desen: Ceviz', 'ahsap desen: CEVİZ'], ['Kahverengi', 'KAHVERENGİ'],
    ['Kırlı', 'KIRLI'], ['Özel renk: Bordo metalik (Mat, #7A1F2B)', 'özel renk: bordo metalik (mat)'],
  ])('%j = %j', (a, b) => expect(sameColor(a, b)).toBe(true));

  it.each([
    ['RAL 7016 Mat', 'RAL 7016 Parlak'], ['RAL 7016 Mat', 'RAL 7015 Mat'], ['7016 Mat', '9016 Mat'], ['RAL 9016 Mat', 'RAL 9016 Kum'],
    ['Boyasız', 'Eloksal natürel'], ['Eloksal natürel', 'Eloksal siyah'], ['Ahşap desen: Ceviz', 'Ahşap desen: Meşe'],
    ['Kahverengi', 'RAL 8017 Mat'], ['Özel renk: Bordo (Mat)', 'Özel renk: Bordo (Parlak)'],
    // A text that merely looks like a finish word is not a RAL colour with that finish.
    ['7016 metalik', 'RAL 7016 Mat'],
  ])('%j ≠ %j', (a, b) => expect(sameColor(a, b)).toBe(false));

  it('stock matching and the cutting engine use the same rule', () => {
    expect(stockColorKey).toBe(colorKey);
    const id = '10000000-0000-4000-8000-000000000001';
    const params: CuttingParameters = { kerfMm: 3, trimStartMm: 0, trimEndMm: 0, minimumRemnantMm: 500, standardLengthMm: 6000 };
    const r = optimizeCuts(
      [{ itemId: id, color: 'RAL 7016 Mat', lengthMm: 2000, quantity: 2, workOrderId: 'job' }],
      [
        { id: 'glossy', itemId: id, color: '7016 Parlak', lengthMm: 6000, unitCost: 0, isRemnant: false },
        { id: 'old-spelling', itemId: id, color: '7016 MAT', lengthMm: 6000, unitCost: 0, isRemnant: false },
      ],
      params,
    );
    expect(r.unfulfilled).toHaveLength(0);
    expect(r.bars.map((b) => b.source.id)).toEqual(['old-spelling']);
  });
});

describe('canonical text and colour info', () => {
  it.each([
    ['7016 parlak', 'RAL 7016 Parlak'], ['9016 ince-doku', 'RAL 9016 İnce doku'], ['boyasiz', 'Boyasız'], ['siyah eloksal', 'Eloksal siyah'],
    ['ahşap desen   ceviz', 'Ahşap desen: ceviz'], ['Özel renk: Bordo metalik (#7a1f2b, parlak)', 'Özel renk: Bordo metalik (Parlak, #7A1F2B)'],
    ['Özel renk: Gri (açık)', 'Özel renk: Gri (açık)'], ['  Kahverengi  ', 'Kahverengi'], ['RAL 9999 Mat', 'RAL 9999 Mat'],
  ])('%j → %j', (text, canonical) => expect(canonicalColor(text)).toBe(canonical));

  it('says when the finish was not written and the default is assumed', () => {
    expect(colorInfo('7016')).toMatchObject({ code: 'RAL 7016', name: 'Antrasit gri', finish: 'Mat', finishAssumed: true, hex: '#3B4044' });
    expect(colorInfo('RAL 7016 Mat')).toMatchObject({ finishAssumed: false });
  });

  it('keeps a name it does not know as written, with no screen colour', () => {
    expect(parseColor('Kahverengi')).toEqual({ kind: 'text', text: 'Kahverengi' });
    expect(colorInfo('Kahverengi')).toMatchObject({ label: 'Kahverengi', hex: null, kind: 'text' });
    expect(colorInfo('')).toBeNull();
    expect(colorInfo(null)).toBeNull();
  });

  it('marks stand-in tones for finishes that have no colour value', () => {
    expect(colorInfo('Boyasız')).toMatchObject({ standIn: true, code: 'Boyasız' });
    expect(colorInfo('Özel renk: Bordo')).toMatchObject({ standIn: false, hex: null, name: 'Bordo' });
  });

  it('picks the text colour that reads better on the swatch', () => {
    expect(textOn('#3B4044')).toBe('#FFFFFF'); // 7016
    expect(textOn('#F1F0EA')).toBe('#111111'); // 9016
    expect(textOn('#FFD700')).toBe('#111111');
    expect(textOn(null)).toBe('#111111');
  });
});

describe('RAL search', () => {
  const codes = (q: string, g?: Parameters<typeof searchRal>[1]) => searchRal(q, g).map((c) => c.code);
  it('finds by code, code prefix and "RAL" prefix', () => {
    expect(codes('7016')).toEqual(['7016']);
    expect(codes('RAL 7016')).toEqual(['7016']);
    expect(codes('701')).toEqual(['7010', '7011', '7012', '7013', '7015', '7016']);
  });
  it('finds by Turkish name without Turkish letters, English and German name', () => {
    expect(codes('antrasit')).toEqual(['7016']);
    expect(codes('ANTRASİT')).toEqual(['7016']);
    expect(codes('anthracite')).toEqual(['7016']);
    expect(codes('anthrazit')).toEqual(['7016']);
    expect(codes('trafik beyazi')).toEqual(['9016']);
    expect(codes('kirmizi').length).toBeGreaterThan(20);
  });
  it('filters by group and lists everything for an empty query', () => {
    expect(searchRal('').length).toBe(216);
    expect(codes('', 'gri').every((c) => c.startsWith('7'))).toBe(true);
    expect(codes('trafik', 'mavi')).toEqual(['5017']);
  });
});
