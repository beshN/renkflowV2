import { parseCsvRecords } from '@/lib/features/products/csv';
import { foldText } from '@/lib/shared/text/fold';

export const csvRecords = (text: string) => parseCsvRecords(text).filter((r) => r.cells.some((c) => c.trim()));
const key = (header: string) => foldText(header).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Which file column feeds which field; exact names first, then prefixes ("Telefon (iş)"). */
export function mapColumns<F extends string>(header: string[], HEADERS: Record<F, string[]>) {
  const keys = header.map(key);
  const used = new Set<number>();
  const map: Partial<Record<F, number>> = {};
  for (const exact of [true, false]) {
    for (const field of Object.keys(HEADERS) as (F)[]) {
      if (map[field] !== undefined) continue;
      const at = keys.findIndex((k, i) => !used.has(i) && HEADERS[field].some((name) => (exact ? k === name : k.startsWith(name) && name.length >= 3)));
      if (at !== -1) { map[field] = at; used.add(at); }
    }
  }
  return { map, ignored: header.filter((h, i) => h.trim() && !used.has(i)) };
}

export type ImportOutcome = 'new' | 'exists' | 'fill' | 'name_match' | 'error';
export type ImportResultRow = { line: number; name: string; outcome: ImportOutcome; matchedId?: string; filled?: string[]; errors?: string[] };
export function summarizeImport(results: ImportResultRow[]) {
  return { new: results.filter(r => r.outcome === 'new').length, exists: results.filter(r => r.outcome === 'exists').length, filled: results.filter(r => r.outcome === 'fill').length, nameMatches: results.filter(r => r.outcome === 'name_match').length, errors: results.filter(r => r.outcome === 'error').length };
}
