import { MaterialInputSchema, type MaterialInput } from '@/lib/features/inventory/material-contract';
import { foldText } from '@/lib/shared/text/fold';
import { normalizeStates } from '@/lib/features/inventory/vocabulary';
import { parseCsvRecords, readNumber, toCsv } from './csv';

export const MATERIAL_IMPORT_MAX_ROWS = 500;
export const MATERIAL_IMPORT_LABELS = { sku: 'Stok kodu', name: 'Ad', itemType: 'Tür', uom: 'Birim', standardLengthMm: 'Standart boy (mm)', weightPerMeterKg: 'Gramaj (kg/m)', minStock: 'Minimum stok', profileCode: 'Profil kodu', sizeLabel: 'Ölçü', processedStates: 'İşlenmiş hâl', pieceLengthMm: 'Parça boyu (mm)' };
type Field = keyof typeof MATERIAL_IMPORT_LABELS;
const fold = (s: string) => foldText(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const aliases = new Map(Object.entries(MATERIAL_IMPORT_LABELS).map(([key, label]) => [fold(label), key as Field]));
for (const [alias, key] of [['sku', 'sku'], ['malzemeadi', 'name'], ['urunadi', 'name'], ['tip', 'itemType'], ['stokbirimi', 'uom']] as const) aliases.set(alias, key);
const types = new Map([['hammadde', 'raw_material'], ['rawmaterial', 'raw_material'], ['mamul', 'finished_good'], ['finishedgood', 'finished_good'], ['sarf', 'consumable'], ['sarfmalzeme', 'consumable'], ['consumable', 'consumable']]);
const units = new Map([['m', 'm'], ['metre', 'm'], ['adet', 'adet'], ['takim', 'takim'], ['boy', 'boy'], ['kg', 'kg'], ['m2', 'm2']]);
const states = new Set(['boyali', 'boyasiz', 'hazir', 'delikli', 'galvanizli']);
export const MATERIAL_IMPORT_TEMPLATE = toCsv([
  Object.values(MATERIAL_IMPORT_LABELS),
  ['PRG-MAMUL', 'Örnek pergola', 'mamul', 'adet', '', '', '0', '', '', '', ''],
  ['PROFIL-108', 'Örnek profil', 'hammadde', 'm', '6000', '1,25', '0', '108', '40x60', 'boyalı', ''],
  ['VIDA-01', 'Örnek vida', 'sarf', 'adet', '', '', '100', '', '', '', ''],
]);
export type MaterialCsvRow = { line: number; name: string; data?: MaterialInput; errors: string[] };
export function materialIdentity(d: Pick<MaterialInput, 'profileCode' | 'sizeLabel' | 'processedStates' | 'pieceLengthMm'>) {
  return d.profileCode ? JSON.stringify([foldText(d.profileCode), foldText(d.sizeLabel ?? ''), normalizeStates(d.processedStates), d.pieceLengthMm ?? 0]) : null;
}
export function parseMaterialCsv(text: string) {
  if (text.includes('\0')) throw new Error('Dosya geçerli CSV metni değil');
  if (!text.trim()) throw new Error('Dosya boş');
  if (text.length > 2_000_000) throw new Error('Dosya en fazla 2 MB olabilir');
  const records = parseCsvRecords(text).filter((r) => r.cells.some(Boolean));
  if (records.length < 2) throw new Error('Başlık ve en az bir ürün satırı gerekli');
  if (records.length - 1 > MATERIAL_IMPORT_MAX_ROWS) throw new Error(`Bir ürün listesi en fazla ${MATERIAL_IMPORT_MAX_ROWS} satır olabilir`);
  const columns = records[0].cells.map((h) => aliases.get(fold(h)));
  if (columns.some((c) => !c)) throw new Error('Bilinmeyen sütun var. Ürün kartı şablonunu kullanın; stok miktarı bu ekrandan aktarılmaz.');
  if (new Set(columns).size !== columns.length) throw new Error('Aynı sütun birden fazla yazılmış');
  if (['sku', 'name', 'itemType', 'uom'].some((key) => !columns.includes(key as Field))) throw new Error('Stok kodu, Ad, Tür ve Birim sütunları gerekli');
  const rows: MaterialCsvRow[] = records.slice(1).map(({ cells, line }) => {
    const v = Object.fromEntries(columns.map((key, i) => [key, cells[i] ?? ''])) as Partial<Record<Field, string>>;
    const errors: string[] = [];
    if (cells.length !== columns.length) errors.push('Sütun sayısı başlıkla uyuşmuyor');
    const number = (key: Field) => {
      if (!v[key]) return 0;
      const n = readNumber(v[key]);
      if (n === null || Math.abs(n * 1e6 - Math.round(n * 1e6)) > 0.01) errors.push(`${MATERIAL_IMPORT_LABELS[key]} geçerli ve en fazla 6 ondalıklı bir sayı olmalı`);
      return n ?? -1;
    };
    const processed = (v.processedStates ?? '').split(/[|,+]/).filter(Boolean).map(fold);
    if (processed.some((state) => !states.has(state))) errors.push('İşlenmiş hâl bilinmiyor');
    const parsed = MaterialInputSchema.safeParse({
      sku: v.sku, name: v.name, itemType: types.get(fold(v.itemType ?? '')), uom: units.get(fold(v.uom ?? '')),
      standardLengthMm: number('standardLengthMm'), weightPerMeterKg: number('weightPerMeterKg'), minStock: number('minStock'),
      profileCode: v.profileCode, sizeLabel: v.sizeLabel, processedStates: processed,
      pieceLengthMm: v.pieceLengthMm ? number('pieceLengthMm') : null,
    });
    if (!parsed.success) for (const issue of parsed.error.issues) errors.push(`${MATERIAL_IMPORT_LABELS[issue.path[0] as Field] ?? 'Kart'}: ${issue.message}`);
    const data = parsed.success ? { ...parsed.data, processedStates: normalizeStates(parsed.data.processedStates) } : undefined;
    return { line, name: `${v.sku ?? ''} · ${v.name ?? ''}`.slice(0, 370), data, errors };
  });
  const seen = new Map<string, MaterialCsvRow>();
  for (const row of rows) if (row.data) {
    const identity = materialIdentity(row.data);
    for (const key of ['sku:' + foldText(row.data.sku), ...(identity ? ['identity:' + identity] : [])]) {
      const first = seen.get(key);
      if (first) {
        const message = 'Aynı stok kodu veya profil kimliği dosyada tekrarlanıyor';
        if (!row.errors.includes(message)) row.errors.push(message);
        if (!first.errors.includes(message)) first.errors.push(message);
      } else seen.set(key, row);
    }
  }
  return { rows, columns: Object.fromEntries(records[0].cells.map((label, i) => [columns[i]!, label])) };
}
