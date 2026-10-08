import { normalizeStates, STATE_LABELS, type ProcessedState } from '@/lib/features/inventory/vocabulary';
import type { CountRow } from './parse';

/** A painted colour implies the painted state, unless the row says unpainted. */
export function rowStates(row: Pick<CountRow, 'states' | 'color'>): ProcessedState[] {
  const states = [...row.states];
  if (row.color && !states.includes('boyasiz') && !states.includes('boyali')) states.push('boyali');
  return normalizeStates(states);
}

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };
const slug = (text: string) =>
  text.replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR[c]).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Card name and stock code for a counted row: the colour belongs to the bars, not the card. */
export function itemIdentity(row: Pick<CountRow, 'code' | 'name' | 'states' | 'color' | 'pieceLengthMm'>) {
  const states = rowStates(row);
  const base = row.name.split('/')[0].trim();
  // A state the name already says ("Galvanizli Boru", "Hazır Makas") is not written twice.
  const said = base.toLocaleLowerCase('tr-TR');
  const extra = states.filter((s) => !said.includes(STATE_LABELS[s].toLocaleLowerCase('tr-TR')) && !(s === 'delikli' && said.includes('delik')));
  const stateText = extra.map((s) => STATE_LABELS[s]).join(' ');
  const name = [row.code && !base.startsWith(row.code) ? row.code : null, base, stateText || null, row.pieceLengthMm ? `${row.pieceLengthMm / 10} cm` : null]
    .filter(Boolean)
    .join(' ');
  const sku = [row.code ? slug(row.code) : null, slug(base), ...extra.map(slug), row.pieceLengthMm ? String(row.pieceLengthMm) : null]
    .filter(Boolean)
    .join('-')
    .slice(0, 80);
  return { name: name.slice(0, 180), sku, states };
}

