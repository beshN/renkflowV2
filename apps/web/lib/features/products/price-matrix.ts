import { parseCsvRecords, readNumber, toCsv } from './csv';
import { PRODUCT_FAMILIES, productFamily } from './families';

/**
 * The firm's price matrix for a product family, banded by its two price measures (for a pergola:
 * en × açılım), with option surcharges. Every value comes from the firm's own file; nothing here
 * has a default price. A measure the matrix does not cover is reported, never interpolated.
 */
export const CURRENCIES = ['TRY', 'EUR', 'USD', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];
export type PriceBasis = 'adet' | 'm2';

export type BaseRow = { row: number; variant: string; minA: number; maxA: number; minB: number; maxB: number; basis: PriceBasis; unitPrice: number };
export type OptionRow = { row: number; variant: string; option: string; basis: PriceBasis; unitPrice: number };
export type PriceMatrix = { family: string; currency: Currency; base: BaseRow[]; options: OptionRow[] };

export const MATRIX_COLUMNS = ['aile', 'satir_turu', 'varyant', 'en_min_mm', 'en_max_mm', 'acilim_min_mm', 'acilim_max_mm', 'opsiyon', 'fiyat_esasi', 'birim_fiyat', 'para_birimi'] as const;
const ANY = '*';
/** Who may see the matrix (and so be pointed to it); importing is for owner and admin only. */
export const PRICE_MATRIX_READ_ROLES: readonly string[] = ['owner', 'admin', 'office', 'accountant'];
export const PRICE_MATRIX_IMPORT_ROLES: readonly string[] = ['owner', 'admin'];
const MAX_ROWS = 5000;

const fold = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[\s-]+/g, '_');

/** The empty template: the columns, and how to fill them as comment lines (ignored on import). No prices. */
export function matrixTemplate(familyKey: string) {
  const family = productFamily(familyKey);
  if (!family) throw new Error('Bilinmeyen ürün ailesi');
  const [a, b] = family.priceAxes.map((k) => family.dimensions.find((d) => d.key === k)!.label);
  return toCsv([
    ['# Fiyat matrisi şablonu: ' + family.label + '. "#" ile başlayan satırlar okunmaz; değerleri siz doldurun.'],
    ['# satir_turu: "taban" (ölçü kademesi fiyatı) veya "opsiyon" (ek). varyant: reçete kodu ya da tüm modeller için "*".'],
    [`# taban: en_min_mm..en_max_mm = ${a}, acilim_min_mm..acilim_max_mm = ${b} (sınırlar dahil, tam sayı mm). Aynı varyantta kademeler çakışmamalı.`],
    ['# opsiyon: opsiyon = reçete parametre kodu (ör. motor, led); seçildiğinde eklenir. Ölçü sütunları boş kalır.'],
    ['# fiyat_esasi: "adet" (ürün başına) veya "m2" (en × açılım alanı başına). birim_fiyat: virgüllü ondalık (1.250,50). para_birimi: TRY, EUR, USD, GBP (dosyada tek).'],
    [...MATRIX_COLUMNS],
  ]);
}

export type ImportResult = { ok: true; matrix: PriceMatrix } | { ok: false; errors: string[] };

