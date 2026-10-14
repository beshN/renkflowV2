import { evaluateFormula, RecipeSchema, type RecipeDefinition } from '@/lib/features/manufacturing/recipe-engine';
import { parseCsvRecords, readNumber, toCsv } from './csv';
import { productFamily } from './families';

/**
 * The firm's recipe for a product family as a CSV: which stock card, how many, at what cut length,
 * under which option, plus the options themselves, the limits and the routing. The template lists
 * the family's stock cards (profile codes from the count list) with every formula empty; nothing
 * here is a default rule. A filled file becomes a draft recipe, published only after the firm's
 * own worked examples check out in the recipe screen.
 */
export const RECIPE_COLUMNS = ['satir_turu', 'kod', 'ad', 'tur', 'birim', 'miktar_formulu', 'kesim_boyu_formulu', 'kosul', 'varsayilan', 'en_az', 'en_cok'] as const;
type Column = (typeof RECIPE_COLUMNS)[number];

export type TemplateItem = { id: string; sku: string; name: string; profileCode: string | null; uom: string };
const LIMITS = { en: 'Width', acilim: 'Projection', yukseklik: 'MountingHeight' } as const;
/** Lower case without Turkish dotted/dotless and accent differences: "PROFIL", "Profil", "profıl" read the same. */
const fold = (s: string) =>
  s.trim().toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
const BUILT_IN = ['widthMm', 'projectionMm', 'mountingHeightMm', 'areaM2', 'motor', 'led', 'quantity'];

export function recipeTemplate(familyKey: string, items: TemplateItem[], workCenters: string[]) {
  const family = productFamily(familyKey);
  if (!family) throw new Error('Bilinmeyen ürün ailesi');
  const order = (code: string | null) => {
    const i = family.profileCodes.indexOf(code ?? '');
    return i < 0 ? family.profileCodes.length : i;
  };
  const cards = items.filter((i) => i.profileCode && family.profileCodes.includes(i.profileCode)).sort((a, b) => order(a.profileCode) - order(b.profileCode) || a.sku.localeCompare(b.sku));
  const missing = family.profileCodes.filter((code) => !cards.some((c) => c.profileCode === code));
  const comment = (text: string) => ['# ' + text];
  return toCsv([
    comment(`${family.label} reçete şablonu. "#" ile başlayan satırlar okunmaz. Formülleri ve sınırları siz doldurun; boş bırakılan malzeme satırı reçeteye girmez.`),
    comment('Değişkenler: widthMm (en), projectionMm (açılım), mountingHeightMm (yükseklik), areaM2, motor ve led (0/1) ile sizin tanımladığınız parametreler. İşlemler: + - * / ( ) < > <= >= == !=, ceil, floor, round, min, max, abs, if(koşul, a, b).'),
    comment('parametre: kod (harfle başlar; ör. rayTipi), ad, tur (sayi | tam_sayi | evet_hayir), birim, varsayilan (boşsa teklifte zorunlu), en_az, en_cok. Müşterinin seçtiği seçenekler böyle tanımlanır ve kosul sütununda kullanılır (ör. rayTipi == 1).'),
    comment('malzeme: kod = stok kartı kodu. tur = profil ise miktar_formulu kesilecek parça adedi, kesim_boyu_formulu parça boyu (mm); diğer malzemede miktar_formulu kartın birimiyle miktar. kosul doluysa sonucu 0 değilken kullanılır.'),
    comment(`operasyon: kod = iş merkezi kodu (tanımlı: ${workCenters.length ? workCenters.join(', ') : 'yok — önce Üretim > İş merkezleri'}), ad = operasyon adı, miktar_formulu = süre (dakika), kosul. En az bir operasyon gerekli.`),
    comment('sinir: kod = en | acilim | yukseklik; en_az ve en_cok mm. kontrol: miktar_formulu = sağlanması gereken koşul, ad = sağlanmazsa gösterilecek mesaj.'),
    ...(missing.length ? [comment(`Stok kartı olmayan profil kodları: ${missing.join(', ')} (sayım listesi içe aktarılınca ya da elle kart açılınca şablona gelir).`)] : []),
    [...RECIPE_COLUMNS],
    ...(['en', 'acilim', 'yukseklik'] as const).map((k) => ['sinir', k, '', '', '', '', '', '', '', '', '']),
    ...cards.map((c) => ['malzeme', c.sku, c.name, c.uom === 'm' ? 'profil' : 'malzeme', c.uom, '', '', '', '', '', '']),
    ['operasyon', '', '', '', '', '', '', '', '', '', ''],
  ]);
}

