/**
 * Configured product families. A family names its dimensions and the profile codes its recipe is
 * built from; the recipe (BOM rules) and the price matrix are the firm's own data, imported per
 * family. Adding giyotin cam, makaslı tente or alüminyum tavan is one entry here plus its data.
 */
export type DimensionKey = 'widthMm' | 'projectionMm' | 'mountingHeightMm';

export type ProductFamily = {
  key: string;
  label: string;
  /** The measures a quote asks for, in the recipe engine's terms, with the words the trade uses. */
  dimensions: Array<{ key: DimensionKey; label: string }>;
  /** The two measures a price matrix is banded by (first is the "en" column, second the "açılım"). */
  priceAxes: [DimensionKey, DimensionKey];
  /** Profile codes of the family's stock cards, as on the count list. */
  profileCodes: readonly string[];
  geometry?:'roof'|'vertical';
};

export const PRODUCT_FAMILIES: readonly ProductFamily[] = [
  {key:'makasli',label:'Makaslı tente',dimensions:[{key:'widthMm',label:'En (mm)'},{key:'projectionMm',label:'Açılım (mm)'},{key:'mountingHeightMm',label:'Montaj yüksekliği (mm)'}],priceAxes:['widthMm','projectionMm'],profileCodes:['170']},
  {
    key: 'pergola',
    label: 'Pergola',
    dimensions: [
      { key: 'widthMm', label: 'En (mm)' },
      { key: 'projectionMm', label: 'Açılım (mm)' },
      { key: 'mountingHeightMm', label: 'Yükseklik (mm)' },
    ],
    priceAxes: ['widthMm', 'projectionMm'],
    profileCodes: ['108', '107', '6056', '5979', '187', '164', '5980', '6017', '6015', '330'],
  },
  ...(['wind-manual','wind-piston','giyotin'] as const).map(key=>({key,label:key==='wind-manual'?'Manuel rüzgâr kırıcı':key==='wind-piston'?'Pistonlu rüzgâr kırıcı':'Motorlu giyotin',geometry:'vertical' as const,dimensions:[{key:'widthMm' as const,label:'En (mm)'},{key:'mountingHeightMm' as const,label:'Ürün yüksekliği (mm)'}],priceAxes:['widthMm','mountingHeightMm'] as [DimensionKey,DimensionKey],profileCodes:[]})),
];

export const productFamily = (key: string) => PRODUCT_FAMILIES.find((f) => f.key === key) ?? null;
