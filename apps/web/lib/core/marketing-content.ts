export type MarketingHighlight = {
  title: string;
  detail: string;
};

export type MarketingPageEntry = {
  badge: string;
  title: string;
  description: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  highlights: MarketingHighlight[];
};

export const marketingPages = {
  about: {
    badge: 'Hakkımızda',
    title: 'Alüminyum atölyesinin gerçek iş akışından doğan bir yazılım.',
    description:
      'RenkFlow, Renk Alüminyum’un sipariş masasından kesim tezgâhına kadar yaşadığı günlük sorunları çözmek için geliştirildi. Tablolar, defterler ve mesaj grupları yerine herkesin aynı veriye baktığı tek bir çalışma alanı.',
    primaryCta: { href: '/contact', label: 'Bizimle görüşün' },
    secondaryCta: { href: '/features', label: 'Özellikleri inceleyin' },
    highlights: [
      { title: 'Sahadan geliştirildi', detail: 'Her ekran, ofis ve üretim ekibinin gerçek kullanımında test edilerek şekillendi.' },
      { title: 'Tek kaynak', detail: 'Sipariş, stok ve sevkiyat bilgisi aynı kayıttan okunur; kopya tablo tutulmaz.' },
      { title: 'Uzun vadeli', detail: 'Platform, firmanın büyümesine göre yeni modüllerle genişleyecek şekilde tasarlandı.' },
    ],
  },
  features: {
    badge: 'Özellikler',
    title: 'Siparişten sevkiyata, üretimin her adımı için bir modül.',
    description:
      'Teklif hazırlamaktan profil kesimine, raf yönetiminden faturaya kadar alüminyum üretiminin bütün halkaları birbirine bağlı çalışır.',
    primaryCta: { href: '/contact', label: 'Demo talep edin' },
    secondaryCta: { href: '/docs', label: 'Dokümantasyon' },
    highlights: [
      { title: 'Sipariş yönetimi', detail: 'Ölçüler, RAL/yüzey, seri ve teknik çizimler siparişle birlikte saklanır. Durum her aşamada güncellenir.' },
      { title: 'Kesim optimizasyonu', detail: 'Profil boylarına göre kesim planı çıkarılır, fire ve artık parçalar kayda geçer.' },
      { title: 'Üretim ve iş emirleri', detail: 'İstasyon yükü, operasyon süresi ve darboğazlar canlı izlenir. Usta ekranı sahada kullanıma uygundur.' },
      { title: 'Depo ve raf takibi', detail: 'Her profil ve aksesuar rafıyla birlikte tutulur. QR etiketle giriş, çıkış ve sayım yapılır.' },
      { title: 'Satın alma ve mal kabul', detail: 'Tedarikçi siparişleri, kısmi teslimler ve stok girişleri birbirine bağlıdır.' },
      { title: 'Finans ve raporlama', detail: 'Teklif, fatura, tahsilat ve sipariş kârlılığı aynı ekranda; dışa aktarım CSV olarak alınır.' },
    ],
  },
  pricing: {
    badge: 'Fiyatlandırma',
    title: 'Firmanızın ölçeğine göre hazırlanan teklif.',
    description:
      'Kullanıcı sayısı, modüller ve kurulum desteğine göre size özel bir teklif hazırlıyoruz. Gizli ücret veya kullanım başına sürpriz maliyet yok.',
    primaryCta: { href: '/contact', label: 'Teklif isteyin' },
    secondaryCta: { href: '/features', label: 'Modülleri karşılaştırın' },
    highlights: [
      { title: 'Net kapsam', detail: 'Teklifte hangi modüllerin, kaç kullanıcının ve hangi destek seviyesinin dahil olduğu açıkça yazar.' },
      { title: 'Kurulum dahil', detail: 'Mevcut müşteri, ürün ve stok listelerinizin aktarımında yanınızdayız.' },
      { title: 'Esnek sözleşme', detail: 'Aylık veya yıllık; ekip büyüdükçe kapsam birlikte güncellenir.' },
    ],
  },
  integrations: {
    badge: 'Entegrasyonlar',
    title: 'Kullandığınız sistemlerle konuşan bir altyapı.',
    description:
      'Muhasebe yazılımı, e-posta ve mesajlaşma kanalları, barkod yazıcıları ve tarayıcılarla çalışacak şekilde tasarlandı. Sürümlenmiş bir API ile kendi araçlarınızı bağlayabilirsiniz.',
    primaryCta: { href: '/contact', label: 'Entegrasyon görüşmesi' },
    secondaryCta: { href: '/docs', label: 'API dokümantasyonu' },
    highlights: [
      { title: 'REST API', detail: 'Sipariş, stok ve sevkiyat verisine sürümlenmiş uç noktalardan erişilir.' },
      { title: 'E-posta ve WhatsApp', detail: 'Gelen talepler taslak siparişe dönüşür; müşteri bildirimleri otomatik gönderilir.' },
      { title: 'Etiket ve barkod', detail: 'QR etiketleri doğrudan yazdırılır, el terminali ve kamera ile okutulur.' },
    ],
  },
  docs: {
    badge: 'Dokümantasyon',
    title: 'Kurulumdan günlük kullanıma kadar rehberler.',
    description:
      'Ofis, üretim ve yönetim kullanıcıları için ayrı rehberler; entegrasyon geliştiricileri için API referansı.',
    primaryCta: { href: '/contact', label: 'Destek alın' },
    secondaryCta: { href: '/changelog', label: 'Sürüm notları' },
    highlights: [
      { title: 'Rol bazlı rehberler', detail: 'Her kullanıcı yalnızca kendi işini ilgilendiren adımları görür.' },
      { title: 'API referansı', detail: 'Örnek istekler ve yanıtlarla birlikte uç nokta açıklamaları.' },
      { title: 'Geçiş notları', detail: 'Davranışı değiştiren her güncelleme adım adım açıklanır.' },
    ],
  },
  security: {
    badge: 'Güvenlik',
    title: 'Verileriniz yalnızca yetkili kişilere açık.',
    description:
      'Her kullanıcı rolüne göre yalnızca kendi işini görür. Kritik işlemler kayıt altına alınır, oturumlar ve giriş denemeleri sürekli denetlenir.',
    primaryCta: { href: '/contact', label: 'Güvenlik ekibiyle görüşün' },
    secondaryCta: { href: '/privacy', label: 'Gizlilik politikası' },
    highlights: [
      { title: 'Rol bazlı yetki', detail: 'Yönetici, ofis, muhasebe ve üretim rolleri farklı ekran ve işlemlere erişir.' },
      { title: 'Firma izolasyonu', detail: 'Her sorgu firma kimliğiyle sınırlandırılır; veriler birbirine karışmaz.' },
      { title: 'Denetim kaydı', detail: 'Sipariş, ödeme ve belge üzerindeki önemli işlemler kim, ne zaman bilgisiyle saklanır.' },
      { title: 'Giriş koruması', detail: 'Tekrarlanan başarısız denemeler sınırlandırılır, hesap varlığı dışarıya sızdırılmaz.' },
      { title: 'Güvenli dosyalar', detail: 'Teknik çizimler ve belgeler yalnızca yetkili oturumlarla açılır.' },
      { title: 'Şifreli bağlantı', detail: 'Tüm trafik HTTPS üzerinden, sıkı güvenlik başlıklarıyla sunulur.' },
    ],
  },
  roadmap: {
    badge: 'Yol haritası',
    title: 'Sırada ne var?',
    description: 'Önceliklerimizi sahadan gelen geri bildirimler belirliyor. Planlanan ve üzerinde çalışılan geliştirmeleri burada paylaşıyoruz.',
    primaryCta: { href: '/contact', label: 'Öneri gönderin' },
    secondaryCta: { href: '/changelog', label: 'Tamamlananlar' },
    highlights: [
      { title: 'Kapasite planlama', detail: 'İstasyon bazlı haftalık yük ve teslim tarihi tahmini.' },
      { title: 'Mobil saha uygulaması', detail: 'Usta ve depo ekipleri için çevrimdışı çalışabilen uygulama.' },
      { title: 'Gelişmiş raporlar', detail: 'Fire, verim ve kârlılık için dönemsel karşılaştırmalar.' },
    ],
  },
  changelog: {
    badge: 'Sürüm notları',
    title: 'Neler değişti?',
    description: 'Yayınlanan her güncelleme, etkilediği modüller ve yapmanız gereken bir şey varsa açıklamasıyla birlikte burada.',
    primaryCta: { href: '/blog', label: 'Ürün günlüğü' },
    secondaryCta: { href: '/roadmap', label: 'Yol haritası' },
    highlights: [
      { title: 'Modül bazında', detail: 'Her değişiklik ilgili modül başlığı altında listelenir.' },
      { title: 'Açık uyarılar', detail: 'Alışkanlıklarınızı etkileyen değişiklikler önceden duyurulur.' },
      { title: 'Düzeltilen hatalar', detail: 'Bildirdiğiniz sorunların ne zaman çözüldüğünü takip edebilirsiniz.' },
    ],
  },
  press: {
    badge: 'Basın',
    title: 'Basın ve medya kaynakları.',
    description: 'Logo dosyaları, ürün görselleri ve resmi duyurular için iletişim bilgileri.',
    primaryCta: { href: '/contact', label: 'Basın iletişimi' },
    secondaryCta: { href: '/about', label: 'Hakkımızda' },
    highlights: [
      { title: 'Marka dosyaları', detail: 'Logo ve kullanım kuralları talep üzerine paylaşılır.' },
      { title: 'Duyurular', detail: 'Ürün ve şirket haberleri tarih sırasıyla arşivlenir.' },
      { title: 'Röportaj talepleri', detail: 'Basın talepleriniz için doğrudan bir iletişim kanalı.' },
    ],
  },
  contact: {
    badge: 'İletişim',
    title: 'Konuşalım.',
    description: 'Demo talebi, teklif veya destek için bize yazın. İş günlerinde aynı gün içinde dönüş yapıyoruz.',
    primaryCta: { href: 'mailto:info@renkflow.com', label: 'info@renkflow.com' },
    secondaryCta: { href: '/faq', label: 'Sık sorulanlar' },
    highlights: [
      { title: 'Satış ve demo', detail: 'Ekibinizle birlikte ürünü kendi örnek siparişleriniz üzerinden gösterelim.' },
      { title: 'Teknik destek', detail: 'Mevcut kullanıcılar panel içindeki asistan veya e-posta ile ulaşabilir.' },
      { title: 'İş ortaklığı', detail: 'Bayi, danışman ve entegrasyon ortaklarıyla çalışmaya açığız.' },
    ],
  },
  faq: {
    badge: 'Sık sorulanlar',
    title: 'Aklınıza takılanlar.',
    description: 'Kurulum, kullanım ve veri güvenliği hakkında en sık gelen sorular.',
    primaryCta: { href: '/contact', label: 'Sorunuzu sorun' },
    secondaryCta: { href: '/docs', label: 'Dokümantasyon' },
    highlights: [
      { title: 'Kurulum ne kadar sürer?', detail: 'Mevcut listelerinizin durumuna göre genellikle birkaç gün içinde ekip kullanmaya başlar.' },
      { title: 'Verilerimi aktarabilir miyim?', detail: 'Müşteri, ürün ve stok listeleri Excel/CSV dosyalarından içeri alınabilir.' },
      { title: 'Atölyede internet zayıfsa?', detail: 'Saha ekranları düşük bağlantıda çalışacak şekilde hafif tutuldu; çevrimdışı destek yol haritamızda.' },
    ],
  },
  terms: {
    badge: 'Kullanım koşulları',
    title: 'Hizmet kullanım koşulları.',
    description: 'RenkFlow’u kullanırken tarafların hak ve sorumlulukları.',
    primaryCta: { href: '/privacy', label: 'Gizlilik politikası' },
    secondaryCta: { href: '/contact', label: 'Sorularınız için' },
    highlights: [
      { title: 'Hizmet kapsamı', detail: 'Sunulan modüller ve destek seviyesi sözleşmenizde tanımlanır.' },
      { title: 'Hesap sorumluluğu', detail: 'Kullanıcı hesapları ve yetkileri firma yöneticisi tarafından yönetilir.' },
      { title: 'Uygun kullanım', detail: 'Platformun güvenliğini ve diğer kullanıcıları etkileyecek kullanım yasaktır.' },
    ],
  },
  privacy: {
    badge: 'Gizlilik',
    title: 'Kişisel verilerin korunması.',
    description: 'Hangi verileri neden işlediğimizi, ne kadar sakladığımızı ve haklarınızı açıkça anlatıyoruz.',
    primaryCta: { href: '/contact', label: 'Veri talebi oluşturun' },
    secondaryCta: { href: '/cookies', label: 'Çerez politikası' },
    highlights: [
      { title: 'Gerekli olan kadar', detail: 'Yalnızca iş akışının ihtiyaç duyduğu veriler toplanır.' },
      { title: 'Belirli süre', detail: 'Her veri türü için saklama süresi ve imha kuralı tanımlıdır.' },
      { title: 'Haklarınız', detail: 'Erişim, düzeltme ve silme talepleriniz kayıt altına alınarak yanıtlanır.' },
    ],
  },
  cookies: {
    badge: 'Çerezler',
    title: 'Çerez politikası.',
    description: 'Oturumunuzu güvenle sürdürmek ve tercihlerinizi hatırlamak için çerez kullanıyoruz.',
    primaryCta: { href: '/privacy', label: 'Gizlilik politikası' },
    secondaryCta: { href: '/contact', label: 'Sorularınız için' },
    highlights: [
      { title: 'Zorunlu çerezler', detail: 'Giriş ve güvenlik için gereklidir; kapatılamaz.' },
      { title: 'Tercih çerezleri', detail: 'Tema ve menü düzeni gibi ayarlarınızı hatırlar.' },
      { title: 'Analitik', detail: 'Yalnızca onay vermeniz halinde anonim kullanım ölçümü yapılır.' },
    ],
  },
  status: {
    badge: 'Sistem durumu',
    title: 'Servis durumu ve bakım duyuruları.',
    description: 'Planlı bakımlar önceden duyurulur; olası kesintiler ve çözüm süreçleri burada paylaşılır.',
    primaryCta: { href: '/contact', label: 'Destek ekibine ulaşın' },
    secondaryCta: { href: '/changelog', label: 'Sürüm notları' },
    highlights: [
      { title: 'Planlı bakım', detail: 'Bakım çalışmaları mesai dışına planlanır ve önceden bildirilir.' },
      { title: 'Olay bildirimi', detail: 'Bir sorun yaşandığında etkisi ve tahmini çözüm süresi paylaşılır.' },
      { title: 'Sonrası', detail: 'Önemli olayların ardından kısa bir değerlendirme yayımlanır.' },
    ],
  },
} satisfies Record<string, MarketingPageEntry>;

