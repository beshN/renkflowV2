import { parseCsv } from '@/lib/features/products/csv';
import { readRecipeCsv, recipeTemplate, RECIPE_COLUMNS, type TemplateItem } from '@/lib/features/products/recipe-template';
import { calculateRecipe } from '@/lib/features/manufacturing/recipe-engine';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const items: TemplateItem[] = [
  { id: id(1), sku: '107-60X80-BOYALI', name: '107 60x80 Boyalı', profileCode: '107', uom: 'm' },
  { id: id(2), sku: '108-40X60-BOYALI', name: '108 40x60 Boyalı', profileCode: '108', uom: 'm' },
  { id: id(3), sku: '108-40X60-BOYASIZ', name: '108 40x60 Boyasız', profileCode: '108', uom: 'm' },
  { id: id(4), sku: 'VIDA', name: 'Vida', profileCode: null, uom: 'adet' },
  { id: id(5), sku: '330-SINEKLIK', name: '330 Sineklik', profileCode: '330', uom: 'm' },
];
const header = RECIPE_COLUMNS.join(';');
const rows = (...r: string[]) => [header, ...r].join('\n');

describe('recipe template', () => {
  it('lists the family cards by count-list code with every formula empty', () => {
    const csv = parseCsv(recipeTemplate('pergola', items, ['KESIM']));
    const data = csv.filter((r) => !r[0].startsWith('#'));
    expect(data[0]).toEqual([...RECIPE_COLUMNS]);
    expect(data.filter((r) => r[0] === 'malzeme').map((r) => r[1])).toEqual(['108-40X60-BOYALI', '108-40X60-BOYASIZ', '107-60X80-BOYALI', '330-SINEKLIK']);
    expect(data.filter((r) => r[0] !== 'satir_turu').every((r) => r.slice(5).every((c) => c === ''))).toBe(true);
    expect(csv.find((r) => r[0].includes('Stok kartı olmayan'))![0]).toMatch(/6056, 5979, 187, 164, 5980, 6017, 6015/);
    expect(csv.find((r) => r[0].includes('operasyon:'))![0]).toMatch(/tanımlı: KESIM/);
  });

  it('turns a filled file into recipe rules the engine calculates (made-up formulas)', () => {
    const read = readRecipeCsv(
      rows(
        'parametre;sineklik;Sineklik;evet_hayir;;;;;hayır;;',
        'parametre;bolme;Bölme sayısı;tam_sayi;adet;;;;;1;4',
        'sinir;en;;;;;;;;1.000;6.000',
        'sinir;acilim;;;;;;;;1000;5000',
        'sinir;yukseklik;;;;;;;;2000;3000',
        'malzeme;108-40X60-BOYALI;;profil;m;2;widthMm-20;;;;',
        'malzeme;108-40x60-boyasiz;;profil;m;;;;;;',
        'malzeme;330-SINEKLIK;;profil;m;bolme;projectionMm;sineklik;;;',
        'malzeme;VIDA;;malzeme;adet;8*bolme;;;;;',
        'operasyon;KESIM;Kesim;;;10+bolme;;;;;',
        'kontrol;;En açılımdan küçük olamaz;;;widthMm>=projectionMm;;;;;',
      ),
      { items, workCenters: ['KESIM'] },
    );
    expect(read).toMatchObject({ ok: true, skipped: 1 });
    if (!read.ok) return;
    expect(read.parts.limits).toEqual({ minWidthMm: 1000, maxWidthMm: 6000, minProjectionMm: 1000, maxProjectionMm: 5000, minMountingHeightMm: 2000, maxMountingHeightMm: 3000 });
    const recipe = { code: 'PRG', name: 'Pergola', version: 1, finishedItemId: id(9), examples: [], ...read.parts };
    const result = calculateRecipe(recipe, { widthMm: 4000, projectionMm: 3000, mountingHeightMm: 2500, quantity: 1, motor: true, led: false, customParameters: { bolme: 2, sineklik: true } });
    expect(result.cuts).toEqual([{ itemId: id(2), lengthMm: 3980, quantity: 2 }, { itemId: id(5), lengthMm: 3000, quantity: 2 }]);
    expect(result.materials.find((m) => m.itemId === id(4))).toMatchObject({ quantity: 16, uom: 'adet' });
    expect(() => calculateRecipe(recipe, { widthMm: 2000, projectionMm: 3000, mountingHeightMm: 2500, quantity: 1, motor: true, led: false, customParameters: { bolme: 1 } })).toThrow('En açılımdan küçük olamaz');
  });

  it('lists every problem with its line and imports nothing', () => {
    const read = readRecipeCsv(
      rows(
        'sinir;en;;;;;;;;6000;1000',
        'sinir;acilim;;;;;;;;;',
        'malzeme;YOK;;profil;m;2;widthMm;;;;',
        'malzeme;VIDA;;profil;adet;2;widthMm;;;;',
        'malzeme;108-40X60-BOYALI;;profil;m;2;;;;;',
        'malzeme;107-60X80-BOYALI;;profil;m;2;genislik-10;;;;',
        'operasyon;BOYA;Boya;;;10;;;;;',
        'birsey;;;;;;;;;;',
      ),
      { items, workCenters: ['KESIM'] },
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    const all = read.errors.join('\n');
    expect(all).toMatch(/Satır 2: en için en_az en_cok'tan büyük/);
    expect(all).toMatch(/Satır 3: acilim için en_az ve en_cok/);
    expect(all).toMatch(/Satır 4: "YOK" kodlu etkin stok kartı yok/);
    expect(all).toMatch(/Satır 5: profil satırı metre/);
    expect(all).toMatch(/Satır 6: profil satırında kesim_boyu_formulu gerekli/);
    expect(all).toMatch(/Satır 7: kesim boyu formülü okunamadı \(Bilinmeyen parametre: genislik\)/);
    expect(all).toMatch(/Satır 8: "BOYA" tanımlı bir iş merkezi değil/);
    expect(all).toMatch(/Satır 9: satir_turu/);
    expect(all).toMatch(/yukseklik sınırı/);
  });
});
