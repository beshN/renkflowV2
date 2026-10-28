import { z } from 'zod';
import { AwningConfigurationSchema, BODY_COLORS, DEFAULT_AWNING, FABRIC_COLORS, type AwningConfiguration } from '@/lib/features/awning/configuration';
import { defaultVisualization, productMeta, VisualizationConfigurationSchema, type ProductKind, type VisualizationConfiguration } from '@/lib/features/product-3d/catalog';
import { CONTROL_KEYS, CONTROL_LABELS, FAIR_KINDS, fairProduct, type FairKind, type SizeKey } from './products';
import { colorName, configuratorText, fairText, INTL_LOCALE, LOCALES, productName, type Locale } from './i18n';

/**
 * The one design model of the configurator: kiosk, phone and web share it, the QR code carries it,
 * the server stores it and quote requests snapshot it.
 */
export const MAX_ITEMS = 8;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

const PreviewImage = z.string().max(300_000).regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/);

export const DesignItemSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{4,16}$/),
    kind: z.enum(FAIR_KINDS),
    quantity: z.number().int().min(1).max(99).default(1),
    configuration: VisualizationConfigurationSchema.optional(),
    awning: AwningConfigurationSchema.optional(),
    options: z.object({ control: z.enum(CONTROL_KEYS).optional() }).strict().default({}),
    note: z.string().trim().max(500).optional(),
    image: PreviewImage.optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.kind === 'makasli') {
      if (!item.awning || item.configuration) ctx.addIssue({ code: 'custom', path: ['awning'], message: 'WINMAX needs its awning configuration' });
    } else if (!item.configuration || item.configuration.kind !== item.kind || item.awning) {
      ctx.addIssue({ code: 'custom', path: ['configuration'], message: 'Configuration does not match the product' });
    }
    const problem = limitProblem(item as DesignItem);
    if (problem) ctx.addIssue({ code: 'custom', path: [problem], message: 'Size outside the configured range' });
    const rule = fairProduct(item.kind);
    if (item.options?.control && !rule.controls.includes(item.options.control))
      ctx.addIssue({ code: 'custom', path: ['options', 'control'], message: 'Control option not offered for this product' });
  });
export type DesignItem = z.infer<typeof DesignItemSchema>;
export const DesignItemsSchema = z.array(DesignItemSchema).min(1).max(MAX_ITEMS);
export const LocaleSchema = z.enum(LOCALES);

export function sizes(item: Pick<DesignItem, 'kind' | 'configuration' | 'awning'>): Record<SizeKey, number> {
  if (item.kind === 'makasli') {
    const a = item.awning!;
    return { widthMm: a.widthMm, projectionMm: a.projectionMm, heightMm: a.mountingHeightMm };
  }
  const c = item.configuration!;
  return { widthMm: c.widthMm, projectionMm: c.projectionMm, heightMm: c.heightMm };
}

/** The first size outside a configured rule (FAIR_PRODUCTS[].limits), or null. */
export function limitProblem(item: Pick<DesignItem, 'kind' | 'configuration' | 'awning'>): SizeKey | null {
  const limits = fairProduct(item.kind)?.limits;
  if (!limits || (!item.configuration && !item.awning)) return null;
  const s = sizes(item);
  for (const [key, range] of Object.entries(limits) as Array<[SizeKey, [number, number]]>) if (s[key] < range[0] || s[key] > range[1]) return key;
  return null;
}

export const newItemId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join('');

/** 128 random bits, URL-safe: the design link is the only key to a design. */
export function newToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16))).slice(0, 22);
}
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Sand beige: the off-white default fabric disappears against the light 3D floor on a fair screen. */
const FAIR_FABRIC = FABRIC_COLORS[1];

export function newItem(kind: FairKind): DesignItem {
  const base = { id: newItemId(), kind, quantity: 1, options: {} };
  if (kind === 'makasli') return { ...base, awning: { ...DEFAULT_AWNING, fabricName: FAIR_FABRIC[0], fabricColor: FAIR_FABRIC[1] } as AwningConfiguration };
  const configuration = defaultVisualization(kind as ProductKind) as VisualizationConfiguration;
  return { ...base, configuration: kind === 'pergola' || kind === 'zip' ? { ...configuration, fabricColor: FAIR_FABRIC[1] } : configuration };
}

