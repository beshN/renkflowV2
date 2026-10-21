/**
 * AI office: the kinds of work a person can hand over and the staff who take them. A task's
 * category decides who picks it up; which model a category runs on is set later (AI settings),
 * the `needs` list says what that model must be able to do.
 */

export const TASK_CATEGORIES = ['design', 'document', 'spreadsheet', 'presentation', 'research', 'correspondence', 'translation', 'data'] as const;
export type TaskCategoryId = (typeof TASK_CATEGORIES)[number];

/** What a category's model must do; image means generating pictures, not reading them. */
export type Capability = 'text' | 'image' | 'files' | 'web';

export type TaskCategory = {
  id: TaskCategoryId;
  label: string;
  hint: string;
  /** The output the person receives, shown in deliveries. */
  output: { kind: string; extension: string };
  needs: Capability[];
  /** Seconds a desk session lasts in the simulation until a model reports real progress. */
  workSeconds: number;
  /** Shown in the technical feed as the work moves on. */
  steps: string[];
  examples: string[];
};

export const CATEGORY: Record<TaskCategoryId, TaskCategory> = {
  design: {
    id: 'design', label: 'Grafik tasarım', hint: 'Afiş, sosyal medya görseli, logo taslağı, katalog sayfası',
    output: { kind: 'Görsel', extension: 'png' }, needs: ['text', 'image'], workSeconds: 26,
    steps: ['Brif ve marka kiti okunuyor', 'Düzen taslağı çiziliyor', 'Görsel üretiliyor', 'Metin ve logo yerleştiriliyor', 'Baskı ve ekran boyutları dışa aktarılıyor'],
    examples: ['Yeni pergola serisi için Instagram gönderisi', 'Fuar standı için A1 afiş', 'Kartvizit tasarımı'],
  },
  document: {
    id: 'document', label: 'Belge (Word / PDF)', hint: 'Yazıyı Word belgesine çevirme, rapor, sözleşme taslağı, dilekçe',
    output: { kind: 'Word belgesi', extension: 'docx' }, needs: ['text', 'files'], workSeconds: 18,
    steps: ['Metin okunuyor', 'Başlık yapısı kuruluyor', 'Biçim ve şablon uygulanıyor', 'Belge oluşturuluyor'],
    examples: ['Bu notları resmi bir yazıya dönüştür', 'Montaj garanti belgesi taslağı', 'Toplantı tutanağını Word yap'],
  },
  spreadsheet: {
    id: 'spreadsheet', label: 'Excel tablosu', hint: 'Tablo oluşturma, hesaplama, fiyat listesi, karşılaştırma',
    output: { kind: 'Excel tablosu', extension: 'xlsx' }, needs: ['text', 'files'], workSeconds: 20,
    steps: ['Veri toplanıyor', 'Sütunlar ve formüller kuruluyor', 'Toplamlar hesaplanıyor', 'Biçimlendirme ve grafik ekleniyor'],
    examples: ['Tedarikçi fiyatlarını karşılaştıran tablo', 'Aylık gider tablosu', 'Profil ölçülerine göre kesim listesi'],
  },
  presentation: {
    id: 'presentation', label: 'Sunum', hint: 'Müşteri sunumu, ürün tanıtımı, toplantı slaytları',
    output: { kind: 'Sunum', extension: 'pptx' }, needs: ['text', 'image', 'files'], workSeconds: 24,
    steps: ['Anlatı akışı çıkarılıyor', 'Slayt başlıkları yazılıyor', 'Görseller hazırlanıyor', 'Slaytlar dizilip dışa aktarılıyor'],
    examples: ['Bayi toplantısı için 10 slaytlık sunum', 'Yeni ürün tanıtım sunumu'],
  },
  research: {
    id: 'research', label: 'Araştırma ve rapor', hint: 'Pazar, rakip, tedarikçi araştırması; kaynaklı rapor',
    output: { kind: 'Rapor', extension: 'pdf' }, needs: ['text', 'web', 'files'], workSeconds: 28,
    steps: ['Soru netleştiriliyor', 'Kaynaklar taranıyor', 'Bulgular karşılaştırılıyor', 'Rapor yazılıyor', 'Kaynakça ekleniyor'],
    examples: ['Bölgedeki alüminyum doğrama rakipleri', 'Cam balkon pazarında fiyat aralıkları'],
  },
  correspondence: {
    id: 'correspondence', label: 'Yazışma ve e-posta', hint: 'Müşteri e-postası, duyuru, resmi yazı, cevap taslağı',
    output: { kind: 'E-posta taslağı', extension: 'txt' }, needs: ['text'], workSeconds: 12,
    steps: ['Bağlam okunuyor', 'Taslak yazılıyor', 'Ton ve imla kontrol ediliyor'],
    examples: ['Geciken teslimat için müşteriye özür e-postası', 'Bayram tatili duyurusu'],
  },
  translation: {
    id: 'translation', label: 'Çeviri', hint: 'Belge, katalog, e-posta çevirisi',
    output: { kind: 'Çeviri', extension: 'docx' }, needs: ['text', 'files'], workSeconds: 14,
    steps: ['Kaynak metin bölümleniyor', 'Çevriliyor', 'Terimler kontrol ediliyor'],
    examples: ['Ürün kataloğunu İngilizceye çevir', 'Almanca teklif e-postasını Türkçeye çevir'],
  },
  data: {
    id: 'data', label: 'Veri girişi ve düzenleme', hint: 'PDF/görselden tabloya aktarma, liste temizleme, birleştirme',
    output: { kind: 'Düzenlenmiş liste', extension: 'xlsx' }, needs: ['text', 'files'], workSeconds: 16,
    steps: ['Kaynak dosya okunuyor', 'Alanlar ayrıştırılıyor', 'Tekrarlar temizleniyor', 'Liste dışa aktarılıyor'],
    examples: ['Kartvizit fotoğraflarından müşteri listesi', 'İki tedarikçi listesini birleştir'],
  },
};

