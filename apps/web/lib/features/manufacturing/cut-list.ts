/**
 * Cut list from an order sheet (föy), pure: which pieces must be cut, which stock bar each one is cut
 * from, what is left over and what has to be bought. Stock includes leftovers (artık) and bars that
 * were thrown on the scrap pile (hurda), which are used first when a piece fits them. The cutting
 * itself is the firm's engine (cutting-engine.ts); nothing here is a second algorithm.
 */
import { canonicalColor, colorKey, parseColor } from '../colors/color-spec';
import type { FoyDoc, FoyPartKind } from '../foy/types';
import { chooseBarLengths, optimizeCuts, planPurchase, type CutDemand, type CutSource, type CuttingParameters } from './cutting-engine';

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
  origin: 'liste' | 'demir sayfası'|'ürün standardı';
  orientation: 'dikey' | 'yatay' | null;
  requiredProfileCode?: string;
  fixedItemId?:string;
};

export type RowProblem = { label: string; reason: string; ironPage?: number };

const mm = (cm: number) => Math.round(cm * 10 * 1000) / 1000;
const PAINTED: FoyPartKind[] = ['dere', 'led', 'boru'];

/** The pieces to cut from a sheet; what cannot be cut (fabric, sheet metal) or was not readable is listed apart, never guessed. */
export function foyCutRows(doc: FoyDoc, family?: string): { rows: CutRow[]; problems: RowProblem[]; color: string } {
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
  return { rows: [...rows.values()].map(r => {
    if(r.kind!=='dere')return r;
    const name=r.profile.toLocaleLowerCase('tr-TR');
    const code=family==='makasli'?'170':family==='pergola'?(/\b6015\b|klasik/.test(name)?'6015':/\b6056\b|oval/.test(name)?'6056':null):null;
    return code?{...r,requiredProfileCode:code}:r;
  }), problems, color };
}

export type StockItem = { id: string; name: string; sku: string; profileCode: string | null; standardLengthMm: number | null; sizeLabel?: string | null; processedStates?: string[];weightPerMeterKg?:number|null };

/** "50*100", "50 x 100", "50×100" → "50x100". */
const dims = (text: string) => {
  const m = text.toLocaleLowerCase('tr-TR').replace(/×/g, 'x').replace(/\*/g, 'x').match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/);
  return m ? `${m[1].replace(',', '.')}x${m[2].replace(',', '.')}` : null;
};
const plain = (text: string) => text.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

export const stockProfileIdentity = (item: StockItem) => item.profileCode && item.processedStates ? [
  plain(item.profileCode).trim(), plain(item.sizeLabel ?? '').replace(/\s+/g, ''),
  [...(item.processedStates ?? [])].filter((s) => !['boyali', 'boyasiz'].includes(plain(s))).sort().join(','),
].join('\u0000') : item.id;

/**
 * The stock profile a sheet row stands for: by section ("50*100", "40 * 60") and kind word (demir,
 * dere, boru). Several equally good profiles are returned as candidates and none is chosen: the
 * person picks, the program does not guess between two real profiles.
 */
export function matchItems(row: Pick<CutRow, 'kind' | 'profile' | 'requiredProfileCode'|'fixedItemId'>, items: StockItem[]): { itemId: string | null; candidates: StockItem[] } {
  if(row.fixedItemId){const candidates=items.filter(i=>i.id===row.fixedItemId);return {itemId:candidates[0]?.id||null,candidates};}
  if (row.requiredProfileCode) {
    const candidates = items.filter(i=>i.profileCode === row.requiredProfileCode);
    const identities = new Set(candidates.map(stockProfileIdentity));
    return {itemId:identities.size === 1 ? candidates[0].id : null,candidates};
  }
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
  const sameProfile = top.length > 0 && new Set(top.map((s) => stockProfileIdentity(s.item))).size === 1;
  return { itemId: sameProfile ? top[0].item.id : null, candidates: top.map((s) => s.item) };
}

export type StockLot = { id: string; itemId: string; lotNumber: string; lengthMm: number; color: string; kind: 'new' | 'remnant' | 'scrap'; unitCost?: number; warehouseName?: string; locationCode?: string };