/** Syntax only: a formula that cannot be read or names an unknown variable. Values are checked by the worked examples. */
function formulaProblem(formula: string, variables: Record<string, number>) {
  try {
    evaluateFormula(formula, variables);
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return /Bilinmeyen parametre|Geçersiz formül|Parantez|tamamlanmadı|Fonksiyon parametreleri|çok uzun|iç içe/.test(message) ? message : null;
  }
}

export type RecipeParts = Pick<RecipeDefinition, 'rules' | 'operations' | 'limits' | 'parameterDefinitions' | 'constraints'>;
export type RecipeImport = { ok: true; parts: RecipeParts; skipped: number } | { ok: false; errors: string[] };

export function readRecipeCsv(text: string, ctx: { items: TemplateItem[]; workCenters: string[] }): RecipeImport {
  const records = parseCsvRecords(text).filter((r) => r.cells.some((c) => c) && !r.cells[0].startsWith('#'));
  if (!records.length) return { ok: false, errors: ['Dosyada başlık satırı yok'] };
  const header = records[0].cells.map(fold);
  const missingColumns = RECIPE_COLUMNS.filter((c) => !header.includes(c));
  if (missingColumns.length) return { ok: false, errors: [`Eksik sütun: ${missingColumns.join(', ')}`] };
  const errors: string[] = [];
  if (new Set(header).size !== header.length) return { ok: false, errors: ['Aynı sütun birden fazla kez yazılmış'] };
  if (records.length > 2001) return { ok: false, errors: ['Bir reçete dosyası en fazla 2.000 satır olabilir'] };
  const parameterDefinitions: NonNullable<RecipeParts['parameterDefinitions']> = [];
  const rules: RecipeParts['rules'] = [];
  const operations: RecipeParts['operations'] = [];
  const constraints: NonNullable<RecipeParts['constraints']> = [];
  const limits: Record<string, number> = {};
  const formulaRows: Array<{ line: number; label: string; formula: string }> = [];
  let skipped = 0;
  const bySku = new Map<string, TemplateItem[]>();
  for (const item of ctx.items) bySku.set(fold(item.sku), [...(bySku.get(fold(item.sku)) ?? []), item]);
  const centers = new Map<string, string[]>();
  for (const code of ctx.workCenters) centers.set(fold(code), [...(centers.get(fold(code)) ?? []), code]);
  for (const { cells, line } of records.slice(1)) {
    const get = (c: Column) => cells[header.indexOf(c)] ?? '';
    const say = (m: string) => errors.push(`Satır ${line}: ${m}`);
    const kind = fold(get('satir_turu'));
    const formula = (c: Column, label: string) => {
      const f = get(c);
      if (f) formulaRows.push({ line, label, formula: f });
      return f || undefined;
    };
    if (kind === 'parametre') {
      const type = fold(get('tur'));
      if (!['sayi', 'tam_sayi', 'evet_hayir'].includes(type)) say('parametre türü sayi, tam_sayi ya da evet_hayir olmalı');
      const isBool = type.startsWith('evet');
      const num = (c: Column) => {
        const v = get(c);
        if (!v) return undefined;
        const n = readNumber(v);
        if (n === null) say(`${c} sayı olmalı`);
        return n ?? undefined;
      };
      const def = get('varsayilan');
      let defaultValue: number | boolean | undefined;
      if (def) {
        if (isBool) {
          const v = fold(def);
          if (!['evet', 'hayir', '1', '0'].includes(v)) say('evet_hayir varsayılanı evet ya da hayır olmalı');
          defaultValue = v === 'evet' || v === '1';
        } else defaultValue = num('varsayilan');
      }
      parameterDefinitions.push({
        key: get('kod'),
        label: get('ad') || get('kod'),
        type: isBool ? 'boolean' : 'number',
        unit: get('birim'),
        required: def === '',
        defaultValue,
        minimum: isBool ? undefined : num('en_az'),
        maximum: isBool ? undefined : num('en_cok'),
        integer: type.startsWith('tam'),
      });
    } else if (kind === 'malzeme') {
      const quantity = formula('miktar_formulu', 'miktar');
      const cut = formula('kesim_boyu_formulu', 'kesim boyu');
      const condition = formula('kosul', 'koşul');
      if (!quantity && !cut && !condition) {
        skipped++;
        continue;
      }
      const matches = bySku.get(fold(get('kod'))) ?? [];
      if (matches.length > 1) { say('Stok kodu birden fazla kartla eşleşiyor; kartları inceleyin'); continue; }
      const [item] = matches;
      if (!item) {
        say(`"${get('kod')}" kodlu etkin stok kartı yok`);
        continue;
      }
      const type = fold(get('tur'));
      if (type !== 'profil' && type !== 'malzeme') say('malzeme satırında tur profil ya da malzeme olmalı');
      const profile = type === 'profil';
      if (profile && item.uom !== 'm') say('profil satırı metre ile tutulan bir kart olmalı');
      if (profile && !cut) say('profil satırında kesim_boyu_formulu gerekli');
      if (!profile && cut) say('kesim boyu yalnız profil satırında kullanılır');
      if (!quantity) say('miktar_formulu gerekli');
      rules.push({ itemId: item.id, kind: profile ? 'profile' : 'material', uom: item.uom as any, quantityFormula: quantity ?? '0', cutLengthFormula: cut, conditionFormula: condition });
    } else if (kind === 'operasyon') {
      const minutes = formula('miktar_formulu', 'süre');
      const condition = formula('kosul', 'koşul');
      if (!get('kod') && !get('ad') && !minutes) {
        skipped++;
        continue;
      }
      const matchingCenters = centers.get(fold(get('kod'))) ?? [];
      if (matchingCenters.length > 1) { say('İş merkezi kodu birden fazla kayıtla eşleşiyor; merkezleri inceleyin'); continue; }
      const [center] = matchingCenters;
      if (!center) say(`"${get('kod')}" tanımlı bir iş merkezi değil`);
      if (!get('ad')) say('operasyon adı gerekli');
      if (!minutes) say('süre formülü (miktar_formulu) gerekli');
      operations.push({ name: get('ad'), workCenterCode: center ?? get('kod'), minutesFormula: minutes ?? '0', conditionFormula: condition, qualityChecks: [] });
    } else if (kind === 'sinir') {
      const key = fold(get('kod')) as keyof typeof LIMITS;
      if (!Object.hasOwn(LIMITS, key)) {
        say('sınır kodu en, acilim ya da yukseklik olmalı');
        continue;
      }
      const min = readNumber(get('en_az')), max = readNumber(get('en_cok'));
      if (min === null || max === null || min <= 0 || max <= 0) say(`${key} için en_az ve en_cok mm olarak gerekli`);
      else if (min > max) say(`${key} için en_az en_cok'tan büyük`);
      else {
        limits[`min${LIMITS[key]}Mm`] = min;
        limits[`max${LIMITS[key]}Mm`] = max;
      }
    } else if (kind === 'kontrol') {
      const f = formula('miktar_formulu', 'kontrol');
      if (!f || !get('ad')) say('kontrol için koşul (miktar_formulu) ve mesaj (ad) gerekli');
      else constraints.push({ formula: f, message: get('ad') });
    } else say('satir_turu parametre, malzeme, operasyon, sinir ya da kontrol olmalı');
  }
  for (const k of Object.keys(LIMITS)) if (!(`min${LIMITS[k as keyof typeof LIMITS]}Mm` in limits) && !errors.some((e) => e.includes(`${k} için`))) errors.push(`${k} sınırı (sinir satırı) gerekli`);
  if (!rules.length) errors.push('En az bir malzeme satırı doldurulmalı');
  if (!operations.length) errors.push('En az bir operasyon gerekli');
  const keys = parameterDefinitions.map((p) => p.key);
  const variables = Object.fromEntries([...BUILT_IN, ...keys].map((k) => [k, 1]));
  for (const f of formulaRows) {
    const problem = formulaProblem(f.formula, variables);
    if (problem) errors.push(`Satır ${f.line}: ${f.label} formülü okunamadı (${problem})`);
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 200) };
  // The engine's own schema has the last word (parameter names, units, profile rules).
  const checked = RecipeSchema.safeParse({ code: 'TASLAK', name: 'Taslak', version: 1, finishedItemId: '00000000-0000-4000-8000-000000000000', rules, operations, limits, parameterDefinitions, constraints, examples: [] });
  if (!checked.success) return { ok: false, errors: checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 50) };
  const d = checked.data;
  return { ok: true, parts: { rules: d.rules, operations: d.operations, limits: d.limits, parameterDefinitions: d.parameterDefinitions, constraints: d.constraints }, skipped };
}
