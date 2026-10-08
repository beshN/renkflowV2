/** Reads a CSV the way spreadsheet programs in Turkey save it: ";" or "," separated, quoted cells, a BOM. */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((v) => v.trim()));
}

/** Writes rows with ";" (what Excel in Turkish locale opens directly), quoting where needed, with a BOM. */
export function toCsv(rows: Array<Array<string | number>>) {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/**
 * A number as people type it: "1.250,50" or "1250,5" (comma decimal) or "1250.5". A dot followed by
 * groups of three digits is a thousands separator ("1.250" is 1250). Anything else is null.
 */
export function readNumber(raw: string): number | null {
  const s = raw.replace(/\s/g, '');
  if (!s) return null;
  let normal: string;
  if (s.includes(',')) {
    if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(s)) return null;
    normal = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) normal = s.replace(/\./g, '');
  else if (/^-?\d+(\.\d+)?$/.test(s)) normal = s;
  else return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}