export type MarketingPageKey = keyof typeof marketingPages;

export type BlogPost = {
  id: string;
  category: string;
  title: string;
  summary: string;
  date: string;
  author: string;
  content: string[];
};

export const blogPosts: BlogPost[] = [
  {
    id: 'operasyon-v2',
    category: 'Sürüm',
    title: 'Operasyon Çekirdeği V2: Sayfa mimarisi ve akışlar yeniden kuruldu',
    summary:
      'Dashboard, sipariş ve finans ekranları aynı tasarım ve veri davranışına getirildi. Bu sürüm, günlük operasyon kararlarını hızlandırmak için tasarlandı.',
    date: '14 Şubat 2026',
    author: 'Ürün ve Mühendislik Ekibi',
    content: [
      'Bu sürümde ana öncelik hız değil, sürdürülebilir kaliteydi. Sayfa yapıları modüler şablonlara ayrıldı ve tekrar eden UI davranışları tek bir dilde toplandı.',
      'Siparişten faturaya uzanan akışta kullanıcıya gösterilen karar noktaları azaltıldı. Böylece operatörlerin kritik aksiyonları daha kısa sürede tamamlaması hedeflendi.',
      'Bir sonraki adımda, ekran bazlı performans ölçümleri ve rol bazlı kişiselleştirme katmanı devreye alınacak.',
    ],
  },
  {
    id: 'pdf-guvenilirlik',
    category: 'Altyapı',
    title: 'Belge katmanı güçlendirildi: PDF görüntüleme artık daha kararlı',
    summary:
      'Signed URL bağımlılığını azaltan same-origin içerik modeli ile belge akışı daha güvenli ve kesintiye dayanıklı hale getirildi.',
    date: '12 Şubat 2026',
    author: 'Platform Ekibi',
    content: [
      'Belge görüntüleme hatalarının önemli kısmı, farklı origin ve geçici URL davranışlarından kaynaklanıyordu. Yeni modelde dokümanlar kontrollü API katmanından servis ediliyor.',
      'Kullanıcı arayüzünde hata durumları sadeleştirildi; açık mesajlar ve alternatif aksiyonlar tanımlandı.',
      'Bu temel, ilerleyen sürümlerde doküman versiyonlama ve denetim geçmişi özelliklerini desteklemek için hazırlandı.',
    ],
  },
  {
    id: 'sidebar-redesign',
    category: 'Deneyim',
    title: 'Sidebar deneyimi yeniden tasarlandı: kategori odaklı, tutarlı ve akıcı',
    summary:
      'Menü yoğunluğu azaltıldı, hover/pin davranışları netleştirildi ve marka geçiş animasyonları profesyonel bir profile taşındı.',
    date: '10 Şubat 2026',
    author: 'Design Systems Ekibi',
    content: [
      'Eski menü yapısında aksiyonlar görsel olarak dağınık görünüyordu. Yeni düzen kategori başlıklarıyla okunabilirliği artırıyor.',
      'Desktop ve mobil davranışları ayrıştırılarak çakışan etkileşimler temizlendi.',
      'Yeni yapı, bir sonraki fazda kullanıcı rolüne göre menü kişiselleştirmesinin temelini oluşturuyor.',
    ],
  },
];

