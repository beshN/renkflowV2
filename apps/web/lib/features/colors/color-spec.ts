/**
 * One colour model for the whole panel: every RAL Classic colour, the non-RAL finishes a profile
 * shop sells (raw aluminium, anodised, wood grain) and a free "custom colour". Colours are still
 * stored as one text field; this module reads that text, writes it in one canonical spelling
 * ("RAL 7016 Mat") and compares two texts the same way everywhere (catalogue, stock matching,
 * cutting engine), so records written before the RAL list ("7016 MAT", "7016  mat") still match.
 *
 * No server-only imports: the picker, the previews and the services all use it.
 */
import { RAL_CLASSIC_ROWS, type RalNote } from './ral-classic';

export type { RalNote } from './ral-classic';

export const RAL_GROUPS = [
  { key: 'sari', label: 'Sarı', digit: '1' },
  { key: 'turuncu', label: 'Turuncu', digit: '2' },
  { key: 'kirmizi', label: 'Kırmızı', digit: '3' },
  { key: 'mor', label: 'Mor', digit: '4' },
  { key: 'mavi', label: 'Mavi', digit: '5' },
  { key: 'yesil', label: 'Yeşil', digit: '6' },
  { key: 'gri', label: 'Gri', digit: '7' },
  { key: 'kahverengi', label: 'Kahverengi', digit: '8' },
  { key: 'beyaz-siyah', label: 'Beyaz / siyah', digit: '9' },
] as const;
export type RalGroup = (typeof RAL_GROUPS)[number]['key'];

export type RalColor = { code: string; name: string; nameEn: string; nameDe: string; hex: string; group: RalGroup; note?: RalNote };

const groupOf = (code: string) => RAL_GROUPS.find((g) => g.digit === code[0])!.key;
export const RAL_CLASSIC: readonly RalColor[] = RAL_CLASSIC_ROWS.map(([code, name, nameEn, nameDe, hex, note]) => ({
  code, name, nameEn, nameDe, hex, group: groupOf(code), ...(note ? { note } : {}),
}));
const BY_CODE = new Map(RAL_CLASSIC.map((c) => [c.code, c]));
export const ralByCode = (code: string) => BY_CODE.get(code);

/** Paint finish, chosen apart from the colour. Mat is the firm's default. */
export const FINISHES = ['Mat', 'Parlak', 'İnce doku', 'Kum'] as const;
export type Finish = (typeof FINISHES)[number];
export const DEFAULT_FINISH: Finish = 'Mat';

export const ANODIZED = { natural: 'Eloksal natürel', black: 'Eloksal siyah' } as const;
export const RAW_LABEL = 'Boyasız';

export type ColorSpec =
  | { kind: 'ral'; code: string; finish: Finish; finishAssumed: boolean }
  | { kind: 'raw' }
  | { kind: 'anodized'; tone: keyof typeof ANODIZED }
  | { kind: 'wood'; name: string }
  | { kind: 'custom'; name: string; finish: Finish | null; hex: string | null }
  /** Anything else, typically a name written before the RAL list ("Kahverengi"). Kept as written. */
  | { kind: 'text'; text: string };

// NFC first: text pasted from macOS/iOS may carry "ş" as s + combining cedilla.
const tidy = (text: string) => text.normalize('NFC').trim().replace(/\s+/g, ' ');
/**
 * Lower case, Turkish I/ı folded, accents dropped ("Boyasız" = "boyasiz", "Natürel" = "naturel"),
 * single spaces: what people type on a phone without a Turkish keyboard is the same name.
 */
export const fold = (text: string) =>
  tidy(text).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

const FINISH_WORDS: Array<[RegExp, Finish]> = [
  [/^(mat|matt)$/, 'Mat'],
  [/^parlak$/, 'Parlak'],
  [/^ince[ -]?doku(lu)?$/, 'İnce doku'],
  [/^kum( doku(lu)?)?$|^kumlu$/, 'Kum'],
];
const finishOf = (folded: string): Finish | null => FINISH_WORDS.find(([re]) => re.test(folded))?.[1] ?? null;
const HEX = /^#[0-9a-f]{6}$/i;

