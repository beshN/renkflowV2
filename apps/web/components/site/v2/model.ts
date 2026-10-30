import { calculateRecipe, type RecipeDefinition } from '@/lib/features/manufacturing/recipe-engine';
import { optimizeCuts, type CutBar, type CutSource } from '@/lib/features/manufacturing/cutting-engine';
import { quoteTotals } from '@/lib/features/sales/engine';
import { LIFECYCLE } from '@/lib/features/orders/lifecycle';

/**
 * Sample data for the landing showcase. Every number a visitor sees is computed by the engines the
 * workspace uses (recipe, cutting, quote totals); only the orders, prices and stock are made up.
 */

export type StageKey = (typeof LIFECYCLE)[number]['key'];
export const STAGES = LIFECYCLE.map((s) => ({ key: s.key as StageKey, label: s.label }));
export const stageIndex = (key: StageKey) => STAGES.findIndex((s) => s.key === key);

// Profiles and materials of the sample bioclimatic pergola, with fixed ids the recipe refers to.
export const ITEMS = {
  carrier: { id: '0b6f8a0e-1a52-4c1e-9f0a-6017aa000001', code: '6017', name: 'Taşıyıcı kiriş 100×150', stockMm: 7000 },
  side: { id: '0b6f8a0e-1a52-4c1e-9f0a-6018aa000002', code: '6018', name: 'Yan kiriş 100×150', stockMm: 7000 },
  post: { id: '0b6f8a0e-1a52-4c1e-9f0a-0108aa000003', code: '108', name: 'Dikme 100×100', stockMm: 6000 },
  blade: { id: '0b6f8a0e-1a52-4c1e-9f0a-6056aa000004', code: '6056', name: 'Lamel 200 mm', stockMm: 7000 },
  motor: { id: '0b6f8a0e-1a52-4c1e-9f0a-9001aa000005', code: 'MT-24', name: 'Lamel motoru 24V', stockMm: 0 },
  led: { id: '0b6f8a0e-1a52-4c1e-9f0a-9002aa000006', code: 'LED-3K', name: 'LED şerit 3000K', stockMm: 0 },
} as const;
export type ItemKey = keyof typeof ITEMS;
const byId = new Map(Object.values(ITEMS).map((i) => [i.id, i]));
export const itemOf = (id: string) => byId.get(id as (typeof ITEMS)[ItemKey]['id']);

export const LIMITS = { width: [2500, 6800], projection: [2000, 5800], height: [2200, 3200] } as const;

const RECIPE: RecipeDefinition = {
  code: 'PRG-BIO',
  name: 'Bioklimatik pergola',
  version: 3,
  geometry: 'roof',
  finishedItemId: '0b6f8a0e-1a52-4c1e-9f0a-0000aa000000',
  rules: [
    { itemId: ITEMS.carrier.id, kind: 'profile', uom: 'm', quantityFormula: '2', cutLengthFormula: 'widthMm' },
    { itemId: ITEMS.side.id, kind: 'profile', uom: 'm', quantityFormula: '2', cutLengthFormula: 'projectionMm - 200' },
    { itemId: ITEMS.post.id, kind: 'profile', uom: 'm', quantityFormula: 'if(widthMm > 5000, 6, 4)', cutLengthFormula: 'mountingHeightMm' },
    { itemId: ITEMS.blade.id, kind: 'profile', uom: 'm', quantityFormula: 'floor((projectionMm - 200) / 190)', cutLengthFormula: 'widthMm - 210' },
    { itemId: ITEMS.motor.id, kind: 'material', uom: 'adet', quantityFormula: 'if(widthMm > 5000, 2, 1)', conditionFormula: 'motor == 1' },
    { itemId: ITEMS.led.id, kind: 'material', uom: 'm', quantityFormula: '(widthMm * 2 + projectionMm * 2) / 1000', conditionFormula: 'led == 1' },
  ],
  operations: [
    { name: 'Kesim', workCenterCode: 'KESIM', minutesFormula: '25 + areaM2 * 2', qualityChecks: [] },
    { name: 'Delme ve frezeleme', workCenterCode: 'CNC', minutesFormula: '30 + areaM2 * 3', qualityChecks: [] },
    { name: 'Elektrostatik boya', workCenterCode: 'BOYA', minutesFormula: '45 + areaM2 * 1.5', qualityChecks: [] },
    { name: 'Ön montaj ve paketleme', workCenterCode: 'MONTAJ', minutesFormula: '40 + areaM2 * 4 + motor * 20', qualityChecks: [] },
  ],
  limits: { minWidthMm: LIMITS.width[0], maxWidthMm: LIMITS.width[1], minProjectionMm: LIMITS.projection[0], maxProjectionMm: LIMITS.projection[1], minMountingHeightMm: LIMITS.height[0], maxMountingHeightMm: LIMITS.height[1] },
  examples: [],
};

