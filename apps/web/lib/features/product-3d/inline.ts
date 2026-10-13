import { PRODUCT_CATALOG, type ProductKind, type ProductVisualization, attachVisualization, productMeta } from './catalog';
import { BODY_COLORS, type AwningConfiguration } from '../awning/configuration';

export function visualColorName(hex: string) {
  return BODY_COLORS.find(([, value]) => value.toLowerCase() === hex.toLowerCase())?.[0] ?? `Özel renk (${hex})`;
}

export type InlineProduct = ProductKind | 'makasli' | '';
export function selectedProduct(line: { productName?: string; productVisualization?: ProductVisualization | null; awningConfiguration?: AwningConfiguration | null }): InlineProduct {
  if (line.productVisualization) return line.productVisualization.configuration.kind;
  if (line.awningConfiguration) return 'makasli';
  const name = line.productName?.trim().toLocaleLowerCase('tr-TR');
  if (name === 'WINMAX Makaslı Tente'.toLocaleLowerCase('tr-TR') || name === 'makaslı tente') return 'makasli';
  if (name === 'pergola') return 'pergola';
  return PRODUCT_CATALOG.find(p => p.name.toLocaleLowerCase('tr-TR') === name)?.kind ?? '';
}

/** Explicit visual editing also sets the plain line's measures, keeping its price and quantity. */
export function applyInlineVisualization<T extends { productName: string; unitPrice?: number }>(line: T, value: ProductVisualization) {
  const c = value.configuration;
  const roof = productMeta(c.kind).category === 'roof';
  return {
    ...attachVisualization(line, value),
    widthMm: c.widthMm,
    heightMm: c.heightMm,
    projectionMm: roof ? c.projectionMm : undefined,
    mountingHeightMm: roof ? c.heightMm : undefined,
    color: visualColorName(c.bodyColor),
  };
}
