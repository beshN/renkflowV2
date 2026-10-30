> Deployment update: use [Vercel deployment](./vercel-deployment.md). The Google Cloud deployment path has been removed; active file storage and cron jobs run on Vercel.

# RenkFlow üretim platformu ve WINMAX 3D — 3 Ekim 2026

Bu çalışma makaslı tente pilotunun uygulama kodunu ve yerel doğrulamasını kapsar. Gerçek reçete, üretilebilir ölçü sınırları, profil kg/metre değerleri ve iş merkezi kapasiteleri Renk Alüminyum tarafından uygulamada doğrulanmalıdır. Test veritabanındaki sentetik reçete ticari üretim reçetesi değildir. Canlı veritabanına migration veya stok hareketi gönderilmedi.

## Ekranlar

| Ekran | İşlev |
|---|---|
| `/quotations/new`, `/quotations/:id` | Çok kalemli teklif, kalem başına 3D, elle fiyat/adet/indirim, kayıt sürümü, siparişe atomik dönüşüm |
| `/quotations/:id/print` | Gerçek teklif numarası, kayıtlı 3D görsel, ölçü/donanım ve satış fiyatıyla yazdırma/PDF |
| `/new-order`, `/orders/:id` | Yapılandırma ile sipariş girişi; kalemlerde onaylı salt okunur 3D |
| `/production` | Reçete, toplu kesim, rework kesimi, kapasite, fiziksel stok, belge inceleme, müşteri iletişimi |
| `/production/intake/:id` | Kaynak PDF/görsel/e-posta metni ile alanları karşılaştırma; belirsizlik/kanıt; insan onayı |
| `/factory` | Çalışana atanmış operasyonlar, başlat/duraklat/kısmi tamamla, fotoğraf/not, gerekçeli rework, cihaz kuyruğu, barkod okuma |
| `/production/labels` | İş emri, kesim paketi, fiziksel artık ve mamul birimi için QR + CODE128 etiketi |
| `/track/:token` | İptal edilebilir takip bağlantısı; teknik 3D, üretim ve kısmi sevkiyat/teslimat; fiyat ve müşteri iletişim bilgisi içermez |

Üretim merkezi iş merkezinin hazır kuyruğunu, WIP'i, beklemeyi, gerçek süreyi ve rework kayıtlarını gösterir. Kapasite çizelgesi vardiya, çalışma günleri, bakım, öncelik, termin, operasyon bağımlılığı ve malzeme hazır oluşunu dikkate alır. Yönetici yayınlamadan uygulanan çizelgeye dönüşmez.

## 3D veri sözleşmesi

ZIP'teki Three.js r170 modeli ve makas/kumaş/LED mekanizması `lib/features/awning/model.js` içinde korunur. Örnek fiyat fonksiyonu çıkarılmıştır. `AwningConfiguration.version=1`; en, açılım ve montaj yüksekliği ayrı mm alanlarıdır. ZIP'in cm alanlarına yalnız sahne sınırında `/10` uygulanır. Eski `heightMm` bağımsız ürün yüksekliğidir; anlamı değiştirilmez.

`applyAwning` yalnız teknik seçimleri uygular; fiyat, adet, indirim ve eski yüksekliği korur. Sunucuda da teknik alanlar yapılandırmadan normalize edilir. Görsel sınırları üretim onayı değildir; iş emri yayımlanmış reçetenin ayrıca doğruladığı sınırları kullanır. Kamera, gece ve animasyon açıklığı BOM veya fiyatı değiştirmez.

Three.js sahne açıldığında dinamik yüklenir. Görünmeyen sahnede animasyon durur; kapanışta RAF, gözlemciler, olaylar, geometri, malzeme, gölge ve WebGL bağlamı temizlenir. WebGL başlatılamaz veya kaybolursa teknik seçimler ve mevcut görsel kullanılabilir. Kaybolmuş bağlamdan alınan boş görsel kayıtlı görselin üzerine yazılmaz. PDF görseli "temsili 3D görünüm" olarak işaretlenir.

