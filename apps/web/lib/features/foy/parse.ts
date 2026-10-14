import { isFlipped, isUpright, isVertical, parseNumber, titleCase, upper, type FoyItem, type FoyLayout, type FoySegment } from './layout';
import { emptyFoy, type FoyCutRow, type FoyDoc, type FoyIronCut, type FoyOption, type FoyPartKind, type FoySystem, type FoyWindbreaker } from './types';

/**
 * Reads a Renk imalat föyü from its text layer and drawn lines, no model involved. Two templates
 * exist: the makaslı pergola sheet (AutoCAD export: header table with check boxes, notes, bay
 * schema, cut list, fabric/valance boxes, steel drawings on later pages) and the pistonlu rüzgâr
 * kırıcı sheet (Excel export, label/value table). Anything the layer does not hold stays null.
 */
export function parseFoy(layout: FoyLayout): FoyDoc {
  const all = layout.items.map((i) => ({ ...i, u: upper(i.text) }));
  const has = (re: RegExp) => all.some((i) => re.test(i.u));
  if (has(/RÜZGAR KIRICI|RÜZGÂR KIRICI/)) return parseWindbreaker(layout, all);
  if (has(/DIŞTAN DIŞA|İÇTEN İÇE/)) return parsePergola(layout, all);
  return { ...emptyFoy('unknown'), unreadPages: layout.imagePages };
}

type It = FoyItem & { u: string };

const isNum = (i: It) => parseNumber(i.text) !== null && !/ADET/.test(i.u);
const sameRow = (a: { y: number }, b: { y: number }, tol = 5) => Math.abs(a.y - b.y) <= tol;

