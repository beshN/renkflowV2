/**
 * Cut list from an order sheet (föy), pure: which pieces must be cut, which stock bar each one is cut
 * from, what is left over and what has to be bought. Stock includes leftovers (artık) and bars that
 * were thrown on the scrap pile (hurda), which are used first when a piece fits them. The cutting
 * itself is the firm's engine (cutting-engine.ts); nothing here is a second algorithm.
 */
import { canonicalColor, colorKey } from '../colors/color-spec';
import type { FoyDoc, FoyPartKind } from '../foy/types';
import { optimizeCuts, planPurchase, type CutDemand, type CutSource, type CuttingParameters } from './cutting-engine';

const CUT_KINDS: FoyPartKind[] = ['demir', 'dere', 'led', 'boru'];
const KIND_LABEL: Record<FoyPartKind, string> = { demir: 'Demir', dere: 'Dere', led: 'LED profili', boru: 'Boru', kumas: 'Kumaş', sac: 'Sac', diger: 'Diğer' };

export type CutRow = {
  id: string;
  kind: FoyPartKind;
  /** As written on the sheet ("50*100", "Dere", "40 * 60"). */
  profile: string;
  label: string;
  lengthMm: number;
  quantity: number;
  /** Painted parts follow the order's colour; steel is cut from unpainted stock. */
  color: string;
  origin: 'liste' | 'demir sayfası';
  orientation: 'dikey' | 'yatay' | null;
};

export type RowProblem = { label: string; reason: string; ironPage?: number };

const mm = (cm: number) => Math.round(cm * 10 * 1000) / 1000;
const PAINTED: FoyPartKind[] = ['dere', 'led', 'boru'];

/** The pieces to cut from a sheet; what cannot be cut (fabric, sheet metal) or was not readable is listed apart, never guessed. */
export function foyCutRows(doc: FoyDoc): { rows: CutRow[]; problems: RowProblem[]; color: string } {
  const color = doc.ral ? canonicalColor(`RAL ${doc.ral}${doc.finish ? ` ${doc.finish}` : ''}`) : '';
  const rows = new Map<string, CutRow>();
  const problems: RowProblem[] = [];
  const add = (row: Omit<CutRow, 'id'>) => {
    const key = [row.kind, row.profile.replace(/\s+/g, ''), row.lengthMm, row.origin].join('|');
    const had = rows.get(key);
    if (had) had.quantity += row.quantity;
    else rows.set(key, { ...row, id: `r${rows.size + 1}` });
  };
  for (const r of doc.cutList) {
    const label = `${r.profile}${r.lengthCm !== null ? ` ${r.lengthCm} cm` : ''}`;
    if (!CUT_KINDS.includes(r.kind)) {
      if (r.kind === 'kumas' || r.kind === 'sac') problems.push({ label: r.profile, reason: r.kind === 'kumas' ? 'Kumaş profil gibi kesilmez; kumaş ölçüsü ayrı hazırlanır' : 'Sac ölçüsü föyde yazılı değil ya da profil gibi kesilmez' });
      continue;
    }
    if (r.lengthCm === null || !r.quantity) { problems.push({ label, reason: r.lengthCm === null ? 'Boyu okunamadı' : 'Adedi okunamadı' }); continue; }
    add({ kind: r.kind, profile: r.profile, label: `${KIND_LABEL[r.kind]} ${r.profile}`.replace(/^(Dere|Boru) \1$/i, '$1'), lengthMm: mm(r.lengthCm), quantity: r.quantity, color: PAINTED.includes(r.kind) ? color : '', origin: 'liste', orientation: null });
  }
  for (const c of doc.ironCuts) {
    const label = `Demir ${c.profile}${c.orientation ? ` (${c.orientation})` : ''}`;
    if (c.lengthCm === null) { problems.push({ label, reason: 'Boyu çizimden okunamadı; ölçüyü girin', ironPage: c.page }); continue; }
    if (!c.quantity) { problems.push({ label, reason: 'Adedi okunamadı' }); continue; }
    add({ kind: 'demir', profile: c.profile, label, lengthMm: mm(c.lengthCm), quantity: c.quantity, color: '', origin: 'demir sayfası', orientation: c.orientation });
  }
  return { rows: [...rows.values()], problems, color };
}

export type StockItem = { id: string; name: string; sku: string; profileCode: string | null; standardLengthMm: number | null };

/** "50*100", "50 x 100", "50×100" → "50x100". */
const dims = (text: string) => {
  const m = text.toLocaleLowerCase('tr-TR').replace(/×/g, 'x').replace(/\*/g, 'x').match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/);
  return m ? `${m[1].replace(',', '.')}x${m[2].replace(',', '.')}` : null;
};
const plain = (text: string) => text.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * The stock profile a sheet row stands for: by section ("50*100", "40 * 60") and kind word (demir,
 * dere, boru). Several equally good profiles are returned as candidates and none is chosen: the
 * person picks, the program does not guess between two real profiles.
 */
