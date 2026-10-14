import { parseCsvRecords, readNumber, toCsv } from '@/lib/features/products/csv';
import { colorKey, normalizeStates, type ProcessedState } from '@/lib/features/inventory/vocabulary';
import { splitMaterial, type CountDocument, type CountRow, type CountUnit } from './parse';

export const MAX_COUNT_CSV_ROWS = 500;
export const MAX_COUNT_CSV_CHARS = 2_000_000;
const fold = (s: string) => s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');
const headers = ['Bölüm', 'Kod', 'Malzeme', 'Ölçü', 'Renk', 'İşlenmiş hâl', 'Miktar', 'Birim', 'Çubuk boyu (mm)', 'Gramaj (kg/m)', 'Ağırlık (kg)'] as const;
const keys = ['section', 'code', 'name', 'size', 'color', 'states', 'quantity', 'unit', 'length', 'perMeter', 'weight'] as const;
type Key = typeof keys[number];
const aliases: Record<string, Key> = Object.assign(Object.create(null), Object.fromEntries(headers.map((h, i) => [fold(h), keys[i]])));
Object.assign(aliases, { name: 'name', malzemeadi: 'name', stokadi: 'name', profilkodu: 'code', quantity: 'quantity', unit: 'unit', adet: 'quantity', durum: 'states', parcaboyu: 'length' });
const units: Record<string, CountUnit> = { m: 'm', metre: 'm', meter: 'm', adet: 'adet', takim: 'takim', boy: 'boy' };
const states: Record<string, ProcessedState> = { boyali: 'boyali', boyasiz: 'boyasiz', hazir: 'hazir', delikli: 'delikli', galvanizli: 'galvanizli' };

export const countCsvTemplate = () => toCsv([
  [...headers],
  ['Aksesuar', '', 'Örnek Köşebent', '', '', '', '20', 'adet', '', '', ''],
  ['Profil', '900', 'Örnek Profil', '40x60', 'RAL 7016 Mat', 'boyalı', '120', 'm', '', '1,25', '150'],
  ['Profil', '901', 'Örnek Çubuk', '40x40', '', 'boyasız', '10', 'boy', '6000', '', ''],
]);

