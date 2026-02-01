export type TemplateKey =
  | 'mobilya'
  | 'tekstil'
  | 'reklam'
  | 'insaat'
  | 'yazilim'
  | 'diger';

export interface TemplateDefinition {
  key: TemplateKey;
  industry: string;
  title: string;
  description: string;
  productLabel: string;
  productPlaceholder: string;
  quantityLabel: string;
  totalLabel: string;
  deliveryLabel: string;
  notesLabel: string;
  departmentLabel: string;
  departments: { id: string; name: string; color: string }[];
  documentHint: string;
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    key: 'mobilya',
    industry: 'Mobilya Atolyesi',
    title: 'Mobilya Uretim Akisi',
    description: 'Kesim, montaj ve teslim sureclerini odak alan siparis sablonu.',
    productLabel: 'Urun Adi',
    productPlaceholder: 'Orn: Ozel Tasarim Koltuk',
    quantityLabel: 'Adet',
    totalLabel: 'Toplam Tutar (TL)',
    deliveryLabel: 'Teslim Tarihi',
    notesLabel: 'Uretim Notlari',
    departmentLabel: 'Uretim Bolumu',
    departments: [
      { id: 'kesim', name: 'Kesim', color: '#EF4444' },
      { id: 'montaj', name: 'Montaj', color: '#3B82F6' },
      { id: 'boya', name: 'Boya', color: '#8B5CF6' },
      { id: 'paketleme', name: 'Paketleme', color: '#F59E0B' },
    ],
    documentHint: 'Teknik cizim, olcu listesi, malzeme listesi ekleyin.',
  },
  {
    key: 'tekstil',
    industry: 'Tekstil Uretimi',
    title: 'Tekstil Siparis Akisi',
    description: 'Koleksiyon, kalip ve uretim adimlarini hizlandirin.',
    productLabel: 'Model Adi',
    productPlaceholder: 'Orn: Yaz Koleksiyonu Elbise',
    quantityLabel: 'Uretim Adedi',
    totalLabel: 'Toplam Tutar (TL)',
    deliveryLabel: 'Sevkiyat Tarihi',
    notesLabel: 'Kumas ve dikim notlari',
    departmentLabel: 'Uretim Hatti',
    departments: [
      { id: 'kesim', name: 'Kesim', color: '#F97316' },
      { id: 'dikim', name: 'Dikim', color: '#6366F1' },
      { id: 'kalite', name: 'Kalite', color: '#10B981' },
      { id: 'paket', name: 'Paket', color: '#0EA5E9' },
    ],
    documentHint: 'Kalip, beden tablosu ve kumas detaylarini ekleyin.',
  },
  {
    key: 'reklam',
    industry: 'Reklam Ajansi',
    title: 'Kampanya Takip Akisi',
    description: 'Brief, kreatif ve teslim sureclerini standardize edin.',
    productLabel: 'Kampanya Adi',
    productPlaceholder: 'Orn: Bahar Lansman Kampanyasi',
    quantityLabel: 'Cikti Adedi',
    totalLabel: 'Butce (TL)',
    deliveryLabel: 'Yayin Tarihi',
    notesLabel: 'Brief Notlari',
    departmentLabel: 'Takim',
    departments: [
      { id: 'strateji', name: 'Strateji', color: '#22C55E' },
      { id: 'kreatif', name: 'Kreatif', color: '#A855F7' },
      { id: 'produksiyon', name: 'Produksiyon', color: '#F97316' },
      { id: 'medya', name: 'Medya', color: '#0EA5E9' },
    ],
    documentHint: 'Brief, moodboard ve teslim planini yukleyin.',
  },
  {
    key: 'insaat',
    industry: 'Insaat & Proje',
    title: 'Proje Takip Akisi',
    description: 'Metraj, saha ve teslim kontrolunu tek yerde yonetin.',
    productLabel: 'Proje Basligi',
    productPlaceholder: 'Orn: Villa Ic Mekan Uygulamasi',
    quantityLabel: 'Is Kalemi',
    totalLabel: 'Teklif Bedeli (TL)',
    deliveryLabel: 'Teslim / Asama Tarihi',
    notesLabel: 'Saha Notlari',
    departmentLabel: 'Saha Ekibi',
    departments: [
      { id: 'kesif', name: 'Kesif', color: '#14B8A6' },
      { id: 'tasarim', name: 'Tasarim', color: '#6366F1' },
      { id: 'saha', name: 'Saha', color: '#F59E0B' },
      { id: 'teslim', name: 'Teslim', color: '#22C55E' },
    ],
    documentHint: 'Metraj listesi, sozlesme ve saha raporu ekleyin.',
  },
  {
    key: 'yazilim',
    industry: 'Yazilim & Ajans',
    title: 'Proje & Sprint Akisi',
    description: 'Sprint, teslim ve musteri onaylarina uygun akis.',
    productLabel: 'Proje Adi',
    productPlaceholder: 'Orn: E-Ticaret Web Sitesi',
    quantityLabel: 'Scope / Modul',
    totalLabel: 'Proje Bedeli (TL)',
    deliveryLabel: 'Go-live Tarihi',
    notesLabel: 'Scope Notlari',
    departmentLabel: 'Takim',
    departments: [
      { id: 'product', name: 'Product', color: '#0EA5E9' },
      { id: 'design', name: 'Design', color: '#A855F7' },
      { id: 'dev', name: 'Development', color: '#22C55E' },
      { id: 'qa', name: 'QA', color: '#F97316' },
    ],
    documentHint: 'Scope dokumani, wireframe ve teknik gereksinimleri ekleyin.',
  },
  {
    key: 'diger',
    industry: 'Diger',
    title: 'Genel Is Akisi',
    description: 'Her sektor icin esnek siparis sablonu.',
    productLabel: 'Is / Siparis Adi',
    productPlaceholder: 'Orn: Ozel Proje',
    quantityLabel: 'Miktar',
    totalLabel: 'Toplam Tutar (TL)',
    deliveryLabel: 'Teslim Tarihi',
    notesLabel: 'Notlar',
    departmentLabel: 'Departman',
    departments: [
      { id: 'planlama', name: 'Planlama', color: '#0EA5E9' },
      { id: 'uretim', name: 'Uretim', color: '#22C55E' },
      { id: 'kontrol', name: 'Kontrol', color: '#F97316' },
      { id: 'teslim', name: 'Teslim', color: '#A855F7' },
    ],
    documentHint: 'Gerekli teknik dosyalari ekleyin.',
  },
];

export const TEMPLATE_BY_KEY = TEMPLATE_DEFINITIONS.reduce((acc, template) => {
  acc[template.key] = template;
  return acc;
}, {} as Record<TemplateKey, TemplateDefinition>);

export const DEFAULT_TEMPLATE_KEY: TemplateKey = 'mobilya';