export function matchItems(row: Pick<CutRow, 'kind' | 'profile'>, items: StockItem[]): { itemId: string | null; candidates: StockItem[] } {
  const wanted = dims(row.profile);
  const scored = items.map((item) => {
    const text = plain([item.name, item.sku, item.profileCode ?? ''].join(' '));
    const itemDims = [item.name, item.sku, item.profileCode ?? ''].map(dims).filter(Boolean);
    let score = 0;
    if (wanted && itemDims.includes(wanted)) score += 4;
    if (row.kind === 'dere' && /\bdere\b/.test(text)) score += 4;
    if (row.kind === 'boru' && /\bboru\b/.test(text)) score += 4;
    if (row.kind === 'demir' && /\bdemir\b/.test(text)) score += 2;
    if (row.kind === 'led' && /\bled\b/.test(text)) score += 1;
    // A different kind word is a different part (a 50*100 "dere" is not the steel 50*100).
    if (row.kind !== 'dere' && /\bdere\b/.test(text)) score -= 5;
    if (row.kind !== 'boru' && /\bboru\b/.test(text)) score -= 5;
    if (row.kind !== 'demir' && /\bdemir\b/.test(text)) score -= 3;
    return { item, score };
  }).filter((s) => s.score >= 4).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  const top = scored.filter((s) => s.score === scored[0]?.score);
  return { itemId: top.length === 1 ? top[0].item.id : null, candidates: top.map((s) => s.item) };
}

export type StockLot = { id: string; itemId: string; lotNumber: string; lengthMm: number; color: string; kind: 'new' | 'remnant' | 'scrap'; unitCost?: number };

export type PlannedBar = {
  lotNumber: string;
  lotId: string;
  sourceKind: StockLot['kind'];
  sourceLengthMm: number;
  /** Cut pieces on this bar in cutting order, with how many of each. */
  cuts: Array<{ lengthMm: number; count: number; label: string }>;
  usedMm: number;
  leftoverMm: number;
  /** A leftover long enough to keep goes back to stock; a shorter one is scrap. */
  leftover: 'keep' | 'scrap' | 'none';
};

export type PlannedGroup = {
  itemId: string;
  itemName: string;
  color: string;
  pieces: number;
  bars: PlannedBar[];
  /** Bars to buy for what stock cannot cover. */
  buy: { bars: number; lengthMm: number } | null;
  missing: Array<{ lengthMm: number; count: number }>;
  tooLong: Array<{ lengthMm: number; count: number }>;
};

export type CutListPlan = {
  groups: PlannedGroup[];
  unmatched: Array<{ rowId: string; label: string; candidates: StockItem[] }>;
  summary: {
    pieces: number;
    barsFromStock: number;
    remnantsUsed: number;
    scrapUsed: number;
    toBuy: number;
    wasteMm: number;
    wastePercent: number;
    keptMm: number;
  };
  algorithm: string;
};

const sameLength = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/**
 * Plans the cuts. `choices` maps a row id to the profile the person picked when the match was not
 * unique. Everything the engine could not place is reported as missing (and as bars to buy), never dropped.
 */