/** Reads a filled template. Any problem in any row rejects the whole file, with every problem listed. */
export function readMatrixCsv(text: string, expectedFamily?: string): ImportResult {
  const rows = parseCsvRecords(text).filter((r) => r.cells.some((c) => c) && !r.cells[0].startsWith('#'));
  if (!rows.length) return { ok: false, errors: ['Dosyada başlık satırı yok'] };
  const header = rows[0].cells.map(fold);
  const missing = MATRIX_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) return { ok: false, errors: [`Eksik sütun: ${missing.join(', ')}`] };
  const data = rows.slice(1);
  if (!data.length) return { ok: false, errors: ['Dosyada fiyat satırı yok'] };
  if (data.length > MAX_ROWS) return { ok: false, errors: [`En fazla ${MAX_ROWS} satır`] };
  const errors: string[] = [];
  const families = new Set<string>();
  const currencies = new Set<string>();
  const base: BaseRow[] = [];
  const options: OptionRow[] = [];
  for (const { cells, line } of data) {
    const get = (c: (typeof MATRIX_COLUMNS)[number]) => cells[header.indexOf(c)] ?? '';
    const say = (m: string) => errors.push(`Satır ${line}: ${m}`);
    const family = fold(get('aile'));
    if (!productFamily(family)) say(`bilinmeyen aile "${get('aile')}" (${PRODUCT_FAMILIES.map((f) => f.key).join(', ')})`);
    families.add(family);
    const currency = get('para_birimi').toUpperCase();
    if (!(CURRENCIES as readonly string[]).includes(currency)) say(`para birimi "${get('para_birimi')}" geçersiz`);
    currencies.add(currency);
    const basis = fold(get('fiyat_esasi'));
    if (basis !== 'adet' && basis !== 'm2') say(`fiyat_esasi "adet" veya "m2" olmalı`);
    const price = readNumber(get('birim_fiyat'));
    if (price === null) say('birim fiyat boş veya okunamadı');
    else if (price < 0) say('birim fiyat negatif olamaz');
    const variant = get('varyant') || ANY;
    const kind = fold(get('satir_turu'));
    if (kind === 'taban') {
      const mm = (c: (typeof MATRIX_COLUMNS)[number]) => {
        const n = readNumber(get(c));
        if (n === null || !Number.isInteger(n) || n <= 0) {
          say(`${c} pozitif tam sayı (mm) olmalı`);
          return NaN;
        }
        return n;
      };
      const [minA, maxA, minB, maxB] = [mm('en_min_mm'), mm('en_max_mm'), mm('acilim_min_mm'), mm('acilim_max_mm')];
      if (minA > maxA || minB > maxB) say('kademe alt sınırı üst sınırdan büyük');
      if (get('opsiyon')) say('taban satırında opsiyon boş olmalı');
      base.push({ row: line, variant, minA, maxA, minB, maxB, basis: basis as PriceBasis, unitPrice: price ?? NaN });
    } else if (kind === 'opsiyon') {
      const option = get('opsiyon');
      if (!/^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(option)) say('opsiyon, reçete parametre kodu olmalı (harfle başlar, harf/rakam/_)');
      if (['en_min_mm', 'en_max_mm', 'acilim_min_mm', 'acilim_max_mm'].some((c) => get(c as never))) say('opsiyon satırında ölçü sütunları boş olmalı');
      options.push({ row: line, variant, option, basis: basis as PriceBasis, unitPrice: price ?? NaN });
    } else say('satir_turu "taban" veya "opsiyon" olmalı');
  }
  if (families.size > 1) errors.push('Dosyada tek ürün ailesi olmalı');
  if (currencies.size > 1) errors.push('Dosyada tek para birimi olmalı');
  const family = [...families][0];
  if (expectedFamily && family !== expectedFamily) errors.push(`Dosya "${family}" ailesi için; seçilen aile "${expectedFamily}"`);
  for (let i = 0; i < base.length; i++)
    for (let j = i + 1; j < base.length; j++) {
      const x = base[i], y = base[j];
      if (x.variant === y.variant && x.minA <= y.maxA && y.minA <= x.maxA && x.minB <= y.maxB && y.minB <= x.maxB)
        errors.push(`Satır ${x.row} ve ${y.row}: aynı varyantta ölçü kademeleri çakışıyor`);
    }
  const seen = new Map<string, number>();
  for (const o of options) {
    const key = o.variant + ':' + o.option;
    if (seen.has(key)) errors.push(`Satır ${seen.get(key)} ve ${o.row}: aynı opsiyon iki kez`);
    else seen.set(key, o.row);
  }
  if (!base.length && !errors.length) errors.push('En az bir "taban" satırı gerekli');
  if (errors.length) return { ok: false, errors: errors.slice(0, 200) };
  return { ok: true, matrix: { family, currency: [...currencies][0] as Currency, base, options } };
}

export type PriceInput = { variant: string; a: number; b: number; options: Record<string, number | boolean> };
export type PriceResult =
  | {
      status: 'priced';
      currency: Currency;
      unitPrice: number;
      lines: Array<{ label: string; basis: PriceBasis; unitPrice: number; amount: number; row: number }>;
      /** Options chosen that the matrix has no price for: the price is incomplete, said so, never zero-filled. */
      unpricedOptions: string[];
    }
  | { status: 'not_covered'; message: string };

const money = (n: number) => Math.round(n * 100) / 100;

/** The unit price of one configured product: its band (variant first, then "*") plus the chosen options. */
export function priceFromMatrix(matrix: PriceMatrix, input: PriceInput): PriceResult {
  const areaM2 = (input.a * input.b) / 1_000_000;
  const within = (r: BaseRow) => input.a >= r.minA && input.a <= r.maxA && input.b >= r.minB && input.b <= r.maxB;
  const band = matrix.base.find((r) => r.variant === input.variant && within(r)) ?? matrix.base.find((r) => r.variant === ANY && within(r));
  if (!band) return { status: 'not_covered', message: `Fiyat matrisi bu ölçüyü kapsamıyor (${input.a} × ${input.b} mm, ${input.variant})` };
  const amount = (basis: PriceBasis, price: number) => money(basis === 'm2' ? price * areaM2 : price);
  const lines = [{ label: `Ölçü kademesi ${band.minA}–${band.maxA} × ${band.minB}–${band.maxB} mm`, basis: band.basis, unitPrice: band.unitPrice, amount: amount(band.basis, band.unitPrice), row: band.row }];
  const unpricedOptions: string[] = [];
  for (const [key, value] of Object.entries(input.options)) {
    if (!(value === true || (typeof value === 'number' && value > 0))) continue;
    const option = matrix.options.find((o) => o.option === key && o.variant === input.variant) ?? matrix.options.find((o) => o.option === key && o.variant === ANY);
    if (!option) {
      unpricedOptions.push(key);
      continue;
    }
    // A number is how many (e.g. 2 motors); true is one.
    const count = value === true ? 1 : value;
    lines.push({
      label: `Opsiyon: ${key}${count === 1 ? '' : ` × ${count}`}`,
      basis: option.basis,
      unitPrice: option.unitPrice,
      amount: money(amount(option.basis, option.unitPrice) * count),
      row: option.row,
    });
  }
  return { status: 'priced', currency: matrix.currency, unitPrice: money(lines.reduce((s, l) => s + l.amount, 0)), lines, unpricedOptions };
}
