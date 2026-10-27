/**
 * Public release notes for /changelog, newest first. Written for users, not developers: what they
 * can do now, what works better, what was fixed. Sources: merged pull requests on main.
 *
 * To add a release, put a new entry at the top. `version` is the release date (YYYY.MM.DD); a second
 * release on the same day gets a suffix (2026.10.22.2).
 */
export type ChangeKind = 'Yeni' | 'İyileştirme' | 'Düzeltme';

export type ChangelogEntry = {
  version: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  summary?: string;
  changes: Array<{ kind: ChangeKind; items: string[] }>;
};

export const changelog: ChangelogEntry[] = [
  {
    version: '2026.10.27',
    date: '2026-10-27',
    title: 'Atölyede küçük sürprizler',
    summary: 'İşinize dokunmayan, bulana keyif veren birkaç yenilik. Hangisini nerede bulacağınızı söylemiyoruz.',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'Ofisteki yarış oyunu baştan yapıldı: virajlar, yokuşlar, gece ve gün batımı, trafik, kahve ve nitro.',
          'Rekor kırdığınızda ofisteki ekip fark ediyor.',
          'Siparişlerinizde dönüm noktalarına ulaştığınızda küçük bir kutlama.',
          'Atölyenin boş köşelerinde, hata ekranlarında ve kesim planlarında oynanacak birkaç şey.',
        ],
      },
    ],
  },
  {
    version: '2026.10.26.2',
    date: '2026-10-26',
    title: 'Plan ve kullanım, veri dışa aktarma ve iki adımlı doğrulama zorunluluğu',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'Ayarlarda “Plan ve kullanım”: aktif üye, bu ayki sipariş, yapay zekâ harcaması ve dosya kullanımı tek ekranda.',
          'Firma sahibi tüm firma verisini tek ZIP olarak indirebilir (KVKK veri taşınabilirliği).',
          'Hesap kapatma talebi: hiçbir şey kendiliğinden silinmez, talep destek ekibine iletilir ve süreç adım adım anlatılır.',
          'Firma sahibi, sahip ve yöneticiler için iki adımlı doğrulamayı zorunlu yapabilir.',
          'Kayıt ve davet kabulünde kullanım koşulları ile aydınlatma metninin onayı kayda geçer.',
        ],
      },
      {
        kind: 'İyileştirme',
        items: [
          'Veritabanının günlük yedeği artık özel depolama alanına alınıyor; 14 gün saklanıyor.',
          'Bildirim, gelen mesaj ve e-fatura kuyrukları 10 dakikada bir, gizli anahtar gerektirmeden çalışıyor.',
          'Güvenlik güncellemeleri uygulandı.',
        ],
      },
    ],
  },
  {
    version: '2026.10.26',
    date: '2026-10-26',
    title: 'Kurulum listesi, yasal metinler ve daha güvenli hesaplar',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'Genel bakışta kurulum listesi: firma bilgileri, iş istasyonu, ilk sipariş, ekip daveti ve ilk iş emri. Adımlar firmanızın verisinden kendiliğinden işaretlenir.',
          'Kayıttan sonra e-posta doğrulama ekranı: bağlantının gittiği adres, sonraki adımlar ve tek tıkla yeniden gönderme.',
          'Profil menüsü (Hesabım, Firma ayarları, Çıkış) ve zil üzerinde okunmamış bildirim sayısı.',
          'Üretim akışı, ürün reçeteleri ve servis ekranları menüde ve komut paletinde.',
          'Durum sayfası artık canlı: uygulama, yapılandırma ve veritabanı anlık kontrol edilir.',
          'Kullanım koşulları, gizlilik ve KVKK aydınlatma metni, çerez politikası ve başlangıç rehberi yenilendi.',
        ],
      },
      {
        kind: 'İyileştirme',
        items: [
          'Silme ve iptal gibi geri alınamaz işlemler artık uygulamanın kendi onay penceresiyle sorulur.',
          'Bir ekran hata verdiğinde menü ve üst çubuk yerinde kalır, “Tekrar dene” ile aynı ekrana dönülür.',
          'Bildirim, gelen e-posta/WhatsApp ve e-fatura kuyrukları düzenli olarak işlenir.',
          'Çerez bildirimi çalışma alanının içinde gösterilmez.',
        ],
      },
      {
        kind: 'Düzeltme',
        items: [
          'Tek oturum açma (SSO) ile ilk kez gelen kullanıcıların hesabı oluşturulamıyordu.',
          'SSO giriş bağlantıları birkaç dakika içinde ve tek kullanımda geçerli; şifre sıfırlama ve herkese açık bağlantılara istek sınırı eklendi.',
        ],
      },
    ],
  },
  {
    version: '2026.10.22',
    date: '2026-10-22',
    title: 'AI ofis',
    summary: 'Görevlerinizi yapay zekâ çalışanlarına verebileceğiniz yeni bir çalışma alanı.',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'AI ofis (Genel › AI ofis): görevi kendi cümlelerinizle yazın; ofis müdürü türüne ve zorluğuna karar verip uygun çalışana verir, iş bitince sonuç dosya olarak teslim edilir.',
          'Teslim edilen işler önce yönetici kontrolünden geçer; yalnızca ciddi bir sorun varsa çalışana geri gönderilir.',
          'Çalışanlar görevi yaparken firmanızın kayıtlarına bakabilir. Başka bir sayfaya geçtiğinizde ofis çalışmaya devam eder.',
        ],
      },
      {
        kind: 'İyileştirme',
        items: [
          '3D ofis sahnesi daha akıcı. Cihazınıza göre performans veya kalite modu önerilir; seçim bu cihazda hatırlanır.',
        ],
      },
    ],
  },
  {
    version: '2026.10.21',
    date: '2026-10-21',
    title: 'Tekliften üretime kesintisiz akış',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'Reçetesi tanımlanmamış ürünlerde iş emri, imalat föyünün kesim listesiyle açılır (Kesim, Boya, Son hazırlık).',
          'Teklif, taslak aşamasından doğrudan “Müşteri onayladı” olarak işaretlenebilir.',
          'İş emirleri panosu kalıcı ve etkileşimli; listeler ekrana sığar ve ayrı ayrı kaydırılır.',
          'RenkFlow’a özel kurumsal tema: antrasit, alüminyum gri ve eloksal bronz.',
        ],
      },
      {
        kind: 'İyileştirme',
        items: [
          'Teknik plandaki notlar engel ve uyarı olarak ayrıldı. Stok eksikliği veya teklif ile föy arasındaki fark gibi uyarılar “Uyarıları gördüm” ile kabul edilir ve planda saklanır; okunamayan ölçü gibi gerçek engeller düzeltilmeden onay açılmaz.',
          'Stok eksik olsa da üretim açılır, kesim bekler. Stok geldiğinde siparişteki “Stoğu kontrol et ve kesimi planla” ile çubuklar ayrılır.',
          'Usta ekranı iş bulunan ilk kategoriyle açılır; kategorilerde iş sayısı görünür ve arama tüm kategorileri tarar.',
          'Oturumunuz açıkken ana sayfa sizi panele yönlendirmez; panele “Panele git” ile geçebilirsiniz.',
        ],
      },
      {
        kind: 'Düzeltme',
        items: [
          'Stoğu eksik bir kesim paketi açıldığında üretim ekranının kapanması giderildi.',
          'Düzenlenen e-Faturanın XML’i ve alıcı bilgisi sonradan değişmeyecek şekilde sabitlenir.',
          'Webden kapatılan bir telefon oturumuna bildirim gönderilmesi durduruldu.',
        ],
      },
    ],
  },
  {
    version: '2026.10.20',
    date: '2026-10-20',
    title: 'Güvenlik ve yoğun kullanımda dayanıklılık',
    changes: [
      {
        kind: 'Yeni',
        items: ['Ana sayfada canlı bir kesim planı örneği: ölçüleri değiştirin, planın nasıl kurulduğunu görün.'],
      },
      {
        kind: 'İyileştirme',
        items: [
          'Yoğun bir üretim gününde bile kesintisiz çalışma: geçici veritabanı hataları otomatik olarak yeniden denenir, sık kullanılan ekranlar daha hızlı açılır.',
          'Satın alma kayıtları muhasebe yevmiyesine işlenir.',
        ],
      },
      {
        kind: 'Düzeltme',
        items: [
          'Sipariş QR bağlantısından başka bir siparişin bilgisine ulaşılabilmesi engellendi.',
          'Başka bir firmaya ait kayıt istendiğinde her yerde aynı “bulunamadı” yanıtı verilir.',
          'API ile girişte iki adımlı doğrulamanın atlanabilmesi kapatıldı.',
          'Bağlantı havuzunun yoğunlukta kilitlenmesi ve veritabanı bağlantısı koptuğunda uygulamanın durması giderildi.',
          'İki web bağımlılığındaki güvenlik açıkları yamalandı.',
        ],
      },
    ],
  },
  {
    version: '2026.10.16',
    date: '2026-10-16',
    title: 'İstasyon tabletleri ve sipariş dosyaları',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'İstasyon tabletleri (Ayarlar › İstasyon tabletleri): atölyedeki bir tableti istasyona eşleyin; tablet yalnızca o istasyonun işlerini ve talimatlarını gösterir.',
          'Siparişe teknik dosyalar eklenir; atölye üretimi ve mal kabul aynı sipariş üzerinden eşleşir.',
          'Firma adresleri ve bilgi bankası yazılarında sürüm geçmişi.',
          'Teklif PDF’inde genel satış koşulları ile iptal ve iade koşulları yer alır.',
          'Asistan yenilendi: sade arayüz, gerçek yapay zekâ yanıtları ve incelenmiş teklif önizlemesi.',
        ],
      },
      {
        kind: 'İyileştirme',
        items: [
          'Kesim planı depodaki gerçek çubuk boylarını kullanır; boyalı stok yetmediğinde boyasız stoktan kesip boyama önerir.',
          'Gizli PDF belgeleri her cihazda güvenilir biçimde açılır.',
        ],
      },
    ],
  },
  {
    version: '2026.10.14',
    date: '2026-10-14',
    title: 'e-Fatura altyapısı, muhasebe ve KVKK araçları',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'e-Fatura ve e-Arşiv altyapısı: firma yasal kimliği, GİB’e uygun fatura numarası, tevkifat ve istisna kodları, UBL-TR 1.2 XML, gönderim kuyruğu ve iptal kuralları. GİB’e gönderim, özel entegratör bağlantısı kurulduğunda açılır.',
          'Muhasebe: faturalardan ve tahsilatlardan otomatik yevmiye kaydı, mizan ve yevmiye ekranı.',
          'Banka ekstresi içe aktarma: CSV, MT940 ve OFX dosyaları; önizleme ve aynı dosyanın güvenle yeniden yüklenmesi.',
          'KDV dönem özeti ve alış faturası girişi.',
          'TCMB kurları: günlük güncelleme, teklifte “TCMB’den al” düğmesi, dövizli faturalarda fatura tarihindeki kur.',
          'KVKK: başvuru defteri (Ayarlar › KVKK), müşteri kartından veri dökümü ve anonimleştirerek silme.',
          'Müşteri listesini CSV dosyasından içe aktarma: önizleme ve mükerrer kayıt koruması.',
          'İki adımlı doğrulama (doğrulama uygulaması ve kurtarma kodları), Hesabım sayfasından.',
          'Kesim listesi: imalat föyünden otomatik kesim planı.',
          'Aranabilir 3D ürünler, puantaj kuralları ve depo kurulumu.',
        ],
      },
      {
        kind: 'İyileştirme',
        items: [
          'Denetim kaydına giriş ve dönem kapama olayları eklendi.',
          'Müşteri, potansiyel müşteri ve araç formları sadeleşti.',
          'Malzeme alışları gider olarak değil, stok olarak kaydedilir.',
          'Hata izleme ve gerçek bir hazır olma denetimi; sonuç /status sayfasında.',
        ],
      },
    ],
  },
  {
    version: '2026.10.13',
    date: '2026-10-13',
    title: 'Personel ve imalat föyü',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'Personel: çalışan kartı, puantaj, avans ve ay sonu hesabı (Finans › Personel).',
          'İmalat föyü okuma: föy yüklenir, kontrol edilir ve föyden sipariş açılır.',
          'Asistana siparişler, teslimatlar, stok, finans ve satın alma hakkında soru sorabilirsiniz; bu sorular kayıtları değiştirmez.',
          'Eksik bilgili taslaklar için müşteriye gönderilecek soru mesajı önerilir.',
          'Yeni RenkFlow marka kimliği.',
        ],
      },
      {
        kind: 'İyileştirme',
        items: [
          'Tüm yapay zekâ özellikleri Claude Sonnet 5.5 ile çalışır.',
          'Mobil uygulama 1.2.1: daha güvenilir oturum, çevrim dışı işlemler hesaba göre ayrı tutulur.',
          'Sade menüler, kurumsal teklif görünümü ve az alanlı ekranlar.',
        ],
      },
    ],
  },
  {
    version: '2026.10.12',
    date: '2026-10-12',
    title: 'Asistan, finans, saha ve ekip yetkileri',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'Asistan: “teklif taslağı hazırla”, “geciken işler”, “çubuk stoğu” veya “bu siparişi öne alsak ne olur” gibi komutlar önizleme ve onayla çalışır; Cmd+K içinden “Asistana sor”; tarayıcı destekliyorsa sesle komut; sabah özeti.',
          'Öneri kartları: öncelik, dayanak, kopyalanabilir mesaj taslağı, erteleme ve “bir daha önerme”.',
          'Ayarlar › Asistan: çalışma modu (kapalı, yalnız kurallar, yapay zekâ), KVKK onayı ve günlük bütçe.',
          'Finans: faturalar, alacak yaşlandırma, yazdırılabilir fatura ve hesap ekstresi; siparişte “Fatura & tahsilat” sekmesi.',
          'Saha: müşteri adayları, montaj ve servis ekranları; müşterinin teslimi imzaladığı sayfa; siparişte “Montaj & servis” sekmesi.',
          'Araç filosu ekranları ve harita üzerinde son konum.',
          'Ekip ve yetkiler: davetler, özel roller, Hesabım’da açık oturumlar ve bildirim tercihleri, işlem geçmişi ekranı. Menü role göre süzülür.',
          'Stok: yeniden sipariş politikası, tedarikçilerden teklif isteyip karşılaştırma, tedarikçi karnesi ve fiyat geçmişi.',
          'Üretim: iş emrinde fire ve gecikme kaydı, Pareto grafiği ve 7 günlük kapasite ısı haritası.',
          'Satış: teklifte KDV ve döviz, indirim eşiği ve yönetici onayı, müşteri onay bağlantısı, revizyon farkı ve teklif şablonları.',
          'Mobil saha uygulaması: çevrim dışı çalışma, atanmış montaj akışı, fotoğraf yükleme ve barkod okuma.',
        ],
      },
      {
        kind: 'İyileştirme',
        items: ['Karanlık mod, arama motorları için iyileştirmeler ve KVKK bilgilendirmesi.'],
      },
    ],
  },
  {
    version: '2026.10.08',
    date: '2026-10-08',
    title: 'Ürün yapılandırıcı, renk kataloğu ve stok sayımı',
    changes: [
      {
        kind: 'Yeni',
        items: [
          'Ölçüye göre fiyat çıkaran pergola yapılandırıcı; ürün aileleri, fiyat matrisi ve reçete şablonları.',
          'Teklif siparişe dönüşürken iş emri ve kesim talebi kendiliğinden açılır.',
          'Firma renk kataloğu ve tüm RAL renkleri; usta ekranlarında renk karosu.',
          'Stok eşiği uyarısı ve satın alma taslağı önerisi; çubuk bazında açılış sayımı; sayım PDF’inden içe aktarma.',
          'Kesim planı ve usta föyü.',
          'Görsel panolar: Bugün, sipariş panosu, fabrika modu ve duvar ekranı.',
          'Yapay zekâ önerileri onay kuyruğunda bekler; kişisel veriler modele gönderilmeden maskelenir.',
        ],
      },
    ],
  },
];
