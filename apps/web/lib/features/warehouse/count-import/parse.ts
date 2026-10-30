/**
 * Deterministic reader for the printed stock count list ("MALZEME SAYIM LİSTESİ"). It works on the
 * positioned text of the PDF (see extract.ts): no model, no guessing. Every row either parses
 * cleanly or carries the reasons it is uncertain; nothing is filled in.
 */

export type TextItem = { page: number; x: number; y: number; text: string };

export type CountUnit = 'm' | 'adet' | 'takim' | 'boy';

/** Processed states that make a separate stock item (painted, drilled, ready-made ...). */
export type ProcessedState = 'boyali' | 'boyasiz' | 'hazir' | 'delikli' | 'galvanizli';

export type CountRow = {
  /** Stable within one document: page, line and column side. */
  ref: string;
  page: number;
  section: string;
  code: string | null;
  /** The material text as printed. */
  name: string;
  /** Profile cross-section such as "40x60", when the name carries one. */
  size: string | null;
  /** Colour as printed (RAL code with finish, or a colour word); null when not given. */
  color: string | null;
  states: ProcessedState[];
  quantity: number | null;
  unit: CountUnit | null;
  /** Bar length of each piece when the row states one (e.g. "450 cm", "4 m"). */
  pieceLengthMm: number | null;
  weightPerMeterKg: number | null;
  weightKg: number | null;
  detail: string | null;
  /** Why the row cannot be imported as it is; empty when it is clean. */
  issues: string[];
  /** Text that was on the line but could not be placed in a column. */
  unplaced: string[];
};

export type CountDocument = { title: string | null; date: string | null; rows: CountRow[]; pages: number };

const HEADER_WORDS = new Set(['Profil', 'Kod', 'Malzeme', 'Boy', 'Gramaj', 'Ağırlık', 'Ölçü', 'Miktar', 'Detay']);
const LINE_TOLERANCE = 3;
/** Weight may differ from length × kg/m by rounding: 0.05 kg or 0.1 %, whichever is larger. */
const WEIGHT_TOLERANCE = (expected: number) => Math.max(0.05, Math.abs(expected) * 0.001);

/** Turkish number: "2.295,68" → 2295.68, "49,50" → 49.5, "900" → 900. Null when not a number. */
export function trNumber(text: string): number | null {
  const t = text.trim();
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(t)) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const RE = {
  meters: /^(-?[\d.,]+)\s*m$/i,
  perMeter: /^(-?[\d.,]+)\s*kg\/m$/i,
  kilos: /^(-?[\d.,]+)\s*kg$/i,
  count: /^([\d.,]+)\s*(adet|takım|takim|boy)$/i,
  centimeters: /^([\d.,]+)\s*cm$/i,
  code: /^(?:[A-ZÇĞİÖŞÜ]{1,3}-)?\d{2,6}[A-Z]?$/,
};

// \b does not know Turkish letters ("Boyalı" ends in ı), so word edges are Unicode letters.
const word = (w: string) => new RegExp(`(?<!\\p{L})(?:${w})(?!\\p{L})`, 'iu');
const STATE_WORDS: Array<[RegExp, ProcessedState]> = [
  [word('boyasız'), 'boyasiz'],
  [word('boyalı'), 'boyali'],
  [word('hazır'), 'hazir'],
  [word('delikli|delik'), 'delikli'],
  [word('galvanizli'), 'galvanizli'],
];

/** "40x60 / 7016 Mat" → size 40x60, colour "7016 Mat"; "40x60 / Boyasız" → unpainted, no colour. */
export function splitMaterial(name: string): { size: string | null; color: string | null; states: ProcessedState[] } {
  // Turkish case: "BOYASIZ" lowers to "boyasız" only with the Turkish locale.
  const lower = name.toLocaleLowerCase('tr-TR');
  const states = STATE_WORDS.filter(([re]) => re.test(lower)).map(([, s]) => s);
  const slash = name.split('/').map((s) => s.trim());
  const sizeMatch = /\b(\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?)\b/i.exec(slash[0]);
  let color: string | null = null;
  if (slash.length === 2 && slash[1] && slash[1].toLocaleLowerCase('tr-TR') !== 'boyasız') color = slash[1];
  return { size: sizeMatch ? sizeMatch[1] : null, color, states: [...new Set(states)] };
}

type Column = { name: string; x: number };
type Table = { section: string; columns: Column[]; from: number; to: number; profileTable: boolean };

