import { PRODUCT_CATALOG, ProductKindSchema, type ProductKind } from '@/lib/features/product-3d/catalog';

export const FAIR_KINDS = ['makasli', ...ProductKindSchema.options] as const;
export type FairKind = 'makasli' | ProductKind;

/**
 * Configurable product rules for the public configurator. Nothing here is a technical approval:
 *
 * - Sizes: by default each product keeps the range its 3D model accepts (WINMAX: 2500–15000 ×
 *   1500–5000 × 2200–4500 mm; others: PRODUCT_CATALOG.viewMax). Set `limits` to narrow a range
 *   once Renk confirms the production limits; validation then applies on the device and the server.
 * - Drive/control: WINMAX carries its motor choice in its own configuration (UBESER remote / remote
 *   + wall switch). For the other products the commercial choices are not documented in the
 *   sources, so `controls` is empty and nothing is asked; add keys from CONTROL_KEYS to offer them.
 */
export type SizeKey = 'widthMm' | 'projectionMm' | 'heightMm';
export type FairProductRule = {
  kind: FairKind;
  category: 'roof' | 'glass' | 'screen';
  controls: readonly ControlKey[];
  limits?: Partial<Record<SizeKey, [number, number]>>;
};
export const CONTROL_KEYS = ['manual', 'motor-remote', 'motor-remote-wall', 'motor-smart'] as const;
export type ControlKey = (typeof CONTROL_KEYS)[number];
export const CONTROL_LABELS: Record<'en' | 'de' | 'tr', Record<ControlKey, string>> = {
  en: { manual: 'Manual', 'motor-remote': 'Motor with remote', 'motor-remote-wall': 'Motor with remote + wall switch', 'motor-smart': 'Motor with smart-home control' },
  de: { manual: 'Manuell', 'motor-remote': 'Motor mit Fernbedienung', 'motor-remote-wall': 'Motor mit Fernbedienung + Wandtaster', 'motor-smart': 'Motor mit Smart-Home-Steuerung' },
  tr: { manual: 'Manuel', 'motor-remote': 'Motorlu, kumandalı', 'motor-remote-wall': 'Motorlu, kumanda + duvar butonu', 'motor-smart': 'Motorlu, akıllı ev kontrolü' },
};

export const FAIR_PRODUCTS: readonly FairProductRule[] = [
  { kind: 'makasli', category: 'screen', controls: [] },
  ...PRODUCT_CATALOG.map((p) => ({ kind: p.kind, category: p.category, controls: [] as ControlKey[] })),
];
export const fairProduct = (kind: FairKind) => FAIR_PRODUCTS.find((p) => p.kind === kind)!;
