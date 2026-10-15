import { z } from 'zod';

/**
 * A configured product on a quote line. What the seller chooses (family, recipe, measures, options,
 * colour) comes from the browser; everything else (bill of materials, cut list, price and where it
 * came from) is filled in by the server from the published recipe and the firm's price matrix and
 * is never taken from the browser.
 */
export const ConfigurationChoiceSchema = z.object({
  family: z.string().max(40),
  recipeId: z.string().uuid('Reçete seçin'),
  parameters: z.object({
    widthMm: z.number().int('En tam sayı (mm) olmalı').positive('En gerekli').max(100000),
    projectionMm: z.number().int('Açılım tam sayı (mm) olmalı').nonnegative().max(100000).default(0),
    mountingHeightMm: z.number().int('Yükseklik tam sayı (mm) olmalı').positive('Yükseklik gerekli').max(100000),
    motor: z.boolean().default(false),
    led: z.boolean().default(false),
    customParameters: z.record(z.string().max(60), z.union([z.number().finite(), z.boolean()])).default({}),
  }),
  color: z.string().trim().min(1, 'Renk seçin').max(100),
});
export type ConfigurationChoice = z.infer<typeof ConfigurationChoiceSchema>;

export type BomMaterial = { itemId: string; sku: string; name: string; quantity: number; uom: string };
export type BomCut = { itemId: string; sku: string; name: string; lengthMm: number; quantity: number };
export type PriceState = 'matrix' | 'no_matrix' | 'not_covered' | 'unpriced_options' | 'currency_mismatch';

export type ProductConfiguration = ConfigurationChoice & {
  familyLabel: string;
  recipe: { code: string; name: string; version: number };
  bom: { materials: BomMaterial[]; cuts: BomCut[] };
  price: {
    state: PriceState;
    /** Where the line's unit price came from: the matrix, or the seller because the matrix did not price it. */
    source: 'matrix' | 'manual';
    message: string | null;
    matrixId: string | null;
    matrixUnitPrice: number | null;
    /** The quote currency the price was worked out for; another currency needs it again. */
    currency: string;
    lines: Array<{ label: string; amount: number }>;
  };
};

/** One line for the quote, the print and the order: what was configured. */
export function configurationSummary(c: Pick<ProductConfiguration, 'familyLabel' | 'recipe' | 'parameters' | 'color'>) {
  const p = c.parameters;
  const options = [p.motor ? 'motorlu' : null, p.led ? 'LED' : null, ...Object.entries(p.customParameters).filter(([, v]) => v !== false && v !== 0).map(([k, v]) => (v === true ? k : `${k}: ${v}`))].filter(Boolean);
  const dimensions=p.projectionMm===0?`${p.widthMm} × ${p.mountingHeightMm} mm`:`${p.widthMm} × ${p.projectionMm} mm, yükseklik ${p.mountingHeightMm} mm`;
  return `${c.familyLabel} · ${c.recipe.name} · ${dimensions} · ${c.color}${options.length ? ' · ' + options.join(', ') : ''}`;
}

type LineFields = {
  productName: string;
  description?: string;
  color?: string;
  widthMm?: number;
  projectionMm?: number;
  mountingHeightMm?: number;
  unitPrice: number;
  awningConfiguration?: unknown;
  awningPreview?: unknown;
  productConfiguration?: unknown;
};

/** The quote line a configuration makes; the browser preview and the server's save use the same mapping. */
export function configuredLine<T extends LineFields>(item: T, c: ProductConfiguration, typedPrice: number): T {
  return {
    ...item,
    productName: `${c.familyLabel} · ${c.recipe.name}`,
    description: configurationSummary(c),
    color: c.color,
    widthMm: c.parameters.widthMm,
    projectionMm: c.parameters.projectionMm||undefined,
    mountingHeightMm: c.parameters.mountingHeightMm,
    unitPrice: c.price.source === 'matrix' ? c.price.matrixUnitPrice! : typedPrice,
    awningConfiguration: undefined,
    awningPreview: undefined,
    productVisualization: undefined,
    productConfiguration: c,
  };
}

/** A plain line again: nothing of the configuration (name, measures, colour, matrix price) is left behind. */
export function unconfiguredLine<T extends LineFields>(item: T): T {
  const matrixPriced = (item.productConfiguration as ProductConfiguration | undefined)?.price?.source === 'matrix';
  return { ...item, productName: '', description: undefined, color: undefined, widthMm: undefined, projectionMm: undefined, mountingHeightMm: undefined, unitPrice: matrixPriced ? 0 : item.unitPrice, productConfiguration: undefined };
}

/** JSON with keys in a fixed order (the database returns stored objects with its own key order). */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object')
    return '{' + Object.keys(value).filter((k) => (value as Record<string, unknown>)[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stableJson((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