function groupLines(items: TextItem[]) {
  const lines: Array<{ page: number; y: number; items: TextItem[] }> = [];
  const sorted = [...items].filter((i) => i.text.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  for (const item of sorted) {
    const line = lines.find((l) => l.page === item.page && Math.abs(l.y - item.y) <= LINE_TOLERANCE);
    if (line) line.items.push({ ...item, text: item.text.trim() });
    else lines.push({ page: item.page, y: item.y, items: [{ ...item, text: item.text.trim() }] });
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

// Headings are upper-case words without figures; an all-caps data row ("KAPAK | 10 ADET") has a figure.
const isHeading = (text: string) => text.length > 2 && text === text.toLocaleUpperCase('tr-TR') && /[A-ZÇĞİÖŞÜ]/.test(text) && !/\d/.test(text) && !HEADER_WORDS.has(text);
/** Page furniture: page number, print date, document title. */
const isFurniture = (text: string) => /^Sayfa \d+\/\d+$/.test(text) || /^\d{2}\.\d{2}\.\d{4}$/.test(text) || /^MALZEME SAYIM L[İI]STES[İI]$/i.test(text);

/** Splits a header line into one or two side-by-side tables (a second "Malzeme" starts the right one). */
function tablesFromHeader(line: { items: TextItem[] }, headings: Array<{ x: number; text: string }>, fallback: string): Table[] {
  const columns = line.items.map((i) => ({ name: i.text, x: i.x }));
  const secondMaterial = columns.findIndex((c, index) => c.name === 'Malzeme' && columns.slice(0, index).some((p) => p.name === 'Malzeme'));
  const sectionAt = (x: number) => [...headings].filter((h) => h.x <= x + 5).sort((a, b) => b.x - a.x)[0]?.text ?? fallback;
  const make = (cols: Column[], from: number, to: number): Table => ({
    section: sectionAt(cols[0].x),
    columns: cols,
    from,
    to,
    profileTable: cols.some((c) => c.name === 'Gramaj'),
  });
  if (secondMaterial < 0) return [make(columns, -Infinity, Infinity)];
  const left = columns.slice(0, secondMaterial), right = columns.slice(secondMaterial);
  // Right-hand rows start left of their centred header; split just after the left table's last column.
  const boundary = left[left.length - 1].x + 40;
  return [make(left, -Infinity, boundary), make(right, boundary, Infinity)];
}

function nearest(columns: Column[], x: number, names: string[]) {
  return columns.filter((c) => names.includes(c.name)).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0]?.name ?? null;
}

function parseRow(table: Table, items: TextItem[], ref: string, page: number): CountRow {
  const row: CountRow = {
    ref, page, section: table.section, code: null, name: '', size: null, color: null, states: [], quantity: null, unit: null,
    pieceLengthMm: null, weightPerMeterKg: null, weightKg: null, detail: null, issues: [], unplaced: [],
  };
  const kod = table.columns.find((c) => c.name === 'Kod');
  const names: string[] = [];
  for (const item of items) {
    const t = item.text;
    let m: RegExpExecArray | null;
    if (kod && Math.abs(item.x - kod.x) <= 15 && RE.code.test(t) && row.code === null) row.code = t;
    else if ((m = RE.perMeter.exec(t))) row.weightPerMeterKg = trNumber(m[1]);
    else if ((m = RE.kilos.exec(t))) row.weightKg = trNumber(m[1]);
    else if ((m = RE.count.exec(t))) {
      row.quantity = trNumber(m[1]);
      const u = m[2].toLocaleLowerCase('tr-TR');
      row.unit = u === 'takım' || u === 'takim' ? 'takim' : (u as CountUnit);
    } else if ((m = RE.meters.exec(t)) || (m = RE.centimeters.exec(t))) {
      const isCm = RE.centimeters.test(t);
      // A length under the size/detail column is the piece length; under Boy/Miktar it is the counted total.
      const column = nearest(table.columns, item.x, ['Boy', 'Miktar', 'Ölçü', 'Detay']);
      const value = trNumber(m[1]);
      if (isCm || column === 'Ölçü' || column === 'Detay') row.pieceLengthMm = value === null ? null : Math.round(value * (isCm ? 10 : 1000));
      else {
        row.quantity = value;
        row.unit = 'm';
      }
    } else if (nearest(table.columns, item.x, ['Malzeme', 'Detay', 'Ölçü']) === 'Detay' && names.length) row.detail = t;
    else if (/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(t) || /\d+x\d+/i.test(t)) names.push(t);
    else row.unplaced.push(t);
  }
  row.name = names.join(' ');
  const parts = splitMaterial(row.name);
  row.size = parts.size;
  row.color = parts.color;
  row.states = parts.states;
  if (row.detail) {
    const cm = /(\d+(?:,\d+)?)\s*cm/i.exec(row.detail);
    if (cm && /delik/i.test(row.detail) && !row.states.includes('delikli')) row.states.push('delikli');
    if (cm && row.pieceLengthMm === null && !/delik/i.test(row.detail)) row.pieceLengthMm = Math.round((trNumber(cm[1]) ?? 0) * 10) || null;
  }
  // Keep stored text within bounds; an odd value becomes a stated doubt, never a rejected upload.
  if (row.pieceLengthMm !== null && row.pieceLengthMm <= 0) {
    row.pieceLengthMm = null;
    row.issues.push('Parça boyu sıfır veya negatif');
  }
  if (row.name.length > 300) {
    row.name = row.name.slice(0, 300);
    row.issues.push('Malzeme adı çok uzun; kısaltıldı');
  }
  row.unplaced = row.unplaced.slice(0, 20).map((t) => t.slice(0, 300));
  if (row.detail) row.detail = row.detail.slice(0, 300);
  validate(row, table);
  row.issues = row.issues.slice(0, 20).map((t) => t.slice(0, 500));
  return row;
}

function validate(row: CountRow, table: Table) {
  const issue = (text: string) => row.issues.push(text);
  if (!row.name) issue('Malzeme adı okunamadı');
  if (row.quantity === null || row.unit === null) issue('Miktar veya birim okunamadı');
  else if (row.quantity <= 0) issue('Miktar sıfır veya negatif');
  if (row.unplaced.length) issue(`Yerleştirilemeyen metin: ${row.unplaced.join(' ')}`);
  // A metre row in a profile table is a profile: it needs its code and a weight that adds up.
  // Counted pieces (adet/takım) in the same table are accessories and need neither.
  if (table.profileTable && row.unit === 'm') {
    if (!row.code) issue('Profil kodu yok');
    if (row.weightPerMeterKg === null) issue('Gramaj (kg/m) yok; ağırlık doğrulanamadı');
    else if (row.weightKg === null) issue('Ağırlık yok; gramaj doğrulanamadı');
    else if (row.quantity !== null) {
      const expected = row.quantity * row.weightPerMeterKg;
      if (Math.abs(expected - row.weightKg) > WEIGHT_TOLERANCE(expected))
        issue(`Gramaj tutarsız: ${row.quantity} m × ${row.weightPerMeterKg} kg/m = ${expected.toFixed(2)} kg, yazılan ${row.weightKg} kg`);
    }
  }
  if (row.weightPerMeterKg !== null && row.unit !== 'm') issue('Gramaj var ama miktar metre değil');
  if (row.unit === 'boy' && row.pieceLengthMm === null) issue('Adet "boy" ama profil boyu yazmıyor');
}

/** Reads every table of the count list. Lines outside a table (title, page numbers) are skipped. */
export function parseCountDocument(items: TextItem[]): CountDocument {
  const lines = groupLines(items);
  const pages = Math.max(0, ...items.map((i) => i.page));
  const title = lines.find((l) => l.items.some((i) => /SAYIM/i.test(i.text)))?.items.find((i) => /SAYIM/i.test(i.text))?.text ?? null;
  const date = items.map((i) => /^\d{2}\.\d{2}\.\d{4}$/.exec(i.text.trim())?.[0]).find(Boolean) ?? null;
  const rows: CountRow[] = [];
  let headings: Array<{ x: number; text: string }> = [];
  let tables: Table[] = [];
  // A table continues onto the next page until a new heading or header line; only lines that are
  // nothing but page furniture are skipped, so a data row with a date in it is still read.
  for (const [index, line] of lines.entries()) {
    const texts = line.items.map((i) => i.text);
    if (texts.every(isFurniture)) continue;
    if (texts.length >= 2 && texts.every((t) => HEADER_WORDS.has(t))) {
      tables = tablesFromHeader(line, headings, headings[0]?.text ?? 'Bölümsüz');
      continue;
    }
    if (line.items.every((i) => isHeading(i.text))) {
      // A new heading closes the previous table; a heading line may name two side-by-side sections.
      const fresh = line.items.map((i) => ({ x: i.x, text: i.text }));
      const nested = line.items.length === 1 && headings.length === 1 && tables.length === 0;
      headings = nested ? [{ x: headings[0].x, text: `${headings[0].text} / ${fresh[0].text}` }] : fresh;
      tables = [];
      continue;
    }
    if (!tables.length) continue;
    for (const [side, table] of tables.entries()) {
      const own = line.items.filter((i) => i.x >= table.from && i.x < table.to);
      if (!own.length) continue;
      rows.push(parseRow(table, own, `${line.page}-${index}-${side}`, line.page));
    }
  }
  // The same item twice in one count is not added up silently.
  const seen = new Map<string, CountRow>();
  for (const row of rows) {
    const key = [row.section, row.code ?? '', row.name.toLocaleLowerCase('tr-TR'), row.pieceLengthMm ?? '', row.detail ?? ''].join('|');
    const first = seen.get(key);
    if (first) {
      row.issues.push('Aynı kalem listede iki kez geçiyor');
      if (!first.issues.includes('Aynı kalem listede iki kez geçiyor')) first.issues.push('Aynı kalem listede iki kez geçiyor');
    } else seen.set(key, row);
  }
  return { title, date, rows, pages };
}