/** Reads a stored colour text. Never throws: what it cannot read stays text, as written. */
export function parseColor(input: string | null | undefined): ColorSpec {
  const text = tidy(input ?? '');
  const f = fold(text);
  // "RAL 7016 Mat", "ral7016 mat", "RAL-7016", "7016 MAT", "7016": a known RAL Classic code,
  // optionally followed by a finish. Without a finish the firm default (Mat) is assumed.
  const ral = /^(?:ral\s*[-.]?\s*)?(\d{4})(?:\s*[-,/]?\s*(.+))?$/.exec(f);
  if (ral && BY_CODE.has(ral[1])) {
    if (!ral[2]) return { kind: 'ral', code: ral[1], finish: DEFAULT_FINISH, finishAssumed: true };
    const finish = finishOf(ral[2]);
    if (finish) return { kind: 'ral', code: ral[1], finish, finishAssumed: false };
  }
  if (/^(boyasiz|ham|ham aluminyum|boyasiz aluminyum|boyasiz \(ham aluminyum\))$/.test(f)) return { kind: 'raw' };
  const anod = /^eloksal (naturel|siyah)$|^(naturel|siyah) eloksal$/.exec(f);
  if (anod) return { kind: 'anodized', tone: (anod[1] ?? anod[2]) === 'siyah' ? 'black' : 'natural' };
  // "Ahşap desen: Ceviz" or "Ahşap desen Ceviz"; "Ahşap desenli …" is someone's own name, kept as text.
  if (/^ahsap desen(\s*:|\s|$)/.test(f)) {
    const name = /^ah[sş]ap desen\s*:?\s*(.*)$/iu.exec(text)?.[1] ?? '';
    return { kind: 'wood', name: tidy(name) };
  }
  if (/^ozel renk\s*:/.test(f)) {
    const body = tidy(text.slice(text.indexOf(':') + 1));
    const m = /^(.*?)\s*\(([^()]*)\)$/.exec(body);
    let name = body;
    let finish: Finish | null = null;
    let hex: string | null = null;
    if (m) {
      const parts = m[2].split(',').map((p) => p.trim()).filter(Boolean);
      // Only "(Mat, #A1B2C3)"-style tails are ours; any other bracket belongs to the name.
      if (parts.length && parts.every((p) => HEX.test(p) || finishOf(fold(p)))) {
        name = m[1];
        for (const p of parts) {
          if (HEX.test(p)) hex = p.toUpperCase();
          else finish = finishOf(fold(p));
        }
      }
    }
    if (name) return { kind: 'custom', name, finish, hex };
  }
  return { kind: 'text', text };
}

/** The one spelling a colour is stored and shown in. */
export function formatColor(spec: ColorSpec): string {
  switch (spec.kind) {
    // A record that never said its finish keeps saying so ("RAL 1013"); it still compares as Mat.
    case 'ral': return spec.finishAssumed ? `RAL ${spec.code}` : `RAL ${spec.code} ${spec.finish}`;
    case 'raw': return RAW_LABEL;
    case 'anodized': return ANODIZED[spec.tone];
    case 'wood': return spec.name ? `Ahşap desen: ${spec.name}` : 'Ahşap desen';
    case 'custom': {
      const tail = [spec.finish, spec.hex].filter(Boolean).join(', ');
      return `Özel renk: ${spec.name}${tail ? ` (${tail})` : ''}`;
    }
    case 'text': return spec.text;
  }
}
export const canonicalColor = (text: string) => formatColor(parseColor(text));

/**
 * The comparison key: two texts are the same colour when their keys are equal. "RAL 7016 Mat",
 * "7016 MAT" and "7016" are one colour (no finish = Mat); "7016 Parlak" is another. Names that are
 * not RAL compare as folded text, as before.
 */
export function colorKey(text: string): string {
  const spec = parseColor(text);
  switch (spec.kind) {
    case 'ral': return `ral:${spec.code}:${fold(spec.finish)}`;
    case 'raw': return 'raw';
    case 'anodized': return `anodized:${spec.tone}`;
    case 'wood': return `wood:${fold(spec.name)}`;
    case 'custom': return `custom:${fold(spec.name)}:${fold(spec.finish ?? DEFAULT_FINISH)}`;
    case 'text': return `text:${fold(spec.text)}`;
  }
}
export const sameColor = (a: string, b: string) => colorKey(a) === colorKey(b);