export function planCutList(input: { rows: CutRow[]; items: StockItem[]; lots: StockLot[]; parameters: CuttingParameters; choices?: Record<string, string> }): CutListPlan {
  const { rows, items, lots, parameters } = input;
  const byId = new Map(items.map((i) => [i.id, i]));
  const unmatched: CutListPlan['unmatched'] = [];
  const demand: CutDemand[] = [];
  const rowItem = new Map<string, string>();
  for (const row of rows) {
    const chosen = input.choices?.[row.id];
    const match = chosen && byId.has(chosen) ? { itemId: chosen, candidates: [] as StockItem[] } : matchItems(row, items);
    if (!match.itemId) { unmatched.push({ rowId: row.id, label: row.label, candidates: match.candidates }); continue; }
    rowItem.set(row.id, match.itemId);
    demand.push({ itemId: match.itemId, color: row.color, lengthMm: row.lengthMm, quantity: row.quantity, workOrderId: 'liste', orderItemId: row.id });
  }

  const kindOf = new Map(lots.map((l) => [l.id, l.kind]));
  const lotById = new Map(lots.map((l) => [l.id, l]));
  // Leftovers and scrap are both "used up first" by the engine; the lot kind keeps them apart for the report.
  const sources: CutSource[] = lots.map((l) => ({ id: l.id, itemId: l.itemId, color: l.color, lengthMm: l.lengthMm, unitCost: l.unitCost ?? 0, isRemnant: l.kind !== 'new' }));
  const empty = !demand.length;
  const result = empty ? null : optimizeCuts(demand, sources, parameters);
  const rowOf = new Map(rows.map((r) => [r.id, r]));

  const groups = new Map<string, PlannedGroup>();
  const groupFor = (itemId: string, color: string) => {
    const key = `${itemId}\u0000${colorKey(color)}`;
    let g = groups.get(key);
    if (!g) {
      g = { itemId, itemName: byId.get(itemId)?.name ?? '—', color, pieces: 0, bars: [], buy: null, missing: [], tooLong: [] };
      groups.set(key, g);
    }
    return g;
  };
  for (const d of demand) groupFor(d.itemId, d.color).pieces += d.quantity;

  let remnantsUsed = 0, scrapUsed = 0, barsFromStock = 0, keptMm = 0;
  for (const bar of result?.bars ?? []) {
    const lot = lotById.get(bar.source.id)!;
    const color = bar.pieces.length ? rowOf.get(bar.pieces[0].orderItemId ?? '')?.color ?? bar.source.color : bar.source.color;
    const g = groupFor(bar.source.itemId, color);
    const cuts: PlannedBar['cuts'] = [];
    for (const p of [...bar.pieces].sort((a, b) => b.lengthMm - a.lengthMm)) {
      const label = rowOf.get(p.orderItemId ?? '')?.label ?? '';
      const had = cuts.find((c) => sameLength(c.lengthMm, p.lengthMm) && c.label === label);
      if (had) had.count++;
      else cuts.push({ lengthMm: p.lengthMm, count: 1, label });
    }
    const kind = kindOf.get(bar.source.id) ?? 'new';
    if (kind === 'remnant') remnantsUsed++;
    else if (kind === 'scrap') scrapUsed++;
    else barsFromStock++;
    if (bar.reusable) keptMm += bar.remainingMm;
    g.bars.push({
      lotNumber: lot.lotNumber, lotId: lot.id, sourceKind: kind, sourceLengthMm: lot.lengthMm, cuts,
      usedMm: Math.round((lot.lengthMm - bar.remainingMm) * 10) / 10,
      leftoverMm: Math.round(bar.remainingMm * 10) / 10,
      leftover: bar.remainingMm <= 0 ? 'none' : bar.reusable ? 'keep' : 'scrap',
    });
  }

  // Pieces no stock bar could take → bars to buy on each profile's standard length.
  let toBuy = 0;
  if (result?.unfulfilled.length) {
    const standard = (itemId: string) => byId.get(itemId)?.standardLengthMm || parameters.standardLengthMm;
    const purchase = planPurchase(result.unfulfilled, standard, parameters);
    const colorOfItem = new Map(result.unfulfilled.map((p) => [`${p.itemId}\u0000${colorKey(p.color)}`, p.color]));
    for (const line of purchase.lines) {
      const g = groupFor(line.itemId, colorOfItem.get(`${line.itemId}\u0000${colorKey(line.color)}`) ?? line.color);
      g.buy = { bars: line.bars, lengthMm: line.lengthMm };
      toBuy += line.bars;
    }
    const tally = (pieces: CutDemand[]) => {
      const out = new Map<string, Array<{ lengthMm: number; count: number }>>();
      for (const p of pieces) {
        const key = `${p.itemId}\u0000${colorKey(p.color)}`;
        const list = out.get(key) ?? [];
        const had = list.find((x) => sameLength(x.lengthMm, p.lengthMm));
        if (had) had.count += p.quantity; else list.push({ lengthMm: p.lengthMm, count: p.quantity });
        out.set(key, list);
      }
      return out;
    };
    for (const [key, list] of tally(result.unfulfilled)) {
      const [itemId] = key.split('\u0000');
      groupFor(itemId, colorOfItem.get(key) ?? '').missing = list.sort((a, b) => b.lengthMm - a.lengthMm);
    }
    for (const [key, list] of tally(purchase.tooLong)) {
      const [itemId] = key.split('\u0000');
      groupFor(itemId, colorOfItem.get(key) ?? '').tooLong = list;
    }
  }

  const list = [...groups.values()].sort((a, b) => a.itemName.localeCompare(b.itemName, 'tr') || a.color.localeCompare(b.color));
  return {
    groups: list,
    unmatched,
    summary: {
      pieces: demand.reduce((s, d) => s + d.quantity, 0),
      barsFromStock, remnantsUsed, scrapUsed, toBuy,
      wasteMm: Math.round((result?.wasteMm ?? 0) * 10) / 10,
      wastePercent: Math.round((result?.wastePercent ?? 0) * 10) / 10,
      keptMm: Math.round(keptMm * 10) / 10,
    },
    algorithm: result?.algorithm ?? '—',
  };
}