const CUT_PARAMETERS = { kerfMm: 4, trimStartMm: 10, trimEndMm: 10, minimumRemnantMm: 500, standardLengthMm: 6000 };

// Sample price list, excluding VAT.
const PRICE = { perM2: 6400, motor: 9800, led: 420 };

export type Spec = { widthMm: number; projectionMm: number; heightMm: number; color: string; motor: boolean; led: boolean; quantity?: number };

/** Remnants already on the rack, used before whole bars, as in the workshop. */
export const REMNANTS: Array<{ item: ItemKey; lengthMm: number }> = [
  { item: 'post', lengthMm: 3120 },
  { item: 'blade', lengthMm: 2480 },
  { item: 'side', lengthMm: 4300 },
];

export type Plan = ReturnType<typeof planOrder>;

/** Recipe → cut list → cutting plan → quote: one function, the chain the product runs on an order. */
export function planOrder(spec: Spec, id = 'demo') {
  const quantity = spec.quantity ?? 1;
  const recipe = calculateRecipe(RECIPE, { widthMm: spec.widthMm, projectionMm: spec.projectionMm, mountingHeightMm: spec.heightMm, quantity, motor: spec.motor, led: spec.led });
  const cuts = recipe.cuts.map((c) => ({ ...c, item: itemOf(c.itemId)! }));
  const sources: CutSource[] = [
    ...REMNANTS.map((r, i) => ({ id: `rem-${i}`, itemId: ITEMS[r.item].id, color: spec.color, lengthMm: r.lengthMm, unitCost: 0, isRemnant: true })),
    ...cuts.flatMap((c) => Array.from({ length: c.quantity + 4 }, (_, i) => ({ id: `${c.item.code}-${i}`, itemId: c.itemId, color: spec.color, lengthMm: c.item.stockMm, unitCost: 1, isRemnant: false }))),
  ];
  const cut = optimizeCuts(
    cuts.map((c) => ({ itemId: c.itemId, color: spec.color, lengthMm: c.lengthMm, quantity: c.quantity, workOrderId: id })),
    sources,
    CUT_PARAMETERS,
    { objective: 'material' },
  );
  const bars = cut.bars.filter((b) => b.pieces.length);
  const area = (spec.widthMm * spec.projectionMm) / 1_000_000;
  const ledMeters = recipe.materials.find((m) => m.itemId === ITEMS.led.id)?.quantity ?? 0;
  const motors = recipe.materials.find((m) => m.itemId === ITEMS.motor.id)?.quantity ?? 0;
  const lines = [
    { label: `Bioklimatik pergola · ${fmt(area, 2)} m²`, quantity, unitPrice: Math.round(area * PRICE.perM2), discountPercent: 0 },
    ...(motors ? [{ label: `${ITEMS.motor.name} × ${motors / quantity}`, quantity, unitPrice: (motors / quantity) * PRICE.motor, discountPercent: 0 }] : []),
    ...(ledMeters ? [{ label: `${ITEMS.led.name} · ${fmt(ledMeters / quantity, 1)} m`, quantity, unitPrice: Math.round((ledMeters / quantity) * PRICE.led), discountPercent: 0 }] : []),
  ];
  const totals = quoteTotals(lines, 0, 20);
  const minutes = recipe.operations.reduce((sum, op) => sum + op.plannedMinutes + op.setupMinutes, 0);
  return { recipe, cuts, bars, cut, lines, totals, minutes, area };
}

/** Bars grouped by profile, for "how many bars of which profile" summaries. */
export function barsByItem(bars: CutBar[]) {
  const groups = new Map<string, { item: NonNullable<ReturnType<typeof itemOf>>; bars: CutBar[] }>();
  for (const bar of bars) {
    const item = itemOf(bar.source.itemId);
    if (!item) continue;
    const group = groups.get(item.id) ?? { item, bars: [] };
    group.bars.push(bar);
    groups.set(item.id, group);
  }
  const order = Object.values(ITEMS).map((i) => i.id as string);
  return [...groups.values()].sort((a, b) => order.indexOf(a.item.id) - order.indexOf(b.item.id));
}

