/**
 * Positioned content of an imalat föyü PDF, in viewport space: origin top-left, y grows downwards,
 * page rotation already applied. Produced on the server by pdf.server.ts; everything that reads it
 * (parse.ts, rules.ts) is pure so it can be tested on fixtures taken from real föys.
 */
export type FoyItem = {
  page: number;
  /** Baseline start of the text run. */
  x: number;
  y: number;
  /** Font size in points (length of the text matrix x axis). */
  size: number;
  /** Text direction in degrees: 0 upright, ±180 upside down, ±90 vertical. */
  angle: number;
  text: string;
};

/** A straight line of a drawn path, x1 y1 x2 y2. Only short ones are kept (check boxes, crosses). */
export type FoySegment = { page: number; s: [number, number, number, number] };

export type FoyLayout = {
  pageCount: number;
  items: FoyItem[];
  segments: FoySegment[];
  /** Pages that draw an image and carry almost no text: their content needs a vision model. */
  imagePages: number[];
};

export const isUpright = (i: FoyItem) => Math.abs(i.angle) < 30;
export const isFlipped = (i: FoyItem) => Math.abs(Math.abs(i.angle) - 180) < 30;
export const isVertical = (i: FoyItem) => Math.abs(Math.abs(i.angle) - 90) < 30;

/** Turkish-aware upper case without diacritic games: "Işık" → "IŞIK", "kumaş" → "KUMAŞ". */
export const upper = (s: string) => s.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();

/** "390,5 cm" → 390.5, "1.381,1" → 1381.1, "446.7" → 446.7. */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/cm|mm|adet|kg/gi, '').replace(/\s+/g, '').trim();
  if (!/^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?$|^\d+(?:[.,]\d+)?$/.test(s)) return null;
  // A comma is always the decimal mark on these sheets; a dot is a decimal mark unless it groups thousands.
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

/** "Krem hasır" style casing for values written in capitals on the sheet. */
export function titleCase(s: string) {
  return s
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^\d/.test(w) ? w.toLocaleUpperCase('tr-TR') : w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1)))
    .join(' ');
}
