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
    badge: 'Kurumsal Profil',
    title: 'RenkFlow, üretim ekipleri için inşa edilmiş operasyon yazılımıdır',
    description:
      'Sipariş, sevkiyat, finans ve ekip planlamasını tek bir veri çekirdeğinde birleştirir. Amaç, dağınık ekranları sade bir karar altyapısına dönüştürmektir.',
    primaryCta: { href: '/contact', label: 'Kurumsal Görüşme Planla' },
    secondaryCta: { href: '/features', label: 'Ürün Detaylarını Gör' },
    highlights: [
      {
        title: 'Tek Ekran Mantığı',
        detail: 'Farklı operasyon birimlerini aynı iş akışında görünür kılar.',
      },
      {
        title: 'Yüksek İzlenebilirlik',
        detail: 'Sipariş geçmişi, ödeme kayıtları ve belge hareketleri denetlenebilir şekilde tutulur.',
      },
      {
        title: 'Ölçeklenebilir Tenant Yapısı',
        detail: 'Her firma kendi verisiyle izole şekilde çalışırken merkezi yönetim standardı korunur.',
      },
    ],
  },
  features: {
    badge: 'Ürün Kapsamı',
    title: 'Saha operasyonundan finans raporuna kadar entegre modül seti',
    description:
      'RenkFlow; dashboard, sipariş, belge görüntüleme, ödeme izleme ve ekip yönetimi modüllerini tek deneyimde toplar.',
    primaryCta: { href: '/signup', label: 'Demo Ortamı Aç' },
    secondaryCta: { href: '/docs', label: 'Teknik Dokümana Git' },
    highlights: [
      {
        title: 'Sipariş Motoru',
        detail: 'Yeni sipariş, durum takibi ve doküman bağlantıları tek form akışında çalışır.',
      },
      {
        title: 'Belge Güvenilirliği',
        detail: 'PDF ve teknik dosyalar same-origin erişim modeliyle kararlı şekilde açılır.',
      },
      {
        title: 'Finans Görünürlüğü',
        detail: 'Tahsilat, açık bakiye ve fatura aksiyonları operasyon verisiyle ilişkilidir.',
      },
    ],
  },
  pricing: {
    badge: 'Ticari Paketler',
    title: 'Büyümeye göre katmanlanan şeffaf fiyatlandırma modeli',
    description:
      'Paket yapısı kullanıcı sayısı, süreç yoğunluğu ve destek seviyesine göre net biçimde ayrıştırılır. Gizli maliyet veya belirsiz limit bulunmaz.',
    primaryCta: { href: '/contact', label: 'Teklif İste' },
    secondaryCta: { href: '/signup', label: '14 Gün Deneme Başlat' },
    highlights: [
      {
        title: 'Açık Limitler',
        detail: 'Her planda aktif kullanıcı, depolama ve işlem limitleri görünür şekilde tanımlıdır.',
      },
      {
        title: 'Kademeli Destek',
        detail: 'Standart, öncelikli ve özel müşteri başarı seviyeleri plan bazında ayrılır.',
      },
      {
        title: 'Sözleşme Esnekliği',
        detail: 'Aylık veya yıllık modelde ölçek değişimlerine göre güncellenebilir.',
      },
    ],
  },
  integrations: {
    badge: 'Bağlantı Merkezi',
    title: 'Mevcut sistemlerinizi kırmadan RenkFlow ile eşleştirin',
    description:
      'ERP, muhasebe ve bulut depolama sistemleri için API temelli entegrasyon katmanı ile veri senkronu kontrollü ilerler.',
    primaryCta: { href: '/docs', label: 'API Kılavuzunu İncele' },
    secondaryCta: { href: '/contact', label: 'Entegrasyon Toplantısı' },
    highlights: [
      {
        title: 'API-First Yaklaşım',
        detail: 'Yeni uç noktalar geriye uyumlu versiyonlama standardı ile yayınlanır.',
      },
      {
        title: 'Yetki Sınırları',
        detail: 'Her entegrasyon tenant ve rol bazlı erişim politikalarıyla sınırlandırılır.',
      },
      {
        title: 'İzleme ve Alarm',
        detail: 'Entegrasyon hataları ve tekrar deneme akışları kayıt altına alınır.',
      },
    ],
  },
  docs: {
    badge: 'Dokümantasyon',
    title: 'Kurulum, kullanım ve API referansı tek bilgi mimarisinde',
    description:
      'Ürün kullanım rehberleri, teknik entegrasyon dokümanları ve sürüm geçiş notları sade başlıklar altında toplanır.',
    primaryCta: { href: '/docs', label: 'Dokümantasyonu Aç' },
    secondaryCta: { href: '/changelog', label: 'Sürüm Notlarına Git' },
    highlights: [
      {
        title: 'Rol Bazlı Rehberler',
        detail: 'Operasyon, finans ve yönetici kullanıcılar için ayrı kullanım yolları tanımlanır.',
      },
      {
        title: 'Kopyalanabilir Örnekler',
        detail: 'API talepleri ve yanıt örnekleri üretim senaryolarına göre paylaşılır.',
      },
      {
        title: 'Sürüm Geçiş Notları',
        detail: 'Kırıcı değişiklikler, geçiş adımlarıyla birlikte açık şekilde duyurulur.',
      },
    ],
  },
  security: {
    badge: 'Bilgi Güvenliği',
    title: 'Kurumsal güvenlik gereksinimlerine uygun kontrol katmanı',
    description:
      'Erişim politikaları, tenant izolasyonu ve işlem denetim logları ile platform güvenliği ölçülebilir bir çerçevede yönetilir.',
    primaryCta: { href: '/security', label: 'Güvenlik Detayları' },
    secondaryCta: { href: '/contact', label: 'Uyumluluk Görüşmesi' },
    highlights: [
      {
        title: 'Tenant İzolasyonu',
        detail: 'Firma verileri uygulama ve erişim katmanında ayrıştırılmıştır.',
      },
      {
        title: 'Rol ve Yetki Matrisi',
        detail: 'Kritik finans ve belge işlemleri izin tabanlı güvence ile korunur.',
      },
      {
        title: 'Denetlenebilir Kayıtlar',
        detail: 'Önemli aksiyonlar operasyonel denetim için iz bırakacak şekilde saklanır.',
      },
    ],
  },
  roadmap: {
    badge: 'Yol Haritası',
    title: 'Teslim odaklı ürün planı ve görünür geliştirme takvimi',
    description:
      'Yeni modüller; etki, aciliyet ve teknik risk puanına göre sıralanır. Yol haritası vaat değil, teslim takvimi olarak ele alınır.',
    primaryCta: { href: '/roadmap', label: 'Yol Haritasını İncele' },
    secondaryCta: { href: '/changelog', label: 'Tamamlananları Gör' },
    highlights: [
      {
        title: 'Net Öncelik Modeli',
        detail: 'Geliştirmeler kullanıcı etkisi ve operasyonel kazanç skoruna göre seçilir.',
      },
      {
        title: 'Aşamalı Teslimat',
        detail: 'Büyük özellikler kontrollü release dilimleriyle canlıya alınır.',
      },
      {
        title: 'Geri Bildirim Döngüsü',
        detail: 'Sahadan toplanan geri bildirimler doğrudan backlog kararına etki eder.',
      },
    ],
  },
  changelog: {
    badge: 'Sürüm Geçmişi',
    title: 'Yayınlanan her değişiklik için şeffaf sürüm günlüğü',
    description:
      'Sürüm notları; etkilenen modül, davranış değişimi ve gerekli aksiyon bilgisiyle birlikte yayımlanır.',
    primaryCta: { href: '/blog', label: 'Detay Yazılarını Aç' },
    secondaryCta: { href: '/docs', label: 'Geçiş Talimatlarını Gör' },
    highlights: [
      {
        title: 'Etkilenen Alanlar',
        detail: 'Hangi modülün nasıl değiştiği açık başlıklar ile listelenir.',
      },
      {
        title: 'Kırıcı Değişiklik Uyarısı',
        detail: 'Uygulama etkileyen kararlar geçiş adımlarıyla birlikte açıklanır.',
      },
      {
        title: 'Kapanan Hata Kayıtları',
        detail: 'Özellikle üretim kritik hatalar sürüm notlarında takip edilir.',
      },
    ],
  },
  press: {
    badge: 'Basın ve Medya',
    title: 'Marka varlıkları ve resmi duyurular için kurumsal kaynak merkezi',
    description:
      'Basın kitleri, ürün tanıtım metinleri ve kullanım yönergeleri tek yerde düzenli biçimde sunulur.',
    primaryCta: { href: '/contact', label: 'Basın İletişimi' },
    secondaryCta: { href: '/about', label: 'Şirket Profili' },
    highlights: [
      {
        title: 'Resmi Varlık Paketi',
        detail: 'Logo, renk ve marka kullanım ilkeleri güncel sürümlerle paylaşılır.',
      },
      {
        title: 'Duyuru Arşivi',
        detail: 'Önemli ürün ve şirket duyuruları tarihsel sırayla korunur.',
      },
      {
        title: 'Medya İletişim Kanalı',
        detail: 'Basın talepleri için net bir geri dönüş ve koordinasyon hattı bulunur.',
      },
    ],
  },
  contact: {
    badge: 'İletişim',
    title: 'Satış, destek ve iş ortaklığı ekipleriyle doğrudan temas kurun',
    description:
      'Kurumsal satış görüşmesi, teknik destek yönlendirmesi ve stratejik iş birliği talepleri için yapılandırılmış iletişim kanalları sağlanır.',
    primaryCta: { href: '/contact', label: 'Talep Oluştur' },
    secondaryCta: { href: '/status', label: 'Sistem Durumunu Gör' },
    highlights: [
      {
        title: 'Satış Hattı',
        detail: 'Paket, teklif ve dönüşüm görüşmeleri için öncelikli geri dönüş sağlanır.',
      },
      {
        title: 'Teknik Destek',
        detail: 'Canlı sorunlar için ekip sorumlularına yönlendirilen destek akışı çalışır.',
      },
      {
        title: 'Ortaklık Programı',
        detail: 'Danışman ve entegrasyon partnerleri için ayrı başvuru yapısı bulunur.',
      },
    ],
  },
  faq: {
    badge: 'Sık Sorulanlar',
    title: 'Kullanım sürecinde en çok sorulan konuların net cevapları',
    description:
      'Uygulama başlangıcı, yetkilendirme, belge yönetimi ve finans akışlarıyla ilgili sık sorular, operasyonel dilde kısa cevaplarla sunulur.',
    primaryCta: { href: '/docs', label: 'Detay Kılavuza Geç' },
    secondaryCta: { href: '/contact', label: 'Destek Talebi Aç' },
    highlights: [
      {
        title: 'Hızlı Onboarding',
        detail: 'İlk tenant kurulumu ve rol atama adımları adım adım açıklanır.',
      },
      {
        title: 'Belge ve PDF Süreci',
        detail: 'Yükleme, görüntüleme ve paylaşım akışlarının güvenli kullanımı anlatılır.',
      },
      {
        title: 'Finans İşleyişi',
        detail: 'Fatura, tahsilat ve ödeme ekranlarıyla ilgili kritik sorular yanıtlanır.',
      },
    ],
  },
  terms: {
    badge: 'Hukuki Çerçeve',
    title: 'Hizmet kullanım koşulları ve taraf sorumlulukları',
    description:
      'Kullanım şartları ürün kapsamı, hizmet seviyeleri ve taraf yükümlülükleri açısından sade bir yapıda güncellenmiştir.',
    primaryCta: { href: '/terms', label: 'Koşulları İncele' },
    secondaryCta: { href: '/privacy', label: 'Gizlilik Politikasına Geç' },
    highlights: [
      {
        title: 'Sözleşme Netliği',
        detail: 'Rol, yetki ve hizmet sınırları açık ifadelerle tanımlanır.',
      },
      {
        title: 'Hizmet Kapsamı',
        detail: 'Platformun sunduğu modüller ve hariç tutulan senaryolar ayrıştırılır.',
      },
      {
        title: 'Uygun Kullanım İlkeleri',
        detail: 'Platform güvenliğini koruyan kullanım kuralları net biçimde belirtilir.',
      },
    ],
  },
  privacy: {
    badge: 'Gizlilik',
    title: 'Kişisel verilerin işlenmesi ve korunması için şeffaf politika',
    description:
      'Toplanan veri türleri, işleme amaçları, saklama süreleri ve kullanıcı hakları anlaşılır bir dille açıklanır.',
    primaryCta: { href: '/privacy', label: 'Politikayı İncele' },
    secondaryCta: { href: '/security', label: 'Güvenlik Standartları' },
    highlights: [
      {
        title: 'Veri Minimizasyonu',
        detail: 'İş akışı için gerekli olmayan veri toplanmaz.',
      },
      {
        title: 'Saklama Politikası',
        detail: 'Veri türüne göre saklama süreleri ve imha kuralları tanımlıdır.',
      },
      {
        title: 'Hak Yönetimi',
        detail: 'Erişim, düzeltme ve silme talepleri için işletilebilir bir süreç bulunur.',
      },
    ],
  },
  cookies: {
    badge: 'Çerezler',
    title: 'Çerez kullanımı ve tercih yönetimi hakkında açık bilgilendirme',
    description:
      'Zorunlu, analitik ve performans odaklı çerez kategorileri ayrıştırılmış; kullanıcı tercihleri yönetilebilir hale getirilmiştir.',
    primaryCta: { href: '/cookies', label: 'Çerez Tercihleri' },
    secondaryCta: { href: '/privacy', label: 'Gizlilik Politikası' },
    highlights: [
      {
        title: 'Kategori Bazlı Yönetim',
        detail: 'Her çerez türü işlevine göre ayrı kontrol edilir.',
      },
      {
        title: 'Şeffaf Amaç Tanımı',
        detail: 'Çerezlerin hangi amaçla kullanıldığı kullanıcıya açıkça gösterilir.',
      },
      {
        title: 'Tercih Güncelleme',
        detail: 'Kullanıcı çerez ayarlarını dilediği zaman yeniden düzenleyebilir.',
      },
    ],
  },
  status: {
    badge: 'Sistem İzleme',
    title: 'Platform servislerinin anlık sağlık ve bakım görünürlüğü',
    description:
      'Çalışma durumu, bakım pencereleri ve olası kesintilere ait zaman çizelgesi merkezi bir statü görünümüyle sunulur.',
    primaryCta: { href: '/status', label: 'Servis Durumunu Gör' },
    secondaryCta: { href: '/contact', label: 'Destek Ekibine Ulaş' },
    highlights: [
      {
        title: 'Gerçek Zamanlı Durum',
        detail: 'Kritik servislerin sağlık bilgisi tek panelde takip edilir.',
      },
      {
        title: 'Planlı Bakım Takvimi',
        detail: 'Planlı müdahaleler önceden duyurulur ve etki alanı belirtilir.',
      },
      {
        title: 'Olay Sonrası Raporlama',
        detail: 'Kesinti sonrası özet ve aksiyon raporu paylaşılır.',
      },
    ],
  },
} as const;

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
