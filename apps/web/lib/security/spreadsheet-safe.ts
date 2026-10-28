/**
 * CSV / spreadsheet formula injection (audit S-07). A spreadsheet program runs a cell that starts
 * with = + - @ (and, in some programs, tab or CR) as a formula. Text written by users that goes
 * into a CSV meant to be opened by people gets a leading apostrophe, which spreadsheets show as
 * plain text. Real numbers are left alone: "-12.5" stays a negative number.
 *
 * Pure and client-safe: used by server exports and by browser downloads alike. Machine-readable,
 * byte-exact copies (the firm export's raw/ folder) must not use it.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
/** A plain decimal number as databases and JavaScript print it: -12.5, 3, 1e-7, -0.25. */
const PLAIN_NUMBER = /^-?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$/;

/** True when a spreadsheet could treat this text as a formula. */
export function looksLikeFormula(text: string): boolean {
  return FORMULA_START.test(text) && !PLAIN_NUMBER.test(text);
}

/** The text a spreadsheet shows as written: a leading apostrophe on formula-like text only. */
export function neutralizeFormula(text: string): string {
  return looksLikeFormula(text) ? `'${text}` : text;
}

/** One value as spreadsheet-safe text; numbers, booleans and dates are never prefixed. */
export function spreadsheetText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return neutralizeFormula(text);
}

/**
 * Reverses neutralizeFormula for files that come back in (a template downloaded, filled and
 * uploaded without a spreadsheet program in between). Only an apostrophe in front of formula-like
 * text is removed.
 */
export function restoreNeutralized(text: string): string {
  return text.startsWith("'") && looksLikeFormula(text.slice(1)) ? text.slice(1) : text;
}