function toIsoDate(raw: string): string | null {
  const m = raw.replace(/\s+/g, '').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Check boxes are drawn: a small square left of the label, crossed by two diagonals when ticked. */
export function boxChecked(label: Pick<FoyItem, 'page' | 'x' | 'y'>, segments: FoySegment[]): boolean | null {
  const near = segments.filter(({ page, s: [x1, y1, x2, y2] }) =>
    page === label.page && Math.min(x1, x2) >= label.x - 16 && Math.max(x1, x2) <= label.x - 1 && Math.min(y1, y2) >= label.y - 10 && Math.max(y1, y2) <= label.y + 4);
  if (near.length < 3) return null; // no box drawn there: unknown, not "unticked"
  const diagonals = near.filter(({ s: [x1, y1, x2, y2] }) => Math.abs(x1 - x2) > 1 && Math.abs(y1 - y2) > 1).length;
  return diagonals >= 2;
}

function partKind(profile: string): FoyPartKind {
  const p = upper(profile);
  if (/^DERE/.test(p)) return 'dere';
  if (/^BORU/.test(p)) return 'boru';
  if (/^KUMA[SŞ]/.test(p)) return 'kumas';
  if (/^SAC/.test(p)) return 'sac';
  // 40×60 is the LED profile on these sheets (Renk); bigger sections are steel.
  if (/^40\s*[*X×]\s*60$/.test(p)) return 'led';
  if (/^\d+\s*[*X×]\s*\d+$/.test(p)) return 'demir';
  return 'diger';
}

function parsePergola(layout: FoyLayout, all: It[]): FoyDoc {
  const doc = emptyFoy('pergola');
  const p1 = all.filter((i) => i.page === 1);

  // ── Header table (top band, labels in the left column of the table) ──
  const label = (re: RegExp) => p1.find((i) => i.y < 110 && re.test(i.u) && i.size <= 9);
  const valueRight = (l: It | undefined, tol = 5) => (l ? p1.filter((i) => i !== l && i.x > l.x + 40 && sameRow(i, l, tol) && i.y < 110).sort((a, b) => a.x - b.x) : []);
  const header = p1.filter((i) => i.y < 110 && i.x > 300);
  const dateItem = header.find((i) => toIsoDate(i.text));
  doc.date = dateItem ? toIsoDate(dateItem.text) : null;
  const flags = header.map((i) => i.u).join(' ');
  doc.assembly = /DEMONTE/.test(flags) ? 'demonte' : /MONTAJLI/.test(flags) ? 'montajli' : null;
  doc.crated = /SANDIKLI/.test(flags) ? true : null;
  const customer = valueRight(label(/^MÜŞTERİ$/), 4).find((i) => !toIsoDate(i.text));
  doc.customer = customer ? customer.text.trim() : null;
  const ralRow = valueRight(label(/^RAL$/), 4);
  const ral = ralRow.find((i) => /\d{4}/.test(i.u) && !/KUMA/.test(i.u));
  if (ral) {
    const m = ral.u.match(/(\d{4})\s*(.*)$/);
    doc.ral = m ? m[1] : null;
    doc.finish = m && m[2] ? titleCase(m[2]) : null;
  }
  const fabric = ralRow.find((i) => /KUMA[SŞ]/.test(i.u));
  // Kept as written: capital I on these sheets is ambiguous (ANTRASIT means "Antrasit", not "Antrasıt").
  doc.fabric = fabric ? fabric.text.replace(/^.*?KUMA[SŞ]\s*:?\s*/i, '').replace(/\s+/g, ' ').trim() || null : null;
  const addressLabel = label(/^ADRES$/);
  const address = addressLabel ? p1.filter((i) => i.x > addressLabel.x + 40 && Math.abs(i.y - addressLabel.y) <= 10).sort((a, b) => b.size - a.size)[0] : undefined;
  doc.address = address ? address.text.trim() : null;
  const options = (row: It | undefined): FoyOption[] => valueRight(row, 4).filter((i) => /^[A-ZÇĞİÖŞÜ ]+$/.test(i.u)).map((i) => ({ label: titleCase(i.text), checked: boxChecked(i, layout.segments) }));
  doc.series = options(label(/^SERİ$/));
  doc.lights = options(label(/^IŞIK$/));

  // ── Bay schema ──
  const rails = p1.filter((i) => /RAY DIŞTAN DIŞA/.test(i.u));
  const bayLabels = p1.filter((i) => /DEMİR İÇTEN İÇE|RAY İÇTEN İÇE/.test(i.u));
  const numbers = p1.filter((i) => isNum(i) && (isUpright(i) || isFlipped(i)));
  /** The figure written just "above" a dimension label, in the label's own reading direction. */
  const figureFor = (l: It): number | null => {
    const dir = isFlipped(l) ? 1 : -1; // viewport y of the figure relative to the label
    const lx = isFlipped(l) ? l.x - (l.text.length * l.size) / 2 : l.x + (l.text.length * l.size) / 2;
    const cands = numbers.filter((n) => (isFlipped(n) === isFlipped(l)) && (n.y - l.y) * dir > 4 && (n.y - l.y) * dir < 30);
    const best = cands.sort((a, b) => Math.abs(a.x - lx) - Math.abs(b.x - lx))[0];
    return best ? parseNumber(best.text) : null;
  };
  const systemOf = (l: It) => rails.reduce((bi, r, idx) => (Math.abs(r.y - l.y) < Math.abs(rails[bi].y - l.y) ? idx : bi), 0);
  const systems: FoySystem[] = rails.map((r) => ({ bays: [], railOuter: figureFor(r), projection: null, height: null }));
  if (!systems.length && bayLabels.length) systems.push({ bays: [], railOuter: null, projection: null, height: null });
  for (let s = 0; s < systems.length; s++) {
    const mine = bayLabels.filter((l) => (rails.length ? systemOf(l) === s : true));
    const irons = mine.filter((l) => /DEMİR/.test(l.u));
    const railsIn = mine.filter((l) => /RAY/.test(l.u));
    // Read left to right as drawn; an upside-down schema is read from its own left (viewport right).
    const order = (ls: It[]) => [...ls].sort((a, b) => (isFlipped(a) ? b.x - a.x : a.x - b.x));
    const ironVals = order(irons).map(figureFor);
    const railVals = order(railsIn).map(figureFor);
    const n = Math.max(ironVals.length, railVals.length);
    systems[s].bays = Array.from({ length: n }, (_, k) => ({ ironInner: ironVals[k] ?? null, railInner: railVals[k] ?? null }));
  }

  // ── Fabric / valance boxes: a big horizontal width with its vertical height just above it ──
  const fabricLabel = p1.find((i) => /KUMAŞ ÖLÇÜSÜ/.test(i.u));
  const valanceLabel = p1.find((i) => /SAÇAK ÖLÇÜSÜ/.test(i.u));
  const boxTop = fabricLabel ? fabricLabel.y : Infinity;
  const widths = p1.filter((i) => isNum(i) && isUpright(i) && i.size >= 20 && i.y > boxTop && i.x > (fabricLabel?.x ?? 0) - 40).sort((a, b) => a.y - b.y);
  const verticals = p1.filter((i) => isNum(i) && isVertical(i));
  const used = new Set<FoyItem>();
  const boxes = widths.map((w) => {
    const h = verticals.filter((v) => !used.has(v) && v.y <= w.y + 2 && v.y > w.y - 90).sort((a, b) => b.y - a.y)[0];
    if (h) used.add(h);
    return { width: parseNumber(w.text), height: h ? parseNumber(h.text) : null, y: w.y };
  });
  const valanceY = valanceLabel?.y ?? null;
  const fabricBox = boxes.find((b) => valanceY === null || b.y < valanceY) ?? null;
  const valanceBox = boxes.find((b) => b !== fabricBox && (valanceY === null || b.y > valanceY)) ?? null;
  doc.fabricSize = fabricBox ? { widthCm: fabricBox.width, lengthCm: fabricBox.height } : null;
  doc.valanceSize = valanceBox ? { widthCm: valanceBox.width, heightCm: valanceBox.height } : null;

  // ── Side view: projection(s) and height, outside the schema, table and boxes ──
  const schemaBottom = Math.max(0, ...[...rails, ...bayLabels].map((i) => i.y));
  const tableHead = p1.find((i) => /^ÖLÇÜ$/.test(i.u));
  const schemaValues = new Set(systems.flatMap((s) => [s.railOuter, ...s.bays.flatMap((b) => [b.ironInner, b.railInner])]));
  const inBoxes = (i: It) => fabricLabel !== undefined && i.y > fabricLabel.y && i.x > fabricLabel.x - 40;
  const inTable = (i: It) => tableHead !== undefined && i.y > tableHead.y - 4 && i.x < 300;
  const side = p1.filter((i) => isNum(i) && i.y > schemaBottom + 4 && !inBoxes(i) && !inTable(i));
  const projections = side.filter((i) => isUpright(i) && i.size <= 16).sort((a, b) => a.x - b.x).map((i) => parseNumber(i.text)!).filter((v) => !schemaValues.has(v));
  const heights = side.filter((i) => isVertical(i)).map((i) => parseNumber(i.text)!);
  // One side view per sheet; back-to-back systems write one projection each (400 400).
  systems.forEach((s, k) => {
    s.projection = projections[k] ?? projections[0] ?? null;
    s.height = heights[k] ?? heights[0] ?? null;
  });
  doc.systems = systems;

  // ── Cut list ──
  if (tableHead) {
    const rows = p1.filter((i) => i.x < 100 && i.y > tableHead.y + 5 && /^(\d+\s*[*X×]\s*\d+|DERE|BORU|KUMA[SŞ]|SAC)(?![A-ZÇĞİÖŞÜ0-9])/.test(i.u)).sort((a, b) => a.y - b.y);
    doc.cutList = rows.map((r): FoyCutRow => {
      const size = p1.find((i) => i.x >= 95 && i.x < 210 && sameRow(i, r));
      const qty = p1.find((i) => i.x >= 200 && i.x < 300 && sameRow(i, r) && /\d+\s*ADET/.test(i.u));
      let lengthCm: number | null = null;
      let widthCm: number | null = null;
      if (size) {
        const sheet = size.u.replace(/CM/g, '').replace(/\s+/g, '').match(/^(\d+(?:[.,]\d+)?)[X×*](\d+(?:[.,]\d+)?)$/);
        if (sheet) [lengthCm, widthCm] = [parseNumber(sheet[1]), parseNumber(sheet[2])];
        else lengthCm = parseNumber(size.text);
      }
      const q = qty?.u.match(/(\d+)\s*ADET/);
      return { profile: r.text.trim(), kind: partKind(r.text), lengthCm, widthCm, quantity: q ? Number(q[1]) : null };
    });
  }

  // ── Notes: the free lines between the header and the schema ──
  const schemaTop = Math.min(...[...rails, ...bayLabels, ...numbers.filter((n) => n.y > 110)].map((i) => i.y));
  doc.notes = p1
    .filter((i) => i.y > 105 && i.y < schemaTop - 6 && !isNum(i) && i.size >= 12 && isUpright(i))
    .sort((a, b) => a.y - b.y)
    .map((i) => i.text.replace(/^\*+\s*/, '').trim())
    .filter(Boolean);

  // ── Steel drawings (later pages): keep their words, not their figures ──
  doc.ironNotes = all
    .filter((i) => i.page > 1 && !isNum(i) && /ADET|DEMİR|DELİK|KAYNA|DUVAR|OLACAK|OLMAYACAK/.test(i.u))
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
    .map((i) => i.text.trim());
  doc.ironCuts = ironCuts(all);
  doc.unreadPages = layout.imagePages;
  return doc;
}

/**
 * The steel pieces of the drawing pages: per page the profile ("50*100 DEMİR"), the quantity
 * ("3 ADET") and the length, which is the figure printed largest (hole spacings such as 100 / 200 /
 * 300 or "140" are drawn smaller). Dikey / yatay comes from the page's own caption. A page whose
 * length cannot be told apart keeps the piece with a null length: nothing is guessed.
 */
function ironCuts(all: It[]): FoyIronCut[] {
  const out: FoyIronCut[] = [];
  const pages = [...new Set(all.filter((i) => i.page > 1).map((i) => i.page))].sort((a, b) => a - b);
  for (const page of pages) {
    const items = all.filter((i) => i.page === page);
    const profile = items.map((i) => i.u.match(/(\d+)\s*[*X×]\s*(\d+)\s*DEMİR/)).find(Boolean);
    const qty = items.map((i) => i.u.match(/^(\d+)\s*ADET/)).find(Boolean);
    if (!profile || !qty) continue;
    const figures = items.filter((i) => isNum(i) && (isUpright(i) || isVertical(i)) && /^[\d.,\s]+$/.test(i.text));
    const biggest = Math.max(0, ...figures.map((i) => i.size));
    const top = figures.filter((i) => i.size >= biggest - 1);
    const values = [...new Set(top.map((i) => parseNumber(i.text)).filter((v): v is number => v !== null))];
    const caption = items.map((i) => i.u).join(' ');
    out.push({
      profile: `${profile[1]}*${profile[2]}`,
      lengthCm: values.length === 1 ? values[0] : null,
      quantity: Number(qty[1]),
      orientation: /DİKEY/.test(caption) ? 'dikey' : /YATAY/.test(caption) ? 'yatay' : null,
      page,
    });
  }
  return out;
}

function parseWindbreaker(layout: FoyLayout, all: It[]): FoyDoc {
  const doc = emptyFoy('windbreaker');
  const p1 = all.filter((i) => i.page === 1);
  /** Value cells right of a label; labels may wrap ("SİPARİŞ" / "TARİHİ:") so the first line decides the row. */
  const value = (re: RegExp) => {
    const l = p1.find((i) => re.test(i.u) && i.x < 120);
    if (!l) return null;
    const cells = p1.filter((i) => i.x > 150 && Math.abs(i.y - l.y) <= 8 && !/= *\d+ *KG/.test(i.u) && !/PİSTON/.test(i.u)).sort((a, b) => a.x - b.x);
    const text = cells.map((c) => c.text.trim()).join(' ').replace(/\s*\.\s*/g, '.').trim();
    return text && text !== '-' && text !== '•' ? text : null;
  };
  const wb: FoyWindbreaker = {
    orderDate: toIsoDate(value(/^SİPARİŞ/) ?? ''), deliveryDate: toIsoDate(value(/^TESLİM/) ?? ''),
    systemCount: Number(value(/^SİSTEM ADEDİ/)?.match(/\d+/)?.[0]) || null,
    planter: value(/^ÇİÇEKLİK/), crate: value(/^SANDIK/),
    widthCm: null, heightCm: null, frameCm: null, frameQty: null, sashCm: null, sashQty: null,
    sashGlass: null, frameGlass: null, totalKg: null, pistonTable: [],
  };
  for (const i of all) for (const m of i.text.matchAll(/(\d+)\s*cm\s*=\s*(\d+(?:[.,]\d+)?)\s*kg/gi)) wb.pistonTable.push({ widthCm: Number(m[1]), kg: parseNumber(m[2])! });
  doc.customer = value(/^MÜŞTERİ/);
  doc.date = wb.orderDate;
  const ral = value(/^RAL/);
  const m = ral ? upper(ral).match(/(\d{4})\s*(.*)$/) : null;
  doc.ral = m ? m[1] : null;
  doc.finish = m && m[2] ? titleCase(m[2]) : null;
  const assembly = upper(value(/^MONTAJ/) ?? '');
  doc.assembly = /DEMONTE/.test(assembly) ? 'demonte' : /MONTAJLI/.test(assembly) ? 'montajli' : null;
  doc.crated = wb.crate ? true : null;
  const notes = value(/^NOTLAR/);
  doc.notes = notes ? [notes] : [];
  doc.windbreaker = wb;
  // The measurement table is a picture on these sheets: whatever page has no readable text past the title.
  doc.unreadPages = [...new Set([...layout.imagePages, ...Array.from({ length: layout.pageCount }, (_, k) => k + 1).filter((p) => all.filter((i) => i.page === p && !/İMALATI$/.test(i.u)).length === 0)])].sort();
  return doc;
}