## Üretim ve stok kuralları

Reçete formülleri güvenli aritmetik ayrıştırıcıyla hesaplanır; eval ve AI malzeme hesabı kullanılmaz. Kurallar en/açılım/montaj yüksekliği, alan ve motor/LED seçeneklerini kullanabilir. Malzeme formülleri tek ürün içindir; adetle çarpılır. Operasyon süre formüllerinde `quantity` toplam iş miktarıdır. Yayın için en az iki farklı, beklenen malzemeleri açıkça girilmiş doğrulama örneği gerekir. Yayındaki sürüm değiştirilemez; yeni sürüm açılır. Reçete ve hesap üretim emrinde snapshot olarak korunur.

Kesim yalnız gerçek fiziksel lotlardan yapılır: aynı SKU ve renk, farklı ticari boylar, testere payı, iki uç düzeltme ve kullanılabilir artık sınırı. İki deterministik yerleşimin en iyi sonucu seçilir; matematiksel global optimum garantisi verilmez. Önizleme stok ayırmaz. Yönetici onayı fiziksel lot ve defter rezervasyonunu ayırır. Eşzamanlı planlar aynı lotu kullanamaz. Gerçekleşme sırasında ölçülen artık boyu girilir; malzeme dengesi, tekrar kullanılabilir lot, hurda kg ve maliyet ayrı kaydedilir.

Defter otoritesi `stock_entries` / `stock_entry_lines` / `stock_balances` olarak kalır. Onaylı stok kayıtları düzenlenmez. Kullanılmamış mal kabulü gerekçeli ters kayıtla düzeltilir; tüketilmiş/rezerve profil geri çevrilemez. Genel stok API'si fiziksel profili kesim planı olmadan tüketemez. Üretim merkezinin işini eski tamamlama API'si yeniden mamul olarak yazamaz.

Rework, paketlenmemiş miktar için atanmış usta tarafından gerekçeyle açılır. Önceki operasyon durumları/süreleri/fotoğrafları korunur. Önceden paketlenmiş miktar geriye alınmaz. Ek sarf malzemesi ve hurda ayrıca kaydedilir. Ek profil için parça adedi ve mm boy girilir; fiziksel artık/profillerden ayrı rework kesim planına alınır. Hatalı profil hurda miktarı metre girilir ve kg/metre değeriyle ayrı kg kaydı oluşur. Ek profiller kesilmeden iş başlayamaz. Paketlenmiş ürün iadesi bu rework kısayoluyla yapılmaz; yönetici stok iadesi süreci gerekir.

Her mamul birimi ayrı etiket taşır. Kısmi üretim, paketleme, sevkiyat ve teslimat miktarları korunur. Sevkiyat standart ERP sevkiyat tablolarına da yazılır. Tamamlanan miktardan fazla üretim/sevkiyat ve ikinci tamamlamanın stok çoğaltması engellenir.

## Yetki, tekrar güvenliği ve çevrim dışı kullanım

Firma ve rol sunucuda mevcut üyelikten okunur. Çalışan atanmış işin teknik bilgilerini görür; müşteri finansmanı, bildirim listesi ve stok maliyeti verilmez. Operasyon ataması ayrıca kontrol edilir. Üretim komutları UUID ve istek hash'i taşır; aynı anahtar aynı aktör/istek için önceki sonucu döndürür. Kritik operasyon, kesim, teklif ve teslimat güncellemeleri kayıt sürümüyle kontrol edilir. Pilot stok komutları firma bazında transaction kilidi altında çalışır. Büyük ölçekli eşzamanlı üretim için bu pilot seri kilidinin yük testi ayrıca yapılmalıdır.