/** The first of each colour, in order: "1013" and "1013 Mat" written before the RAL rule are one. */
export function uniqueColors(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = colorKey(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A bar must be the colour of every job cut from it. True when any job's colour (as recorded on
 * the job) is another colour than the bar's: the cut list and the factory show a warning.
 */
export function barColorMismatch(barColor: string | null | undefined, jobColors: Array<string | null | undefined>): boolean {
  const bar = colorKey(barColor ?? '');
  return jobColors.some((c) => typeof c === 'string' && c.trim() !== '' && colorKey(c) !== bar);
}

/**
 * Display tones for colours that have no RAL hex. They only stand for the finish on screen
 * (a metallic grey, near black, a wood brown) and say so; they are not colour data.
 */
const STAND_IN = { raw: '#C4C7CA', natural: '#C4C7CA', black: '#2B2B2D', wood: '#8B5E3C' } as const;

export type ColorInfo = {
  /** Canonical text, e.g. "RAL 7016 Mat". */
  label: string;
  /** Short code shown large: "RAL 7016", "Boyasız", "Eloksal", "Ahşap", "Özel". */
  code: string;
  /** Turkish name ("Antrasit gri"), wood/custom name, or the text as written. */
  name: string;
  finish: Finish | null;
  /** True when the record did not say the finish and the default (Mat) is assumed. */
  finishAssumed: boolean;
  /** Screen colour, or null when there is none to show (unknown name, custom without hex). */
  hex: string | null;
  /** The hex only stands in for a finish (raw, anodised, wood); it is not a colour value. */
  standIn: boolean;
  note: RalNote | null;
  kind: ColorSpec['kind'];
};

/** Everything a screen needs to draw a colour: what workers see too (no prices, no customers). */
export function colorInfo(text: string | null | undefined): ColorInfo | null {
  if (!text || !tidy(text)) return null;
  const spec = parseColor(text);
  const base = { label: formatColor(spec), finish: null, finishAssumed: false, hex: null, standIn: false, note: null, kind: spec.kind } as const;
  switch (spec.kind) {
    case 'ral': {
      const ral = BY_CODE.get(spec.code)!;
      return { ...base, code: `RAL ${spec.code}`, name: ral.name, finish: spec.finish, finishAssumed: spec.finishAssumed, hex: ral.hex, note: ral.note ?? null };
    }
    case 'raw': return { ...base, code: RAW_LABEL, name: 'Ham alüminyum', hex: STAND_IN.raw, standIn: true };
    case 'anodized': return { ...base, code: 'Eloksal', name: spec.tone === 'black' ? 'Siyah' : 'Natürel', hex: STAND_IN[spec.tone], standIn: true };
    case 'wood': return { ...base, code: 'Ahşap desen', name: spec.name || 'Desen adı yazılmamış', hex: STAND_IN.wood, standIn: true };
    case 'custom': return { ...base, code: 'Özel renk', name: spec.name, finish: spec.finish, hex: spec.hex };
    case 'text': return { ...base, code: spec.text, name: spec.text };
  }
}

/** Black or white text on a colour, whichever reads better (WCAG contrast ratio). */
export function textOn(hex: string | null): '#111111' | '#FFFFFF' {
  if (!hex || !HEX.test(hex)) return '#111111';
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const black = (l + 0.05) / (0.0067 + 0.05); // #111111 luminance ≈ 0.0067
  const white = 1.05 / (l + 0.05);
  return black >= white ? '#111111' : '#FFFFFF';
}

/**
 * RAL search by code or name, in Turkish, English or German: "7016", "ral 70", "antrasit",
 * "anthracite", "kirmizi". Every word must match; codes match from their start.
 */
export function searchRal(query: string, group?: RalGroup | null): RalColor[] {
  const words = fold(query).replace(/^ral\s*/, '').split(' ').filter(Boolean);
  return RAL_CLASSIC.filter((c) => {
    if (group && c.group !== group) return false;
    if (!words.length) return true;
    const names = fold(`${c.name} ${c.nameEn} ${c.nameDe} ${RAL_GROUPS.find((g) => g.key === c.group)!.label}`);
    return words.every((w) => (/^\d+$/.test(w) ? c.code.startsWith(w) : names.includes(w)));
  });
}

/** Short note shown next to a colour preview. */
export const APPROXIMATE_NOTE = 'Ekran rengi yaklaşıktır, numune ile teyit edin.';
export const NOTE_TEXT: Record<RalNote, string> = {
  luminous: 'Fosforlu boya: ekranda gösterilemez.',
  effect: 'Sedef veya metalik efekt: karo efekti göstermez.',
  'sources-differ': 'Kaynaklar bu rengin ekran tonunda ayrışıyor.',
  'single-source': 'Yeni renk: ekran tonu tek kaynaktan.',
};