export const fmt = (n: number, digits = 0) => n.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const mm = (n: number) => `${fmt(n)} mm`;
export const tl = (n: number) => `₺${fmt(Math.round(n))}`;
export const hours = (min: number) => `${Math.floor(min / 60)} sa ${String(Math.round(min % 60)).padStart(2, '0')} dk`;

export type Order = {
  id: string;
  customer: string;
  city: string;
  product: string;
  spec: Spec;
  due: string;
  stage: StageKey;
  owner: string;
  note?: string;
};

export const ORDERS: Order[] = [
  { id: 'RF-1042', customer: 'Kıyı Kafe', city: 'Bodrum', product: 'Bioklimatik pergola', spec: { widthMm: 5400, projectionMm: 4200, heightMm: 2600, color: 'RAL 7016 Mat', motor: true, led: true }, due: '14 Kas', stage: 'cutting', owner: 'Selin A.' },
  { id: 'RF-1041', customer: 'Yalı Restoran', city: 'Çeşme', product: 'Bioklimatik pergola', spec: { widthMm: 6200, projectionMm: 5000, heightMm: 2800, color: 'RAL 9016 Mat', motor: true, led: false }, due: '16 Kas', stage: 'production', owner: 'Murat K.' },
  { id: 'RF-1040', customer: 'Atlas Mimarlık', city: 'İzmir', product: 'Bioklimatik pergola', spec: { widthMm: 4000, projectionMm: 3500, heightMm: 2500, color: 'RAL 9006', motor: true, led: true }, due: '18 Kas', stage: 'approval', owner: 'Selin A.' },
  { id: 'RF-1038', customer: 'Çam Konutları', city: 'Urla', product: 'Bioklimatik pergola', spec: { widthMm: 3600, projectionMm: 3000, heightMm: 2400, color: 'RAL 8019 Mat', motor: false, led: false }, due: '11 Kas', stage: 'assembly', owner: 'Deniz Ö.' },
  { id: 'RF-1037', customer: 'Liman Otel', city: 'Kuşadası', product: 'Bioklimatik pergola', spec: { widthMm: 6800, projectionMm: 5800, heightMm: 3000, color: 'RAL 7037 Mat', motor: true, led: true }, due: '25 Kas', stage: 'quote', owner: 'Murat K.' },
  { id: 'RF-1035', customer: 'Bağ Evi', city: 'Seferihisar', product: 'Bioklimatik pergola', spec: { widthMm: 3000, projectionMm: 2500, heightMm: 2300, color: 'RAL 9016 Mat', motor: false, led: true }, due: '7 Kas', stage: 'delivery', owner: 'Deniz Ö.' },
  { id: 'RF-1043', customer: 'Mavi Butik Otel', city: 'Alaçatı', product: 'Bioklimatik pergola', spec: { widthMm: 5000, projectionMm: 4000, heightMm: 2700, color: 'RAL 7016 Mat', motor: true, led: false }, due: '28 Kas', stage: 'quote', owner: 'Selin A.' },
];

/** Rack stock per profile and colour, in whole bars; reserved bars belong to open orders. */
export const STOCK = [
  { item: 'carrier' as ItemKey, color: 'RAL 7016 Mat', bars: 14, reserved: 4, rack: 'A2' },
  { item: 'side' as ItemKey, color: 'RAL 7016 Mat', bars: 9, reserved: 2, rack: 'A3' },
  { item: 'post' as ItemKey, color: 'RAL 7016 Mat', bars: 22, reserved: 6, rack: 'B1' },
  { item: 'blade' as ItemKey, color: 'RAL 7016 Mat', bars: 38, reserved: 8, rack: 'B4' },
  { item: 'carrier' as ItemKey, color: 'RAL 9016 Mat', bars: 6, reserved: 2, rack: 'C2' },
  { item: 'blade' as ItemKey, color: 'RAL 9016 Mat', bars: 12, reserved: 12, rack: 'C4' },
  { item: 'post' as ItemKey, color: 'RAL 9016 Mat', bars: 4, reserved: 0, rack: 'C1' },
  { item: 'side' as ItemKey, color: 'RAL 9006', bars: 3, reserved: 0, rack: 'D3' },
];

export const STAGE_COLOR: Record<StageKey, string> = {
  quote: 'var(--x-st-quote)',
  approval: 'var(--x-st-approval)',
  production: 'var(--x-st-production)',
  cutting: 'var(--x-st-cutting)',
  assembly: 'var(--x-st-assembly)',
  delivery: 'var(--x-st-delivery)',
};