/** "White (#e9e9e4)" for a palette colour (just "White" for visitors), the hex code for a custom one. */
function colorLabel(locale: Locale, hex: string, withHex: boolean) {
  const named = [...BODY_COLORS, ...FABRIC_COLORS].find(([, value]) => value.toLowerCase() === hex.toLowerCase());
  if (!named) return hex;
  return withHex ? `${colorName(locale, named[0])} (${hex})` : colorName(locale, named[0]);
}

const isRoof =(item: Pick<DesignItem, 'kind'>) => item.kind === 'makasli' || productMeta(item.kind as ProductKind).category === 'roof';

/** "6000 × 4000 mm": width × projection for roofs and awnings, width × height otherwise. */
export function itemSize(item: Pick<DesignItem, 'kind' | 'configuration' | 'awning'>) {
  const s = sizes(item);
  return `${s.widthMm} × ${isRoof(item) ? s.projectionMm : s.heightMm} mm`;
}

export function itemSummary(locale: Locale, item: Pick<DesignItem, 'kind' | 'quantity' | 'configuration' | 'awning'>) {
  const s = sizes(item);
  return `${item.quantity > 1 ? `${item.quantity} × ` : ''}${productName(locale, item.kind)} · ${s.widthMm} × ${isRoof(item) ? s.projectionMm : s.heightMm} mm`;
}

/** Label/value rows of an item. Sales sees colour codes; visitors (screens, e-mail) see colour names only. */
export function itemSpecs(locale: Locale, item: DesignItem, { withHex = true }: { withHex?: boolean } = {}): Array<[string, string]> {
  const t = configuratorText(locale, item.kind) as ReturnType<typeof configuratorText> & Record<string, any>;
  const f = fairText(locale);
  const n = (v: number) => `${v.toLocaleString(INTL_LOCALE[locale])} mm`;
  const s = sizes(item);
  const rows: Array<[string, string]> = [[t.width!, n(s.widthMm)]];
  if (isRoof(item)) rows.push([t.projection!, n(s.projectionMm)], [t.mountingHeight!, n(s.heightMm)]);
  else rows.push([t.height!, n(s.heightMm)]);
  if (item.kind === 'makasli') {
    const a = item.awning!;
    const named = (name: string, hex: string) => (withHex ? `${colorName(locale, name)} (${hex})` : colorName(locale, name));
    rows.push([t.bodyColor!, named(a.bodyName, a.bodyColor)], [t.fabricColor!, named(a.fabricName, a.fabricColor)]);
    rows.push([t.motor!, a.motor === 'remote_wall' ? t.motorRemoteWall! : t.motorRemote!]);
    rows.push([t.led!, a.led === 'off' ? t.ledOff! : `${a.led === 'warm' ? t.ledWarm : t.ledWhite} · ${a.brightness}%`]);
  } else {
    const c = item.configuration!;
    const meta = productMeta(c.kind);
    rows.push([t.bodyColor!, colorLabel(locale, c.bodyColor, withHex)]);
    if (c.kind === 'pergola' || c.kind === 'zip') rows.push([t.fabricColor!, colorLabel(locale, c.fabricColor, withHex)]);
    if (c.kind === 'zip') rows.push([t.fabricType!, c.screen === 'opaque' ? t.opaque! : t.screen!]);
    if (['giyotin', 'wind-manual', 'glass-roof', 'winter-garden'].includes(c.kind)) rows.push([t.glass!, c.glass === 'insulated' ? t.insulatedGlass! : t.singleGlass!]);
    if (meta.category === 'roof' || c.kind.startsWith('wind-'))
      rows.push([t.mounting!, meta.category === 'roof' ? (c.mounting === 'wall' ? t.wallMounted! : t.freeStanding!) : c.mounting === 'planter' ? t.planter! : t.floorFixed!]);
    if (meta.category === 'roof' && c.kind !== 'glass-roof' && c.kind !== 'winter-garden')
      rows.push([t.led!, c.led === 'off' ? t.ledOff! : `${c.led === 'warm' ? t.ledWarm : t.ledWhite} · ${c.brightness}%`]);
  }
  if (item.options?.control) rows.push([f.control, CONTROL_LABELS[locale][item.options.control]]);
  if (item.quantity > 1) rows.push([f.quantity, String(item.quantity)]);
  if (item.note) rows.push([f.otherRequests.replace(/ \(.*\)$/, ''), item.note]);
  return rows;
}

/** A visitor's view of an item's choices: the specs without the size rows (shown as the heading) and colour codes. */
export function itemChoices(locale: Locale, item: DesignItem): Array<[string, string]> {
  return itemSpecs(locale, item, { withHex: false }).slice(isRoof(item) ? 3 : 2);
}
