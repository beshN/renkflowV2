// Bank statement files → statement lines. Pure (runs in the browser for the preview and on the
// server in tests). Formats:
//   - CSV/TSV as Turkish banks export it: ';' or ',' or tab, "1.234,56" or "1,234.56", dd.mm.yyyy,
//     one signed "Tutar" column or separate "Borç"/"Alacak" columns, extra title rows above the header;
//   - SWIFT MT940 (:61: statement line + :86: information);
//   - OFX/QFX (SGML or XML).
// Each line gets a stable externalId (the bank's id when there is one, otherwise a hash of its
// content and position among identical lines), so importing the same file twice adds nothing.

export type StatementLine = { statementDate: string; description: string; amount: number; reference: string | null; externalId: string };
export type ParsedStatement = { format: 'csv' | 'mt940' | 'ofx'; lines: StatementLine[]; warnings: string[]; accountRef: string | null };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** FNV-1a, enough to tell rows apart without a crypto dependency in the browser. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Ids for rows without a bank id: identical rows (two equal transfers on a day) get #2, #3… */
function withContentIds(lines: Omit<StatementLine, 'externalId'>[], prefix: string): StatementLine[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const key = `${l.statementDate}|${l.amount.toFixed(2)}|${l.description}|${l.reference ?? ''}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { ...l, externalId: `${prefix}:${hash(key)}:${n}` };
  });
}

/** "1.234,56" / "1,234.56" / "-1234.5" / "1234,5-" / "(12,00)" → number. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/\s|TL|TRY|₺/gi, '').trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && lastComma !== -1) s = s.replace(/,/g, '');
  else if (lastComma === -1 && (s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return round2(negative ? -n : n);
}

/** dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy (optionally with a time), yyyy-mm-dd → yyyy-mm-dd. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), m[3]];
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

// --- CSV -----------------------------------------------------------------------------------------

const fold = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');
const COLUMNS = {
  date: ['tarih', 'islemtarihi', 'valortarihi', 'date', 'islemtarih'],
  description: ['aciklama', 'islemaciklamasi', 'description', 'detay', 'islem'],
  amount: ['tutar', 'islemtutari', 'amount', 'miktar'],
  debit: ['borc', 'cikan', 'giden', 'debit'],
  credit: ['alacak', 'giren', 'gelen', 'credit'],
  reference: ['dekontno', 'referans', 'referansno', 'fisno', 'islemno', 'reference', 'ref'],
};

function splitRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (ch === sep && !quoted) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function findColumn(header: string[], names: string[]): number {
  const folded = header.map(fold);
  for (const name of names) {
    const exact = folded.indexOf(name);
    if (exact !== -1) return exact;
  }
  return folded.findIndex((h) => names.some((n) => h.startsWith(n)));
}

function parseCsv(text: string): ParsedStatement {
  // Blank rows stay in the list so warnings name the line as it is in the file.
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const warnings: string[] = [];
  // Banks put title rows (account, period) above the header: take the first row that names a date and an amount.
  let headerIndex = -1;
  let sep = ';';
  for (let i = 0; i < Math.min(rows.length, 30) && headerIndex === -1; i++) {
    if (!rows[i].trim()) continue;
    for (const candidate of [';', '\t', ',']) {
      const cells = splitRow(rows[i], candidate);
      if (cells.length >= 3 && findColumn(cells, COLUMNS.date) !== -1 && (findColumn(cells, COLUMNS.amount) !== -1 || findColumn(cells, COLUMNS.credit) !== -1)) {
        headerIndex = i;
        sep = candidate;
        break;
      }
    }
  }
  if (headerIndex === -1) throw new Error('Başlık satırı bulunamadı: "Tarih" ve "Tutar" (ya da "Borç"/"Alacak") sütunları olmalı');
  const header = splitRow(rows[headerIndex], sep);
  const col = {
    date: findColumn(header, COLUMNS.date),
    description: findColumn(header, COLUMNS.description),
    amount: findColumn(header, COLUMNS.amount),
    debit: findColumn(header, COLUMNS.debit),
    credit: findColumn(header, COLUMNS.credit),
    reference: findColumn(header, COLUMNS.reference),
  };
  const lines: Omit<StatementLine, 'externalId'>[] = [];
  rows.slice(headerIndex + 1).forEach((row, i) => {
    if (!row.trim()) return;
    const cells = splitRow(row, sep);
    const date = parseDate(cells[col.date] ?? '');
    if (!date) {
      if (cells.some((c) => c)) warnings.push(`Satır ${headerIndex + i + 2}: tarih okunamadı, atlandı`);
      return;
    }
    let amount: number | null;
    if (col.amount !== -1 && (col.debit === -1 || col.credit === -1)) amount = parseAmount(cells[col.amount] ?? '');
    else amount = round2((parseAmount(cells[col.credit] ?? '') ?? 0) - Math.abs(parseAmount(cells[col.debit] ?? '') ?? 0));
    if (amount === null || Math.abs(amount) < 0.01) {
      warnings.push(`Satır ${headerIndex + i + 2}: tutar okunamadı ya da 0, atlandı`);
      return;
    }
    const description = (col.description !== -1 ? cells[col.description] : '') || 'Banka hareketi';
    lines.push({ statementDate: date, description: description.slice(0, 500), amount, reference: col.reference !== -1 ? cells[col.reference] || null : null });
  });
  return { format: 'csv', lines: withContentIds(lines, 'csv'), warnings, accountRef: null };
}

// --- MT940 ---------------------------------------------------------------------------------------

function parseMt940(text: string): ParsedStatement {
  const warnings: string[] = [];
  const accountRef = /:25:([^\r\n]+)/.exec(text)?.[1]?.trim() ?? null;
  const lines: Omit<StatementLine, 'externalId'>[] = [];
  const bankIds: (string | null)[] = [];
  // Each :61: is followed (optionally) by :86: until the next tag.
  const tags = [...text.matchAll(/:(61|86):([\s\S]*?)(?=\r?\n:\d{2}[A-Z]?:|\r?\n-\}|$)/g)];
  for (let i = 0; i < tags.length; i++) {
    if (tags[i][1] !== '61') continue;
    const body = tags[i][2].replace(/\r?\n/g, '');
    // YYMMDD [MMDD] [R]C|D [funds code] amount N|F type code reference [//bank ref]
    const m = /^(\d{2})(\d{2})(\d{2})(\d{4})?(R?[CD])([A-Z])?(\d+,\d{0,2})[NF][A-Z0-9]{3}([^/]*)(?:\/\/([^\s]*))?/.exec(body);
    if (!m) { warnings.push(`:61: satırı okunamadı: ${body.slice(0, 40)}`); continue; }
    const year = 2000 + Number(m[1]);
    const date = `${year}-${m[2]}-${m[3]}`;
    const value = Number(m[7].replace(',', '.'));
    const sign = m[5] === 'D' || m[5] === 'RC' ? -1 : 1;
    const info = tags[i + 1]?.[1] === '86' ? tags[i + 1][2].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const customerRef = m[8]?.trim() || null;
    lines.push({ statementDate: date, description: (info || customerRef || 'Banka hareketi').slice(0, 500), amount: round2(sign * value), reference: customerRef && customerRef !== 'NONREF' ? customerRef : null });
    bankIds.push(m[9]?.trim() || null);
  }
  const ids = withContentIds(lines, 'mt940');
  return { format: 'mt940', lines: ids.map((l, i) => (bankIds[i] ? { ...l, externalId: `mt940:${bankIds[i]}` } : l)), warnings, accountRef };
}

// --- OFX -----------------------------------------------------------------------------------------

function ofxTag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block);
  return m ? m[1].trim() : null;
}

function parseOfx(text: string): ParsedStatement {
  const warnings: string[] = [];
  const accountRef = ofxTag(text, 'ACCTID');
  const lines: StatementLine[] = [];
  const unnamed: Omit<StatementLine, 'externalId'>[] = [];
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const posted = ofxTag(block, 'DTPOSTED');
    const amount = parseAmount(ofxTag(block, 'TRNAMT') ?? '');
    if (!posted || !/^\d{8}/.test(posted) || amount === null) { warnings.push('Bir OFX hareketi okunamadı, atlandı'); continue; }
    const date = `${posted.slice(0, 4)}-${posted.slice(4, 6)}-${posted.slice(6, 8)}`;
    const description = [ofxTag(block, 'NAME'), ofxTag(block, 'MEMO')].filter(Boolean).join(' · ') || 'Banka hareketi';
    const reference = ofxTag(block, 'CHECKNUM') || ofxTag(block, 'REFNUM');
    const fitid = ofxTag(block, 'FITID');
    const line = { statementDate: date, description: description.slice(0, 500), amount, reference };
    if (fitid) lines.push({ ...line, externalId: `ofx:${fitid}` });
    else unnamed.push(line);
  }
  return { format: 'ofx', lines: [...lines, ...withContentIds(unnamed, 'ofx')], warnings, accountRef };
}

export function detectFormat(text: string): ParsedStatement['format'] {
  if (/<OFX>|OFXHEADER/i.test(text)) return 'ofx';
  if (/^:20:|\n:20:|\{4:/.test(text) && /:61:/.test(text)) return 'mt940';
  return 'csv';
}

export function parseBankStatement(text: string): ParsedStatement {
  const format = detectFormat(text);
  const parsed = format === 'ofx' ? parseOfx(text) : format === 'mt940' ? parseMt940(text) : parseCsv(text);
  if (!parsed.lines.length) throw new Error('Dosyada okunabilen banka hareketi yok');
  return parsed;
}