export type CareerPost = {
  id: string;
  title: string;
  team: string;
  location: string;
  mode: 'Hybrid' | 'Remote' | 'Onsite';
  summary: string;
  responsibilities: string[];
};

export const careers: CareerPost[] = [
  {
    id: 'frontend-engineer',
    title: 'Senior Frontend Engineer',
    team: 'Product Engineering',
    location: 'Istanbul',
    mode: 'Hybrid',
    summary:
      'Dashboard ve operasyon ekranlarında yüksek kalite, performans ve sürdürülebilir component mimarisi geliştirecek kıdemli frontend mühendisi arıyoruz.',
    responsibilities: [
      'Next.js ve TypeScript tabanlı üretim ekranlarının teknik yönünü sahiplenmek.',
      'Tasarım sistemi ile uygulama katmanı arasında güçlü bir sözleşme kurmak.',
      'Kritik iş akışlarında performans ve erişilebilirlik standartlarını yükseltmek.',
    ],
  },
  {
    id: 'product-designer',
    title: 'Product Designer',
    team: 'Design',
    location: 'Istanbul',
    mode: 'Remote',
    summary:
      'Operasyon ve finans süreçleri için sade ama güçlü kullanıcı deneyimleri tasarlayacak ürün tasarımcısı arıyoruz.',
    responsibilities: [
      'Karmaşık iş akışlarını karar dostu ekranlara çevirmek.',
      'Araştırma içgörülerini ürün önceliklerine dönüştürmek.',
      'Design tokens ve component dilini ekip genelinde standartlaştırmak.',
    ],
  },
  {
    id: 'backend-engineer',
    title: 'Backend Engineer',
    team: 'Platform',
    location: 'Istanbul',
    mode: 'Hybrid',
    summary:
      'Çok kiracılı veri modeli ve güvenli API katmanını ölçekli şekilde geliştirecek backend mühendisi arıyoruz.',
    responsibilities: [
      'Tenant izolasyonu ve yetkilendirme modelini güvenli şekilde sürdürmek.',
      'Sipariş, belge ve finans servislerinde kararlılık odaklı iyileştirmeler yapmak.',
      'Gözlemlenebilirlik ve hata yönetimi altyapılarını ürünle entegre geliştirmek.',
    ],
  },
];