export type PlannedBar = {
  lotNumber: string;
  warehouseName?: string;
  locationCode?: string;
  lotId: string;
  sourceKind: StockLot['kind'];
  sourceLengthMm: number;
  sourceItemName: string;
  paintTo: string | null;
  cutWeightKg:number|null;
  lossWeightKg:number|null;
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
  uncertain?: boolean;
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
    toPaint: number;
    wasteMm: number;
    wastePercent: number | null;
    keptMm: number;
  };
  algorithm: string;
};

const sameLength = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/**
 * Plans the cuts. `choices` maps a row id to the profile the person picked when the match was not
 * unique. Everything the engine could not place is reported as missing (and as bars to buy), never dropped.
 */
export function planCutList(input: { rows: CutRow[]; items: StockItem[]; lots: StockLot[]; parameters: CuttingParameters; choices?: Record<string, string>; purchaseLengthsMm?: number[]; uncertainItemIds?: string[] }): CutListPlan {
  const { rows, items, lots, parameters } = input;
  const byId = new Map(items.map((i) => [i.id, i]));
  const unmatched: CutListPlan['unmatched'] = [];
  const demand: CutDemand[] = [];

  for (const row of rows) {
    const chosen = input.choices?.[row.id];
    const candidates=matchItems(row,items);
    const match = chosen && candidates.candidates.some(i=>i.id===chosen) ? { itemId: chosen, candidates: candidates.candidates } : candidates;
    if (!match.itemId) { unmatched.push({ rowId: row.id, label: row.label, candidates: match.candidates }); continue; }
    demand.push({ itemId: match.itemId, color: row.color, lengthMm: row.lengthMm, quantity: row.quantity, workOrderId: 'liste', orderItemId: row.id });
  }

  const {family,result,allBars,unfulfilled,paintTargets,lotById} = allocatePhysicalCuts(demand,items,lots,parameters);
  const kindOf = new Map(lots.map(l=>[l.id,l.kind]));
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
  for (const bar of allBars) {
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
      lotNumber: lot.lotNumber, warehouseName:lot.warehouseName, locationCode:lot.locationCode, lotId: lot.id, sourceKind: kind, sourceLengthMm: lot.lengthMm, sourceItemName: byId.get(lot.itemId)?.name ?? '—', paintTo: paintTargets.get(lot.id) ?? null, cuts,
      usedMm: Math.round((lot.lengthMm - bar.remainingMm) * 10) / 10,
      cutWeightKg:byId.get(lot.itemId)?.weightPerMeterKg?bar.pieces.reduce((n,p)=>n+p.lengthMm,0)/1000*byId.get(lot.itemId)!.weightPerMeterKg!:null,
      lossWeightKg:byId.get(lot.itemId)?.weightPerMeterKg?bar.lossMm/1000*byId.get(lot.itemId)!.weightPerMeterKg!:null,
      leftoverMm: Math.round(bar.remainingMm * 10) / 10,
      leftover: bar.remainingMm <= 0 ? 'none' : bar.reusable ? 'keep' : 'scrap',
    });
  }

  // Pieces no stock bar could take → bars to buy on each profile's standard length.
  let toBuy = 0;
  if (unfulfilled.length) {
    const standard = (itemId: string) => byId.get(itemId)?.standardLengthMm || parameters.standardLengthMm;
    const choices = input.purchaseLengthsMm?.length ? chooseBarLengths(unfulfilled, (id) => [standard(id), ...input.purchaseLengthsMm!], parameters, { objective: 'material' }) : new Map();
    const purchase = planPurchase(unfulfilled, (id) => choices.get(id)?.lengthMm ?? standard(id), parameters, { objective: 'material' });
    const colorOfItem = new Map(unfulfilled.map((p) => [`${p.itemId}\u0000${colorKey(p.color)}`, p.color]));
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
    for (const [key, list] of tally(unfulfilled)) {
      const [itemId] = key.split('\u0000');
      groupFor(itemId, colorOfItem.get(key) ?? '').missing = list.sort((a, b) => b.lengthMm - a.lengthMm);
    }
    for (const [key, list] of tally(purchase.tooLong)) {
      const [itemId] = key.split('\u0000');
      groupFor(itemId, colorOfItem.get(key) ?? '').tooLong = list;
    }
  }

  const uncertainFamilies = new Set((input.uncertainItemIds ?? []).map(id=>family.get(id)));
  for (const g of groups.values()) if (uncertainFamilies.has(family.get(g.itemId))) { g.uncertain = true; g.buy = null; }
  toBuy = [...groups.values()].reduce((n,g)=>n+(g.buy?.bars ?? 0),0);
  const list = [...groups.values()].sort((a, b) => a.itemName.localeCompare(b.itemName, 'tr') || a.color.localeCompare(b.color));
  return {
    groups: list,
    unmatched,
    summary: {
      pieces: demand.reduce((s, d) => s + d.quantity, 0),
      barsFromStock, remnantsUsed, scrapUsed, toBuy, toPaint: paintTargets.size,
      wasteMm: Math.round(allBars.reduce((sum, b) => sum + b.lossMm, 0) * 10) / 10,
      wastePercent: !allBars.length || list.some(g=>g.uncertain) || unfulfilled.length || unmatched.length ? null : Math.round((allBars.length ? allBars.reduce((sum, b) => sum + b.lossMm, 0) / allBars.reduce((sum, b) => sum + b.source.lengthMm, 0) * 100 : 0) * 10) / 10,
      keptMm: Math.round(keptMm * 10) / 10,
    },
    algorithm: result?.algorithm ?? '—',
  };
}

