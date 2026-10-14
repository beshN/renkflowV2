import { PRODUCT_CATALOG, defaultVisualization, type ProductVisualization } from './catalog';
import { applyInlineVisualization, selectedProduct, type InlineProduct } from './inline';
import { DEFAULT_AWNING, applyAwning, type AwningConfiguration } from '../awning/configuration';

export const PRODUCT_OPTIONS = [{ kind: 'makasli' as const, name: 'WINMAX Makaslı Tente' }, ...PRODUCT_CATALOG];
const normalize = (value: string) => value.trim().toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
export function productSuggestions(query: string) {
  const q = normalize(query);
  if (q.length < 2) return [];
  return PRODUCT_OPTIONS.filter(p => normalize(p.name).includes(q) || normalize(p.kind).includes(q));
}
/** Product identity changes invalidate the old recipe, while commercial fields remain intact. */
type ProductFields = {
  productName: string; heightMm?: number; widthMm?: number; projectionMm?: number;
  mountingHeightMm?: number; color?: string; motorType?: string; ledType?: string; fabricType?: string;
  productVisualization?: ProductVisualization | null; awningConfiguration?: AwningConfiguration | null;
  productConfiguration?: unknown; awningPreview?: string;
};
export function applyProductSelection<T extends ProductFields>(entry: T, kind: InlineProduct) {
  if (kind && selectedProduct(entry) === kind && (entry.awningConfiguration || entry.productVisualization || entry.productConfiguration)) return { ...entry, productName: PRODUCT_OPTIONS.find(p => p.kind === kind)!.name };
  const plain = { ...entry, heightMm: undefined, productConfiguration: undefined, productVisualization: undefined, awningConfiguration: undefined, awningPreview: undefined };
  if (!kind) return { ...plain, productName: '', widthMm: undefined, heightMm: undefined, projectionMm: undefined, mountingHeightMm: undefined, color: undefined };
  if (kind === 'makasli') return applyAwning({ ...plain, productName: 'WINMAX Makaslı Tente' }, DEFAULT_AWNING);
  const product = PRODUCT_OPTIONS.find(p => p.kind === kind)!;
  return applyInlineVisualization({ ...plain, productName: product.name }, { configuration: defaultVisualization(kind) });
}
