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
  extraFields: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'date';
    placeholder?: string;
    required?: boolean;
    options?: string[];
  }[];
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
    extraFields: [
      { key: 'material', label: 'Malzeme Tipi', type: 'text', placeholder: 'Orn: Masif, MDF', required: true },
      { key: 'color', label: 'Renk', type: 'text', placeholder: 'Orn: Ceviz', required: true },
      { key: 'dimensions', label: 'Olcu', type: 'text', placeholder: 'Orn: 120x200x45 cm' },
      { key: 'finish', label: 'Yuzey Isleme', type: 'select', options: ['Mat', 'Parlak', 'Lake', 'Vernik'] },
    ],
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
    extraFields: [
      { key: 'fabric', label: 'Kumas', type: 'text', placeholder: 'Orn: Pamuk, Keten', required: true },
      { key: 'sizeRun', label: 'Beden Dagilimi', type: 'text', placeholder: 'Orn: S:10 M:20 L:10' },
      { key: 'color', label: 'Renk', type: 'text', placeholder: 'Orn: Lacivert' },
      { key: 'wash', label: 'Yikama Talimati', type: 'select', options: ['30C', '40C', 'Kuru Temizleme'] },
    ],
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
    extraFields: [
      { key: 'channel', label: 'Kanal', type: 'select', options: ['Outdoor', 'Digital', 'TV', 'Sosyal Medya'] },
      { key: 'budget', label: 'Medya Butcesi (TL)', type: 'number', placeholder: 'Orn: 150000' },
      { key: 'deadline', label: 'Onay Tarihi', type: 'date' },
      { key: 'audience', label: 'Hedef Kitle', type: 'text', placeholder: 'Orn: 25-40' },
    ],
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
    extraFields: [
      { key: 'site', label: 'Saha Lokasyonu', type: 'text', placeholder: 'Orn: Beylikduzu' },
      { key: 'phase', label: 'Proje Asamasi', type: 'select', options: ['Kesif', 'Uygulama', 'Kontrol', 'Teslim'] },
      { key: 'contact', label: 'Saha Sorumlusu', type: 'text', placeholder: 'Orn: Mehmet Kaya' },
      { key: 'scope', label: 'Metraj / Scope', type: 'text', placeholder: 'Orn: 120 m2' },
    ],
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
    extraFields: [
      { key: 'platform', label: 'Platform', type: 'select', options: ['Web', 'iOS', 'Android', 'Full-stack'] },
      { key: 'tech', label: 'Teknoloji', type: 'text', placeholder: 'Orn: Next.js, Node.js' },
      { key: 'sprint', label: 'Sprint Sayisi', type: 'number', placeholder: 'Orn: 4' },
      { key: 'release', label: 'Go-live Tarihi', type: 'date' },
    ],
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
    extraFields: [
      { key: 'priority', label: 'Oncelik', type: 'select', options: ['Dusuk', 'Orta', 'Yuksek'] },
      { key: 'owner', label: 'Sorumlu Kisi', type: 'text', placeholder: 'Orn: Ayse Demir' },
      { key: 'channel', label: 'Gelis Kanali', type: 'select', options: ['Referans', 'Web', 'Telefon'] },
      { key: 'budget', label: 'Butce', type: 'number', placeholder: 'Orn: 50000' },
    ],
  },
];

export const TEMPLATE_BY_KEY = TEMPLATE_DEFINITIONS.reduce((acc, template) => {
  acc[template.key] = template;
  return acc;
}, {} as Record<TemplateKey, TemplateDefinition>);

export const DEFAULT_TEMPLATE_KEY: TemplateKey = 'mobilya';
