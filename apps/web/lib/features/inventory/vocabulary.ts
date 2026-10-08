/**
 * Stock vocabulary shown to people: warehouse types, units, processed states and where a stock
 * movement came from. Codes stay in the database; screens show these names.
 */

export const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  RAW: 'Hammadde deposu',
  WIP: 'Üretim (yarı mamul)',
  FINISHED: 'Mamul deposu',
  REUSABLE_REMNANTS: 'Kullanılabilir artık',
  SCRAP: 'Hurda',
  REJECTED: 'Red / iade',
};
export const warehouseTypeLabel = (type: string | null | undefined) => (type && WAREHOUSE_TYPE_LABELS[type]) || type || '—';

/**
 * Units are explicit and never converted silently: metres for profile bars, counted units for
 * pieces. "boy" counts whole bars whose length is not known yet.
 */
export const STOCK_UNITS = ['m', 'adet', 'takim', 'boy', 'kg', 'm2'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];
export const UNIT_LABELS: Record<StockUnit, string> = { m: 'metre', adet: 'adet', takim: 'takım', boy: 'boy (çubuk)', kg: 'kg', m2: 'm²' };
export const unitLabel = (unit: string | null | undefined) => (unit && UNIT_LABELS[unit as StockUnit]) || unit || '—';
/** A quantity as people read it (Turkish digits, at most three decimals), with its unit when given. */
export const formatQty = (n: number, unit?: string) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 }) + (unit ? ` ${unitLabel(unit)}` : '');
/** Units counted in whole pieces. */
export const COUNT_UNITS: ReadonlySet<string> = new Set(['adet', 'takim', 'boy']);

/** Processed states make separate stock items: a painted bar is not interchangeable with a raw one. */
export const PROCESSED_STATES = ['boyali', 'boyasiz', 'hazir', 'delikli', 'galvanizli'] as const;
export type ProcessedState = (typeof PROCESSED_STATES)[number];
export const STATE_LABELS: Record<ProcessedState, string> = { boyali: 'Boyalı', boyasiz: 'Boyasız', hazir: 'Hazır', delikli: 'Delikli', galvanizli: 'Galvanizli' };
/** One order for the same set of states, so the identity index sees them as equal. */
export const normalizeStates = (states: readonly string[]) =>
  [...new Set(states)].filter((s): s is ProcessedState => (PROCESSED_STATES as readonly string[]).includes(s)).sort();

/** Where a stock movement came from (stock_entries.reference_type). */
export const MOVEMENT_SOURCE_LABELS: Record<string, string> = {
  manual: 'Elle giriş',
  goods_receipt: 'Mal kabul',
  cutting_plan: 'Kesim planı',
  work_order: 'Üretim emri',
  rework: 'Rework',
  shipment: 'Sevkiyat',
  warehouse_count: 'Sayım',
  opening_count: 'Açılış sayımı',
  warehouse_transfer: 'Depo transferi',
  stock_entry_reversal: 'Geri alma',
};
export const movementSourceLabel = (type: string | null | undefined) => (type && MOVEMENT_SOURCE_LABELS[type]) || (type ? type : 'Kaynak yok');

/**
 * One spelling for a colour name: trimmed, single spaces, lower case without the Turkish dotted /
 * dotless I difference ("7016 MAT", "7016 Mat", " 7016  mat " are one colour). The catalogue's
 * uniqueness, stock matching and the cutting engine all compare colours through this.
 */
export const colorKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i');
