/**
 * CSV for people opening exports in a spreadsheet. User text is never an executable formula.
 * Numeric values stay numeric (including negative amounts); delimiters/quotes/newlines stay in
 * one cell. The leading apostrophe on unsafe text is intentional, so this is not a lossless backup
 * format. A spreadsheet re-saving CSV can change escaping; prefer typed XLSX for round trips.
 */
export function spreadsheetCsvCell(value: unknown, delimiter: ',' | ';' = ','): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const unsafe = typeof value !== 'number' && (/^[\s\u0000]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n\u0000]/.test(text));
  if (unsafe) text = `'${text}`;
  return unsafe || text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