Açık usta ekranı bağlantı kaybında kendi kullanıcı/firma kapsamındaki IndexedDB verisiyle çalışır. Talep ve fotoğraflar cihazda tutulur; sunucu kabul etmeden kaydedilmiş sayılmaz. Sekmeler arası eşitleme kilidi vardır. Ağ geri gelince gönderim tekrar aynı komut anahtarıyla yapılır. Güncel kayıt sürümü farklıysa talep çakışma olarak kalır; kullanıcı güncel kayıtla karşılaştırır ve bekleyen talebi açıkça kaldırır. Aynı operasyonda sunucu kabulünü bekleyen komut varken ikinci komut gönderilmez. Kapalı uygulamayı çevrim dışı ilk kez açma veya çevrim dışı yeni oturum açma desteklenmez. API verisini/kullanıcı oturumunu ortak Service Worker cache'ine yazan eski worker uygulama açılışında kaldırılır.

Ekran güncellemesi kalıcı üretim olayları üzerinden SSE ve aralıklı yenilemeyle yapılır. Toplu olaylar tek yenilemede birleştirilir. Eski ağ yanıtı yeni firma/kullanıcı kapsamındaki veriyi değiştiremez; yetki reddinde cihaz özeti temizlenir.

## AI ve müşteri iletişimi

Aktif sohbet, belge ve gelen mesaj analizi sunucuda OpenAI Responses API / `gpt-6-luna`, structured output ve `store:false` kullanır. Anahtar `.env.local` içinde Git dışında tutulur. Sohbet geçmişi kullanıcı/firma kapsamındadır. AI, yazılı olmayan ölçüyü çizimin ölçeğinden tahmin etmez; belirsiz alanları işaretler. Sipariş insanın inceleyip onaylamasıyla atomik oluşur; aynı taslağın ikinci onayı aynı siparişi döndürür. Kaynak dosyalar özel firma/iş erişimine sahip dosya API'sinde tutulur ve onaylı siparişe bağlanır.

Gönderim ve gelen mesaj işleme ayrı kalıcı worker gerektirir:

```sh
npm run worker:production
```

E-posta için `RESEND_API_KEY`, doğrulanmış `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`; gelen kutusu için `EMAIL_INBOUND_TENANT_ID` / `EMAIL_INBOUND_ADDRESS` gerekir. Resend receiving API'nin döndürdüğü gerçek CDN alan adları `INBOUND_ATTACHMENT_HOSTS` içinde tanımlanır. Webhook `/api/v1/webhooks/resend`; Svix imzası doğrulanır.

WhatsApp için `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, hesabın desteklediği `WHATSAPP_API_VERSION`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` ve `WHATSAPP_INBOUND_TENANT_ID` gerekir. Yönetici ekrandan onaylı şablon adını girer. Şablon iki body parametresi bekler: sipariş numarası ve Türkçe durum açıklaması; varsayılan dil `tr`. Webhook `/api/v1/webhooks/whatsapp`; Meta HMAC imzası ve telefon numarası kimliği doğrulanır.

Bildirim kanalları varsayılan kapalıdır. Provider anahtarları tek başına gönderimi açmaz; yönetici kanal tercihini açar. Worker lease, başarısız deneme/backoff, sağlayıcı kimliği, teslimat olayı ve deneme geçmişini korur. Yanıtı alınamayan WhatsApp gönderimi otomatik yeniden gönderilmez; önce sağlayıcı kontrol edilir. Gelen mesaj tekrarları provider kimliğiyle elenir; belgeler/metin aynı inceleme ekranına gelir. Sağlayıcı hesabı/domain/şablon tanımlanmadan gerçek e-posta veya WhatsApp teslimatı doğrulanmış sayılmaz.

## Mac yerel çalışma ve doğrulama

Web klasöründen, ayrı terminallerde:

```sh
npm run db:local
npm run dev -- --hostname 127.0.0.1 --port 3000
npm run worker:production
```