export const isTaskCategory = (value: string): value is TaskCategoryId => (TASK_CATEGORIES as readonly string[]).includes(value);

export type HairStyle = 'short' | 'long' | 'bun' | 'buzz';
export type Look = { skin: string; hair: string; hairStyle: HairStyle; shirt: string; pants: string };

export type StaffMember = { id: string; name: string; title: string; role: TaskCategoryId | 'manager'; look: Look };

/** The office's starting staff: one manager who hands out work and one person per category. */
export const STAFF: StaffMember[] = [
  { id: 'manager', name: 'Kaan', title: 'Ofis müdürü', role: 'manager', look: { skin: '#e8b48f', hair: '#2b2118', hairStyle: 'short', shirt: '#334155', pants: '#1f2937' } },
  { id: 'deniz', name: 'Deniz', title: 'Grafik tasarımcı', role: 'design', look: { skin: '#f1c7a4', hair: '#d9572b', hairStyle: 'bun', shirt: '#f59e0b', pants: '#3f3f46' } },
  { id: 'elif', name: 'Elif', title: 'Belge uzmanı', role: 'document', look: { skin: '#f3cfb1', hair: '#5b3a24', hairStyle: 'long', shirt: '#2563eb', pants: '#27272a' } },
  { id: 'murat', name: 'Murat', title: 'Tablo uzmanı', role: 'spreadsheet', look: { skin: '#c98d65', hair: '#1c1917', hairStyle: 'buzz', shirt: '#16a34a', pants: '#374151' } },
  { id: 'zeynep', name: 'Zeynep', title: 'Sunum uzmanı', role: 'presentation', look: { skin: '#eab995', hair: '#111827', hairStyle: 'long', shirt: '#db2777', pants: '#1e293b' } },
  { id: 'kerem', name: 'Kerem', title: 'Araştırmacı', role: 'research', look: { skin: '#dba27a', hair: '#78350f', hairStyle: 'short', shirt: '#7c3aed', pants: '#334155' } },
  { id: 'selin', name: 'Selin', title: 'Yazışma sorumlusu', role: 'correspondence', look: { skin: '#f6d2b8', hair: '#c2a15a', hairStyle: 'bun', shirt: '#0891b2', pants: '#3f3f46' } },
  { id: 'can', name: 'Can', title: 'Çevirmen', role: 'translation', look: { skin: '#b97a55', hair: '#292524', hairStyle: 'short', shirt: '#ea580c', pants: '#1f2937' } },
  { id: 'aylin', name: 'Aylin', title: 'Veri sorumlusu', role: 'data', look: { skin: '#e9bf9c', hair: '#3f2a1d', hairStyle: 'long', shirt: '#65a30d', pants: '#27272a' } },
];