/** CSV quantities stay in their stated unit; uncertain rows remain visible for review. */
export function parseCountCsv(text: string): CountDocument {
  if (text.length > MAX_COUNT_CSV_CHARS) throw new Error('CSV dosyası en fazla 2 MB olabilir');
  const records = parseCsvRecords(text).filter((r) => r.cells.some(Boolean));
  if (records.length < 2) throw new Error('CSV başlığı ve en az bir sayım satırı gerekli');
  if (records.length - 1 > MAX_COUNT_CSV_ROWS) throw new Error(`Bir sayım listesi en fazla ${MAX_COUNT_CSV_ROWS} satır olabilir`);
  const columns = records[0].cells.map((h) => aliases[fold(h)]);
  const unknown = records[0].cells.filter((_, i) => !columns[i]);
  if (unknown.length) throw new Error(`Bilinmeyen sütun: ${unknown.join(', ').slice(0, 200)}. Sayım şablonunu kullanın.`);
  if (new Set(columns).size !== columns.length) throw new Error('Aynı sütun birden fazla kez yazılmış');
  for (const key of ['name', 'quantity', 'unit'] as const) if (!columns.includes(key)) throw new Error('Malzeme, Miktar ve Birim sütunları gerekli');
  const rows: CountRow[] = records.slice(1).map(({ cells, line }) => {
    const values = Object.fromEntries(keys.map((key) => [key, columns.includes(key) ? cells[columns.indexOf(key)] ?? '' : ''])) as Record<Key, string>;
    const issues: string[] = [];
    if (cells.length !== columns.length) issues.push('Sütun sayısı başlıkla uyuşmuyor');
    const bounded = (key: Key, max: number) => {
      if (values[key].length > max) issues.push(`${headers[keys.indexOf(key)]} en fazla ${max} karakter olabilir`);
      return values[key].slice(0, max) || null;
    };
    const name = bounded('name', 300) ?? '';
    const parsed = splitMaterial(name);
    const size = bounded('size', 40) ?? parsed.size;
    const color = bounded('color', 100) ?? parsed.color;
    if (values.size && parsed.size && fold(values.size) !== fold(parsed.size)) issues.push('Malzeme adı ve Ölçü sütunu farklı ölçüler içeriyor');
    if (values.color && parsed.color && colorKey(values.color) !== colorKey(parsed.color)) issues.push('Malzeme adı ve Renk sütunu farklı renkler içeriyor');
    const givenStates = values.states.split(/[|,+]/).filter(Boolean).map((s) => Object.hasOwn(states, fold(s)) ? states[fold(s)] : undefined);
    if (givenStates.some((s) => !s)) issues.push('İşlenmiş hâl bilinmiyor; boyalı, boyasız, hazır, delikli veya galvanizli yazın');
    const rowStates = normalizeStates([...parsed.states, ...givenStates.filter((s): s is ProcessedState => s !== undefined), ...(color && colorKey(color) === colorKey('Boyasız') ? ['boyasiz'] : [])]);
    if (rowStates.includes('boyali') && rowStates.includes('boyasiz')) issues.push('Boyalı ve boyasız aynı satırda olamaz');
    if (color && rowStates.includes('boyasiz') && colorKey(color) !== colorKey('Boyasız')) issues.push('Boyasız malzemeye boya rengi yazılmış');
    const number = (key: Key, optional = false) => {
      if (optional && !values[key]) return null;
      const n = readNumber(values[key]);
      if (n === null || n <= 0 || n > 1_000_000_000 || Math.abs(n * 1_000_000 - Math.round(n * 1_000_000)) > 0.01) {
        issues.push(`${headers[keys.indexOf(key)]} pozitif, en fazla 6 ondalıklı bir sayı olmalı`);
        return null;
      }
      return n;
    };
    const quantity = number('quantity');
    const unit = Object.hasOwn(units, fold(values.unit)) ? units[fold(values.unit)] : null;
    if (!unit) issues.push('Birim desteklenmiyor; m, adet, takım veya boy yazın');
    if (quantity !== null && unit && unit !== 'm' && !Number.isInteger(quantity)) issues.push('Adet, takım ve boy miktarı tam sayı olmalı');
    let pieceLengthMm = number('length', true);
    if (pieceLengthMm !== null && (!Number.isInteger(pieceLengthMm) || pieceLengthMm < 100 || pieceLengthMm > 20000)) {
      issues.push('Çubuk boyu 100–20000 mm arasında tam sayı olmalı');
      pieceLengthMm = null;
    }
    const weightPerMeterKg = number('perMeter', true), weightKg = number('weight', true);
    const code = bounded('code', 40);
    if (!name) issues.push('Malzeme adı boş');
    if ((unit === 'm' || unit === 'boy') && !code) issues.push('Profil kodu gerekli');
    if (unit === 'boy' && pieceLengthMm === null) issues.push('Boy birimi için çubuk boyu gerekli');
    if (unit === 'm' && (weightPerMeterKg === null || weightKg === null)) issues.push('Metre satırında gramaj ve ağırlık gerekli');
    const metres = unit === 'm' ? quantity : unit === 'boy' && quantity !== null && pieceLengthMm !== null ? quantity * pieceLengthMm / 1000 : null;
    if (metres !== null && weightPerMeterKg !== null && weightKg !== null) {
      const expected = metres * weightPerMeterKg;
      if (Math.abs(expected - weightKg) > Math.max(0.05, expected * 0.001)) issues.push('Gramaj tutarsız: miktar × gramaj toplam ağırlıkla uyuşmuyor');
    }
    if (unit && ['adet', 'takim'].includes(unit) && weightPerMeterKg !== null) issues.push('Adet/takım satırında kg/m gramajı kullanılamaz');
    return { ref: `csv-${line}`, page: 1, section: bounded('section', 200) ?? 'CSV sayımı', code, name, size, color, states: rowStates, quantity, unit, pieceLengthMm, weightPerMeterKg, weightKg, detail: null, issues, unplaced: [] };
  });
  const seen = new Map<string, CountRow>();
  for (const row of rows) {
    const key = JSON.stringify([fold(row.code ?? ''), fold(row.name.split('/')[0]), fold(row.size ?? ''), row.states, colorKey(row.color ?? ''), row.pieceLengthMm, row.unit]);
    const first = seen.get(key);
    if (first) {
      row.issues.push('Aynı kalem listede iki kez geçiyor');
      if (!first.issues.includes('Aynı kalem listede iki kez geçiyor')) first.issues.push('Aynı kalem listede iki kez geçiyor');
    } else seen.set(key, row);
  }
  return { title: 'CSV sayım listesi', date: null, pages: 0, rows };
}