/** Shared by sheet previews and committed production plans. One physical bar is used at most once. */
export function allocatePhysicalCuts(demand: CutDemand[], items: StockItem[], lots: StockLot[], parameters: CuttingParameters) {
  // Different physical lengths and painted/raw cards may share a profile, but section and
  // machining states must agree. Never substitute merely because two names sound alike.
  const family = new Map(items.map((item) => [item.id, stockProfileIdentity(item)]));
  const canonical = new Map<string, string>();
  for (const d of demand) if (!canonical.has(family.get(d.itemId)!)) canonical.set(family.get(d.itemId)!, d.itemId);
  const planningItem = (id: string) => canonical.get(family.get(id) ?? id) ?? id;
  for (const d of demand) d.itemId = planningItem(d.itemId);
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const sources: CutSource[] = lots.map((l) => ({ id: l.id, stockItemId: l.itemId, stockColor: l.color, itemId: planningItem(l.itemId), color: parseColor(l.color).kind === 'raw' && demand.some((d) => d.itemId === planningItem(l.itemId) && !d.color) ? '' : l.color, lengthMm: l.lengthMm, unitCost: l.unitCost ?? 0, isRemnant: l.kind !== 'new' }));
  // First use stock in the required finish. Only remaining demand may consume explicitly raw
  // bars, and each physical bar is removed from the shared pool immediately after allocation.
  const result = demand.length ? optimizeCuts(demand, sources, parameters, { objective: 'material' }) : null;
  const used = new Set(result?.bars.map((b) => b.source.id));
  const paintTargets = new Map<string, string>();
  const paintPlans = [];
  let unfulfilled = result?.unfulfilled ?? [];
  const colors = [...new Set(unfulfilled.map((p) => p.color))].filter((c) => ['ral', 'custom'].includes(parseColor(c).kind)).sort();
  for (const color of colors) {
    const waiting = unfulfilled.filter((p) => p.color === color);
    const raw = sources.filter((s) => !used.has(s.id) && parseColor(lotById.get(s.id)?.color).kind === 'raw').map((s) => ({ ...s, color }));
    const paint = optimizeCuts(waiting, raw, parameters, { objective: 'material' });
    for (const b of paint.bars) { used.add(b.source.id); paintTargets.set(b.source.id, color); }
    paintPlans.push(paint);
    unfulfilled = [...unfulfilled.filter((p) => p.color !== color), ...paint.unfulfilled];
  }
  const allBars = [...(result?.bars ?? []), ...paintPlans.flatMap((p) => p.bars)];
  for (const b of allBars) b.source.paintTo = paintTargets.get(b.source.id) ?? null;
  return {demand,family,result,allBars,unfulfilled,paintTargets,lotById};
}
