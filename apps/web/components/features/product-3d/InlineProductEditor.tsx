'use client';
import { AwningConfigurator } from '@/components/features/awning/AwningConfigurator';
import type { AwningConfiguration } from '@/lib/features/awning/configuration';
import { PRODUCT_CATALOG, type ProductVisualization } from '@/lib/features/product-3d/catalog';
import { selectedProduct, type InlineProduct } from '@/lib/features/product-3d/inline';
import { ProductConfigurator } from './ProductConfigurator';

export function InlineProductEditor({ productName, visualization, awningConfiguration, previewImage, readOnly = false, label = 'Ürün', onSelect, onChange, onChangeAwning, onValidationChange }: {
  productName: string;
  visualization?: ProductVisualization | null;
  awningConfiguration?: AwningConfiguration | null;
  previewImage?: string | null;
  readOnly?: boolean;
  label?: string;
  onSelect?: (kind: InlineProduct) => void;
  onChange?: (value: ProductVisualization) => void;
  onChangeAwning?: (value: AwningConfiguration, image?: string) => void;
  onValidationChange?: (message: string) => void;
}) {
  const selected = selectedProduct({ productName, productVisualization: visualization, awningConfiguration });
  return <div className="min-w-0 space-y-4" role="group" aria-label={`${label} yapılandırması`}>
    {!readOnly && <label className="block text-xs font-medium">{label}
      <select aria-label={label} className="rf-input mt-2 w-full" value={selected} onChange={e => onSelect?.(e.target.value as InlineProduct)}>
        <option value="">Özel ürün / diğer</option>
        <option value="makasli">WINMAX Makaslı Tente</option>
        {PRODUCT_CATALOG.map(p => <option key={p.kind} value={p.kind}>{p.name}</option>)}
      </select>
    </label>}
    {selected === 'makasli' ? <AwningConfigurator key="makasli" value={awningConfiguration ?? undefined} previewImage={previewImage ?? undefined} readOnly={readOnly} onChange={onChangeAwning} onValidationChange={onValidationChange} />
      : selected ? <ProductConfigurator key={selected} kind={selected} value={visualization ?? undefined} readOnly={readOnly} onChange={onChange} onValidationChange={onValidationChange} /> : null}
  </div>;
}