`db:local` yalnız `.data/postgres` içinde loopback `127.0.0.1:55432` üzerinde kalıcı PostgreSQL açar; dışarıdaki `DATABASE_URL` değerini kullanmaz. `renkflow_dev` ve `renkflow_test` oluşturulur. `.env.local` geliştirme veritabanına bağlıdır. Yerel demo: `demo@renkflow.com` / `demo123456`. Oturum durumu başka cihazdaki canlı veritabanından taşınmaz.

```sh
npm run type-check
npm run lint
npm test -- --runInBand
npm run test:production
npm run build
npm run test:production:browser
npm run smoke:ai
```

`test:production` adresi kod içinde yalnız `renkflow_test` olarak sabitler ve sentetik firmalar oluşturur. Gerçek PostgreSQL'de teklif fiyat/yükseklik/yapılandırma korunması, teklif sürümü/tekrar güvenliği, reçete değişmezliği, aynı profile eşzamanlı rezervasyon, ölçülen fire, artığın rework'te tekrar kesilmesi, WIP/mamul dengesi, kısmi üretim/paketleme sonrası rework, çalışan/sürüm kontrolü, ters mal kabulü, kısmi sevkiyat/teslimat, iptal edilen özel takip, çift taslak onayı, çizelge, başarısız bildirim ve imzalı/tekrarlı WhatsApp webhook'u doğrulanır.

`test:production:browser`, önce üretilen test fixture'ını kullanır; yeni bir `test:production` sonrasında çalıştırılır. 3001 portunda production build'i test veritabanıyla başlatır ve çıkarken kapatır. Gerçek çalışan ve yönetici girişleriyle mobil görünüm, barkod/rol izolasyonu, bağlantı kaybında duraklatma, iki cihaz arasında sürüm çakışması ve beş aşamadan mamul stoğuna tamamlanma test edilir. Mac Chrome yolu varsayılandır; başka ortamda `CHROME_EXECUTABLE` kullanılabilir. Production build'in açıkça belirtilmiş yerel TCP veritabanıyla doğrulanması için yalnız bu test sürecinde `ALLOW_LOCAL_DATABASE=1` kullanılır; normal production Cloud SQL kontrolü varsayılan korunur.

`smoke:ai` gerçek OpenAI hesabına bir sentetik görsel gönderir ve cm→mm, ayrı açılım/montaj yüksekliği ve adedi doğrular; ücretli API kullanır. 3D masaüstü/mobil, gece/kamera/klavye, WebGL kaybı ve gerçek teklif PDF'si ayrıca tarayıcıda kontrol edildi. Bu kontroller gerçek fabrika reçetesi veya her tarayıcı/cihaz için üretim sertifikası değildir.

Migration `014_production_platform.sql`, var olan teknik `height_mm` verisini değiştirmeden üretim/3D/iletişim tablolarını ekler. Canlı devreye alma öncesinde migration'ın yedeklenmiş ayrı staging veritabanında, gerçek reçete örneklerinin uygulamada ve sağlayıcı webhooklarının staging adresinde doğrulanması gerekir.

## Tedarik, kalite ve finans çalışma alanları — devam geliştirmesi

