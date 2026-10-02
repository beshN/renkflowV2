export type TemplateKey = 'aluminyum';
export interface TemplateDefinition {
  key: TemplateKey; industry: string; title: string; description: string;
  productLabel: string; productPlaceholder: string; quantityLabel: string;
  totalLabel: string; deliveryLabel: string; notesLabel: string; departmentLabel: string;
  departments: { id: string; name: string; color: string }[];
  documentHint: string;
  extraFields: {
    key: string; label: string; type: 'text' | 'number' | 'select' | 'date';
    placeholder?: string; required?: boolean; options?: string[];
  }[];
}
export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [{
  key: 'aluminyum', industry: 'Alüminyum üretimi',
  title: 'Renk Alüminyum üretim akışı',
  description: 'Sipariş, profil hazırlığı, kesim, montaj ve sevkiyat.',
  productLabel: 'Ürün / sistem', productPlaceholder: 'Örn: Alüminyum sürme doğrama',
  quantityLabel: 'Adet', totalLabel: 'Sipariş tutarı', deliveryLabel: 'Termin tarihi',
  notesLabel: 'Üretim notları', departmentLabel: 'Üretim bölümü',
  departments: [
    { id: 'planlama', name: 'Planlama', color: '#475569' },
    { id: 'kesim', name: 'Profil kesim', color: '#2563EB' },
    { id: 'isleme', name: 'İşleme', color: '#0891B2' },
    { id: 'montaj', name: 'Montaj', color: '#0D9488' },
    { id: 'kalite', name: 'Kalite kontrol', color: '#D97706' },
    { id: 'sevkiyat', name: 'Paketleme / sevkiyat', color: '#16A34A' },
  ],
  documentHint: 'Müşteri sipariş PDF’i, ölçü listesi ve teknik çizimleri ekleyin.',
  extraFields: [
    { key: 'profile', label: 'Profil kodu / seri', type: 'text', placeholder: 'Örn: 40×40 / sistem kodu' },
    { key: 'color', label: 'RAL renk / yüzey', type: 'text', placeholder: 'Örn: RAL 7016 mat' },
    { key: 'dimensions', label: 'Ölçü (mm)', type: 'text', placeholder: 'Örn: 2400 × 2100 mm' },
    { key: 'finish', label: 'Yüzey işlemi', type: 'select', options: ['Elektrostatik boya', 'Eloksal', 'Ham alüminyum'] },
  ],
}];
export const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATE_DEFINITIONS.map(template =>
  [template.key, template]
)) as Record<TemplateKey, TemplateDefinition>;
export const DEFAULT_TEMPLATE_KEY: TemplateKey = 'aluminyum';
