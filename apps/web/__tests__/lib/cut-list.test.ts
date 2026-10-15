/**
 * Cut list from an order sheet: what is read, which stock profile each row maps to, leftovers and
 * scrap bars used first, nothing lost, and what must be bought. The sheet is a real Renk föy
 * (customer name replaced) read by the same parser the föy screen uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { FoyLayout } from '@/lib/features/foy/layout';
import { parseFoy } from '@/lib/features/foy/parse';
import { foyCutRows, matchItems, planCutList, type StockItem, type StockLot } from '@/lib/features/manufacturing/cut-list';
import { CUTTING_DEFAULTS } from '@/lib/features/manufacturing/cutting-defaults';

const layout = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/foy', `${name}.json`), 'utf8')) as FoyLayout;
const sheet = () => parseFoy(layout('pergola-g'));
const COLOR = 'RAL 7016 Mat';

const items: StockItem[] = [
  { id: 'dere', name: 'Dere profili', sku: 'DERE-01', profileCode: null, standardLengthMm: 6000 },
  { id: 'boru', name: 'Alüminyum boru', sku: 'BORU-01', profileCode: null, standardLengthMm: 6000 },
  { id: 'led', name: 'LED profili 40x60', sku: 'LED-4060', profileCode: '40*60', standardLengthMm: 6000 },
  { id: 'demir', name: 'Demir 50x100', sku: 'DMR-50100', profileCode: '50*100', standardLengthMm: 6000 },
];
const bar = (id: string, itemId: string, lengthMm: number, color: string, kind: StockLot['kind'] = 'new'): StockLot => ({ id, itemId, lotNumber: `L-${id}`, lengthMm, color, kind });
const stock = (): StockLot[] => [
  bar('d1', 'dere', 6000, COLOR), bar('d2', 'dere', 6000, COLOR), bar('dr', 'dere', 4100, COLOR, 'remnant'),
  bar('b1', 'boru', 6000, COLOR), bar('b2', 'boru', 6000, COLOR),
  ...Array.from({ length: 8 }, (_, i) => bar(`l${i}`, 'led', 6000, COLOR)),
  bar('m1', 'demir', 6000, ''), bar('m2', 'demir', 6000, ''), bar('m3', 'demir', 6000, ''), bar('ms', 'demir', 2850, '', 'scrap'),
];
const placed = (plan: ReturnType<typeof planCutList>) => {
  const out = new Map<string, number>();
  for (const g of plan.groups) for (const b of g.bars) for (const c of b.cuts) out.set(`${g.itemId}:${c.lengthMm}`, (out.get(`${g.itemId}:${c.lengthMm}`) ?? 0) + c.count);
  return out;
};

describe('paint and mixed length planning', () => {
  const row = (lengthMm: number, quantity = 1, color = COLOR) => ({ ...foyCutRows(sheet()).rows[1], id: `r-${lengthMm}-${color}`, lengthMm, quantity, color });
  const run = (rows: ReturnType<typeof row>[], lots: StockLot[], extra = {}) => planCutList({ rows, items, lots, parameters: CUTTING_DEFAULTS, ...extra });

  it('uses matching paint first and raw stock only for the shortfall', () => {
    const p = run([row(3795, 3)], [bar('paint', 'led', 6000, COLOR), bar('raw', 'led', 8000, 'Boyasız')]);
    expect(p.summary.toBuy).toBe(0);
    expect(p.summary.toPaint).toBe(1);
    expect(p.groups[0].bars.find((b) => b.lotId === 'paint')?.paintTo).toBeNull();
    expect(p.groups[0].bars.find((b) => b.lotId === 'raw')?.paintTo).toBe(COLOR);
  });
  it('compares different physical stock lengths and accounts for saw loss', () => {
    const p = run([row(3900), row(2800, 2)], [bar('four', 'led', 4000, 'Boyasız'), bar('six', 'led', 6000, 'Boyasız'), bar('long', 'led', 11000, 'Boyasız')]);
    expect(p.summary.toBuy).toBe(0);
    expect(p.groups[0].bars.reduce((s, b) => s + b.sourceLengthMm, 0)).toBe(10000);
    for (const b of p.groups[0].bars) expect(b.usedMm + b.leftoverMm).toBeCloseTo(b.sourceLengthMm, 3);
  });
  it('does not treat unknown colour, another paint or anodising as raw', () => {
    for (const color of ['', 'RAL 9005 Mat', 'Eloksal natürel']) {
      const p = run([row(3795)], [bar('other', 'led', 6000, color)]);
      expect(p.summary.toPaint).toBe(0);
      expect(p.summary.toBuy).toBe(1);
    }
  });
  it('never allocates one raw bar to two colours', () => {
    const p = run([row(3795), row(3795, 1, 'RAL 9005 Mat')], [bar('one', 'led', 6000, 'Boyasız')]);
    expect(p.summary.toPaint).toBe(1);
    expect(p.summary.toBuy).toBe(1);
    expect(p.groups.flatMap((g) => g.bars).map((b) => b.lotId)).toEqual(['one']);
  });
  it('shares painted/raw cards of the same section but never substitutes drilled stock', () => {
    const cards: StockItem[] = [
      { ...items[2], profileCode: '108', sizeLabel: '40x60', processedStates: ['boyali'] },
      { ...items[2], id: 'raw', name: '108 40x60 Boyasız', profileCode: '108', sizeLabel: '40x60', processedStates: ['boyasiz'] },
      { ...items[2], id: 'drilled', profileCode: '108', sizeLabel: '40x60', processedStates: ['boyasiz', 'delikli'] },
    ];
    const p = run([row(3795, 2)], [bar('raw', 'raw', 8000, 'Boyasız'), bar('wrong', 'drilled', 4000, 'Boyasız')], { items: cards, choices: { [row(3795).id]: 'led' } });
    expect(p.summary.toBuy).toBe(0);
    expect(p.groups[0].bars.map((b) => b.lotId)).toEqual(['raw']);
    expect(p.groups[0].bars[0].sourceItemName).toBe('108 40x60 Boyasız');
  });
  it('buys only the residual demand on configured supplier lengths', () => {
    const p = run([row(3795, 3)], [bar('raw', 'led', 8000, 'Boyasız')], { purchaseLengthsMm: [4000, 6000, 8000] });
    expect(p.summary.toPaint).toBe(1);
    expect(p.summary.toBuy).toBe(1);
    expect(p.groups[0].missing).toEqual([{ lengthMm: 3795, count: 1 }]);
    expect(p.groups[0].buy).toEqual({ bars: 1, lengthMm: 4000 });
  });
});

describe('cut rows of a sheet', () => {
  it('lists every cuttable piece in mm, painted parts in the order colour, steel unpainted', () => {
    const { rows, color } = foyCutRows(sheet());
    expect(color).toBe(COLOR);
    expect(rows.map((r) => [r.kind, r.profile, r.lengthMm, r.quantity, r.color, r.origin])).toEqual([
      ['dere', 'Dere', 4080, 2, COLOR, 'liste'],
      ['led', '40 * 60', 3795, 8, COLOR, 'liste'],
      ['boru', 'Boru', 4040, 2, COLOR, 'liste'],
      ['demir', '50*100', 2800, 3, '', 'demir sayfası'],
      ['demir', '50*100', 3925, 2, '', 'demir sayfası'],
    ]);
  });

  it('keeps fabric and sheet metal out of the profile list and says why', () => {
    const { problems } = foyCutRows(sheet());
    expect(problems.map((p) => p.label)).toEqual(['Kumaş', 'Sac']);
  });

  it('does not guess a steel length it could not read', () => {
    const doc = sheet();
    doc.ironCuts = [{ ...doc.ironCuts[1], lengthCm: null }];
    const { rows, problems } = foyCutRows(doc);
    expect(rows.some((r) => r.origin === 'demir sayfası')).toBe(false);
    expect(problems.find((p) => p.ironPage === 3)?.reason).toMatch(/okunamadı/);
  });

  it('adds the same piece from two places together', () => {
    const doc = sheet();
    doc.ironCuts = [doc.ironCuts[0], { ...doc.ironCuts[0], quantity: 2 }];
    expect(foyCutRows(doc).rows.find((r) => r.lengthMm === 2800)?.quantity).toBe(5);
  });
});

describe('profile matching', () => {
  const [dere, led, boru, demirTall] = foyCutRows(sheet()).rows;
  it('maps rows to the right stock profile', () => {
    expect(matchItems(dere, items).itemId).toBe('dere');
    expect(matchItems(led, items).itemId).toBe('led');
    expect(matchItems(boru, items).itemId).toBe('boru');
    expect(matchItems(demirTall, items).itemId).toBe('demir');
  });
  it('does not pick between two equally good profiles', () => {
    const two = [...items, { id: 'demir2', name: 'Demir 50x100 (kalın)', sku: 'DMR-50100-K', profileCode: '50*100', standardLengthMm: 6000 }];
    const m = matchItems(demirTall, two);
    expect(m.itemId).toBeNull();
    expect(m.candidates.map((c) => c.id).sort()).toEqual(['demir', 'demir2']);
  });
  it('does not take a "dere" for the steel with the same section', () => {
    const only = [{ id: 'x', name: 'Dere 50x100', sku: 'X', profileCode: null, standardLengthMm: 6000 }];
    expect(matchItems(demirTall, only).itemId).toBeNull();
  });
});

describe('cut plan', () => {
  const rows = () => foyCutRows(sheet()).rows;
  const plan = () => planCutList({ rows: rows(), items, lots: stock(), parameters: CUTTING_DEFAULTS });

  it('places every piece, none lost', () => {
    const p = plan();
    const got = placed(p);
    expect(got.get('dere:4080')).toBe(2);
    expect(got.get('led:3795')).toBe(8);
    expect(got.get('boru:4040')).toBe(2);
    expect(got.get('demir:2800')).toBe(3);
    expect(got.get('demir:3925')).toBe(2);
    expect(p.summary.pieces).toBe(17);
    expect(p.summary.toBuy).toBe(0);
    expect(p.groups.every((g) => g.missing.length === 0)).toBe(true);
  });

  it('uses the leftover and the scrap bar before opening new bars', () => {
    const p = plan();
    expect(p.summary.remnantsUsed).toBe(1);
    expect(p.summary.scrapUsed).toBe(1);
    const dere = p.groups.find((g) => g.itemId === 'dere')!;
    expect(dere.bars.find((b) => b.lotId === 'dr')?.cuts).toEqual([{ lengthMm: 4080, count: 1, label: 'Dere' }]);
    const demir = p.groups.find((g) => g.itemId === 'demir')!;
    expect(demir.bars.find((b) => b.lotId === 'ms')?.sourceKind).toBe('scrap');
  });

  it('accounts for every millimetre of each bar (cut + kerf + leftover)', () => {
    for (const g of plan().groups) for (const b of g.bars) {
      const cut = b.cuts.reduce((s, c) => s + c.lengthMm * c.count, 0);
      const pieces = b.cuts.reduce((s, c) => s + c.count, 0);
      expect(cut + pieces * CUTTING_DEFAULTS.kerfMm + b.leftoverMm).toBeCloseTo(b.sourceLengthMm, 1);
      expect(b.usedMm + b.leftoverMm).toBeCloseTo(b.sourceLengthMm, 1);
    }
  });

  it('tells a keepable leftover from scrap', () => {
    for (const g of plan().groups) for (const b of g.bars) {
      if (b.leftoverMm === 0) expect(b.leftover).toBe('none');
      else expect(b.leftover).toBe(b.leftoverMm >= CUTTING_DEFAULTS.minimumRemnantMm ? 'keep' : 'scrap');
    }
  });

  it('never cuts a coloured part from a bar of another colour', () => {
    const wrong = stock().map((l) => (l.itemId === 'boru' ? { ...l, color: 'RAL 9005 Mat' } : l));
    const p = planCutList({ rows: rows(), items, lots: wrong, parameters: CUTTING_DEFAULTS });
    const boru = p.groups.find((g) => g.itemId === 'boru')!;
    expect(boru.bars).toHaveLength(0);
    expect(boru.missing).toEqual([{ lengthMm: 4040, count: 2 }]);
    expect(boru.buy).toEqual({ bars: 2, lengthMm: 6000 });
    expect(p.summary.toBuy).toBeGreaterThanOrEqual(2);
  });

  it('reports what to buy when stock runs out, and never drops a piece', () => {
    const few = stock().filter((l) => !['l1', 'l2', 'l3'].includes(l.id));
    const p = planCutList({ rows: rows(), items, lots: few, parameters: CUTTING_DEFAULTS });
    const led = p.groups.find((g) => g.itemId === 'led')!;
    const cutLed = led.bars.reduce((s, b) => s + b.cuts.reduce((x, c) => x + c.count, 0), 0);
    const missingLed = led.missing.reduce((s, m) => s + m.count, 0);
    expect(cutLed + missingLed).toBe(8);
    expect(missingLed).toBeGreaterThan(0);
    expect(led.buy?.bars).toBeGreaterThan(0);
  });

  it('lists a row with no stock profile instead of skipping it', () => {
    const p = planCutList({ rows: rows(), items: items.filter((i) => i.id !== 'boru'), lots: stock(), parameters: CUTTING_DEFAULTS });
    expect(p.unmatched.map((u) => u.label)).toEqual(['Boru']);
    expect(p.summary.pieces).toBe(15);
  });

  it('uses the profile the person picked for an ambiguous row', () => {
    const two = [...items, { id: 'demir2', name: 'Demir 50x100 (kalın)', sku: 'DMR-50100-K', profileCode: '50*100', standardLengthMm: 6000 }];
    const lots = [...stock(), bar('k1', 'demir2', 6000, ''), bar('k2', 'demir2', 6000, '')];
    const ambiguous = planCutList({ rows: rows(), items: two, lots, parameters: CUTTING_DEFAULTS });
    expect(ambiguous.unmatched).toHaveLength(2);
    const steel = rows().filter((r) => r.kind === 'demir');
    const choices = Object.fromEntries(steel.map((r) => [r.id, 'demir2']));
    const picked = planCutList({ rows: rows(), items: two, lots, parameters: CUTTING_DEFAULTS, choices });
    expect(picked.unmatched).toHaveLength(0);
    expect(picked.groups.find((g) => g.itemId === 'demir2')?.bars.length).toBeGreaterThan(0);
  });

  it('plans nothing without rows', () => {
    const p = planCutList({ rows: [], items, lots: stock(), parameters: CUTTING_DEFAULTS });
    expect(p.groups).toEqual([]);
    expect(p.summary.pieces).toBe(0);
  });
});