Profesyonel üretim uygulamalarının resmi akışları incelendi: [MRPeasy tedarik](https://www.mrpeasy.com/resources/user-manual/procurement/), [MRPeasy kalite kontrol](https://www.mrpeasy.com/resources/user-manual/settings/system/professional-functions/quality-control/), [Odoo Shop Floor](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/shop_floor/shop_floor_overview.html), [Odoo kalite kontrolleri](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/quality/quality_management/quality_checks.html), [Katana üretim takibi](https://support.katanamrp.com/en/articles/5914363-how-to-manage-the-production-process) ve [Linear filtreler](https://linear.app/docs/filters). Uygulanan değişiklikler özellikle fiziksel mal kabulü, kontrol kapıları, gerçek süreler, rol kapsamı ve hata/boş sonuç ayrımına odaklanır. Kalıcı kişisel görünümler bu çalışmada eklenmedi.

- `/suppliers`: tedarikçi oluşturma/düzenleme, aktif/pasif durum ve sıfır gün dahil ödeme vadesi. Kayıt sürümü eski ekranın yeni bilgiyi ezmesini engeller.
- `/purchases`: çok kalemli satın alma taslağı, yönetici/satın alma onayı, iptal ve gerçek sipariş detayları. Fiziksel profil sayısı, mm boy, renk ve TL/metre birim fiyatıyla girilir. Vergi dahil ticari teklif fiyatı üretilmez.
- `/receipts`: onaylı siparişe bağlı kısmi kabul/red, fiziksel profil lotları ve maliyetli native stok defteri. Red miktarı REJECTED deposuna gider ve siparişin kabul miktarını artırmaz. Kullanılmamış kabul gerekçe ve sürüm kontrolüyle ters kayıt olarak düzeltilir; kullanılan veya rezerve lot geri alınamaz.
- Reçete operasyonunda geçer/kalır, ölçüm alt/üst toleransı ve zorunlu fotoğraf kontrolü tanımlanabilir. Kontroller iş emrinde korunur; tamamlamanın miktarı, denemesi, kontrol sonuçları, fotoğrafları ve kontrol eden çalışan `quality_inspections` tablosuna yazılır. Başarısız kontrol operasyonu bloke eder, miktarı ve sonraki aşamayı tamamlamaz. Yeni deneme geçmişi silmez. Gerçek toleranslar mühendislik tarafından belirlenmelidir.
- Kısmi üretimde kalan süre hesabı, önceden tamamlanan miktarın çalışma süresini tekrar kalan miktardan düşmez. Rework eski gerçek süreleri korur, yeni planlama başlangıcını ayırır.
- `/scrap`: gerçek fiziksel artık lotu, güncel kalan mm, rezervasyon durumu ve etiket; gerçekleşen kesim hurdası kg/maliyetleri. Kartlardaki hurda toplamı tüm kesim kayıtlarıdır; listeler en son 500 lot / 300 kaydı gösterir.
- `/inventory/new` ve `/inventory/:id`: native malzeme kartı, profil için doğrulanmış kg/m ve standart boy, depo bakiyesi ve lot geçmişi. Kart açmak sahte başlangıç stoğu oluşturmaz. Genel stok API'si fiziksel profil/lot veya üretim/sevkiyat referansı uydurarak operasyon akışını atlayamaz; manuel genel düzeltme yönetici ve gerekçe gerektirir.
- `/finance/payments`: banka, nakit, kredi kartı ve çek tahsilatı, gerçek sipariş bağlantısı, tekrar güvenliği, sipariş para birimi ve bakiye kontrolü. Fazla tahsilat ve kapalı döneme yazma reddedilir. Farklı para birimleri toplanmaz.
- `/finance/employees` ve kişi detayı: sürümlü personel kartı, maaş tahakkuku, avans, ödeme ve kesinti. Finans personeli uygulama giriş hesabından ayrıdır. Pasife almak mali geçmişi silmez. Kapalı dönem ve firma/rol kontrolü sunucuda yapılır.
- `/finance/documents`: firma belgeleri, kaynak sipariş ve izinli gerçek dosya bağlantıları; veri hatası boş arşiv diye gösterilmez.
- `/accounting`: seçilen aya ait altı operasyonel rapor/kontrol görünümü. TRY kapsamı açıkça gösterilir; dövizli kayıtlar TRY toplamına girmez. Maaş tahakkuku nakit ödemesi sayılmaz. Sabit vergi oranı ve doğrulanmamış sabit beyan günleri kaldırıldı. Vergi gideri kayıtlı `tax` giderinden alınır. Native stok değerlemesi son kayıtlı birim maliyeti kullanır; resmi maliyet muhasebesi/yasal bilanço değildir. Eksik maliyetler rapor uyarılarında belirtilir. Dönemi kapatma/açma firma yöneticisine aittir.
- `/reports`: gerçek iş merkezi kuyrukları, çalışma süreleri, WIP, rework ve kesim kayıpları. `/cutting-optimizer`, `/analytics`, `/members`, `/dashboard/professional` eski adresleri çalışan ilgili ekranlara yönlenir.

Migration'lar `015_procurement_workflows.sql`, `016_quality_inspections.sql`, `017_finance_workflows.sql` eklenmiştir. Mevcut kalem ölçülerini veya gerçek stok bakiyelerini yeniden yorumlamaz. Yetki kontrolleri mevcut firma üyeliğini yeniden okur; eski oturumda kalan yönetici rolü yetki vermez. Ekip daveti kopyalanamadığında bağlantı ekranda kalır; e-posta sağlayıcısı yapılandırılmadığında gönderilmiş diye bildirilmez.

Eski `pilot:manufacturing` 012 metraj pilotu fiziksel profilleri temsil etmediği için arşivlenmiştir; yazma yapmadan rehbere yönlendirir. Yeni platform testi `npm run test:production` olarak ayrı `renkflow_test` üzerinde çalışır.

Bildirim merkezi `/notifications`, `018_workspace_notifications.sql` ile mevcut bildirim şemasını kurar. Aynı kullanıcının farklı firmalardaki bildirimleri okuma, sayaç, tek okuma ve toplu okuma işlemlerinde ayrıdır. Ekranda okunmamış filtresi, sayfalama ve başarısız istekte yenileme vardır. Web Push sağlayıcısı yapılandırılmadıkça tarayıcıya gerçek push teslimatı doğrulanmış sayılmaz.

Son doğrulama: **34 test suite / 238 test**, ESLint, typecheck ve production build başarılı. Ayrı PostgreSQL testi satın alma sürümleri/rolü, fiziksel mal kabulü, karantina ve ters kayıt; kalite başarısız/geçen kontrol kapısı; ödeme para birimi/kapalı dönem/fazla tahsilat; aynı kullanıcıya ait iki firmanın bildirim ayrımı dahil mevcut üretim invariantlarını doğrular. Production tarayıcı testi gerçek oturumlarla satın alma, personel/maaş, çek tahsilatı, bildirim okuma/filtreleme, yönetilen stok hareketi uydurmanın reddi, çalışan finans izolasyonu, çevrim dışı kuyruk/çakışma ve beş operasyonu mamul stoğuna tamamlama senaryolarını yürütür. **31 yetkili ekran/eski adres ve altı muhasebe görünümü** tarandı; son koşuda sunucu 5xx veya yakalanmamış tarayıcı hatası yok. Mobil sayfa içeriğinin soldan başlaması ve tüm viewport genişliğini kullanması ayrıca kontrol edilir. Bu sonuçlar yük testi, her cihaz/tarayıcı veya gerçek sağlayıcı teslimatı kapsamı değildir.

## Kişisel görünümler ve sipariş güvenliği — 3 Ekim, devam çalışması

Sipariş listesindeki arama, durum, aşama, çalışma görünümü ve sıralama kişisel görünüm olarak sunucuda saklanır. Oluşturma, filtreleri güncelleme, kaydedilen filtreye dönme, favori, yeniden adlandırma ve silme ekran üzerinden çalışır. Aynı firma ve aynı kullanıcıyla diğer cihazlarda erişilebilir; başka kullanıcıya veya firmaya açılmaz. Filtre bağlantısı yalnız filtreleri paylaşır, kayıtlı görünüm kimliğini veya erişim yetkisini paylaşmaz. En fazla 50 görünüm; firma/kullanıcı içinde büyük-küçük harf duyarsız benzersiz ad, UUID işlem tekrarı ve eski sürüm/cihaz çakışması kontrolü vardır.

JWT yenilemesi istemcinin `session.user` değerlerini kabul etmez. İmzalı kullanıcı/firma kimliğinden güncel üyelik, rol ve kullanıcı bilgileri okunur. Üyelik kaldırıldığında oturum geçersiz olur; odak değişiminde ve çevrim içiyken 60 saniyede bir istemci yenilenir. API'ler ve server action'lar ayrıca güncel üyelik yetkisini uygular. Usta için genel sipariş ve arama sonuçları atanmış işlerle sınırlıdır; fiyatlar, iletişim bilgileri, ticari belgeler ve serbest mali alanlar sunucu yanıtına dahil edilmez. Sipariş CSV'si ve ekranları teknik kapsamı kullanır. Ticari aktivite ve belge içerik yolları da usta rolüne kapalıdır; usta not/fotoğraf işlemleri üretim ekranındadır.

Yalnız işleme alınmamış ve üretim/teklif/tahsilat/belge/stok/sevkiyat/takip kayıtlarına bağlı olmayan siparişler silinebilir. Kontrol ve silme aynı transaction ve firma kilidi içindedir. Sipariş silinmeden GCS dosyası silinmez; tamamlanan transaction dosya temizleme kuyruğu oluşturur. Worker lease ile temizler, hata halinde artan aralıklarla yeniden dener, 10 başarısız denemede `failed` durumunu ve nedeni saklar. İşletim desteği başarısız görevleri incelemeli; GCS yapılandırması olmadan fiziksel dosya temizliği gerçekleşmez. Native üretim dosyaları bu GCS kuyruğuyla karıştırılmaz. Toplu silmede korunan kayıtlar seçili kalır ve her hatanın nedeni görünür.

Ticari sipariş durumu geçişi firma/rol, sipariş sürümü ve UUID işlem anahtarıyla yapılır; durum değişimi ve aktivite geçmişi atomiktir. Native üretime bağlı siparişin durumu operasyon/sevkiyat akışından yönetilir, eski durum API'lerinden atlanamaz. Aktivite notu API'si yalnız mevcut ve yetkili sipariş/müşteriye gerçek kullanıcı adıyla `note_added` ekler; istemci durum/onay geçmişi veya değişiklik nesnesi uyduramaz. Güncel sipariş listesi server action'da eski 60 saniyelik firma önbelleğini kullanmaz; yeni API kaydı sonraki liste okumasında görünür.

Additive migration: `019_workspace_views_cleanup.sql`. Yerel dev/test veritabanlarında uygulanır; canlı migration/deployment bu çalışma tarafından yapılmaz. Worker'ın inbound, bildirim ve dosya temizleme hataları birbirinin çalışmasını durdurmaz.

Son doğrulama: **39 Jest suite / 252 test**, typecheck, ESLint ve production build geçti. İzole PostgreSQL testinde görünüm firma/kullanıcı izolasyonu, eşzamanlı eski sürüm reddi, tekrar güvenliği, belge/tahsilat/silme yarışı, başarısız dosya temizliğinin retry'ı ve atomik durum geçmişi doğrulandı. Production tarayıcı testi 31 yetkili ekran/eski adres ve altı muhasebe görünümüne ek olarak görünüm kaydet/favori/güncelle/yeniden adlandır/kaydet-aç/kopyala/sil düğmelerini, mobil düzeni, doğrudan oturum kimliği değiştirme reddini, güncel rol ve üyelik iptalini, usta sipariş/arama/aktivite/belge sınırlarını, durum ve not düğmelerini, sahte audit reddini ve karışık toplu silmede başarısız seçimin korunmasını kapsar. Çevrim dışı odak değişiminde oturum isteği yapılmadığı ve usta ekranının korunduğu ayrıca doğrulanır. Yeni API siparişi listeye hemen gelir. Gerçek GCS/e-posta/WhatsApp teslimatı ve çok kullanıcılı yük/gerçek fabrika pilotu bu testlerden ayrı işletim doğrulamalarıdır.
