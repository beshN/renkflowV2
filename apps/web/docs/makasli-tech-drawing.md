# Makaslı tente: ilk teknik çizim dilimi

Siparişin teknik dosyasında **İmalat ölçü föyü / PDF** bağlantısı, `/orders/<id>/manufacturing` görünümünü açar. Kayıtlı makaslı tente kalemleri için önden ve yandan ölçü şeması gösterilir. Yazdır / PDF olarak kaydet tarayıcının mevcut yazdırma akışını kullanır; sunucuda PDF dosyası üretilmez. SVG saf `makasliDrawing` fonksiyonundan gelir.

## İncelemede bulunan mevcut yapı

- `products/families.ts`, makaslı ailede widthMm, projectionMm, mountingHeightMm alanlarını tanımlar. `configuration.ts` / `configure.service.ts`, reçete parametrelerini, malzeme/kesim listesini ve fiyat kaynağını kaydeder. `configuredLine` ve `awning/configuration.ts:applyAwning` ölçüleri kalem alanlarına taşır. Order kaleminde width_mm, projection_mm, mounting_height_mm zaten bulunur (013/014 migration). Yeni migration gerekmez.
- Reçete motoru özel parametre tanımlarını destekler; bu ilk dilimde sabit bir kol sayısı/kol yerleşimi sözleşmesi yoktur. 3D model/DEFAULT_AWNING veya reçete varsayılanları teknik ölçü kaynağı olarak kullanılmaz.
- `OrderTechnicalPanel`, yüklenen föy, revizyon, teknik onay ve kesim planını zaten gösterir. `foy/pdf.server.ts` PDF üreticisi değil, PDF.js ile mevcut belgeden metin/çizgi okuyucusudur. `MeasuredFoyView`/`FoySchema` yüklenen belgenin görünümleridir; belge ölçüleri cm olabilir.
- `ProductDrawing` mevcut genel React SVG şemasıdır: pergola/giyotin için önden/plan görünüşleri vardır; pergola açılımı eksikse enin %60'ı kullanılır. Yeni makaslı çizimi bunu kullanmaz; salt gerçek kayıtlı ölçülerden önden/yandan görünüş verir.
- `production/cut-plans/[id]/print` mevcut kesim föyünü tarayıcıdan yazdırır/PDF kaydeder. `quotations/[id]/print` + `QuotationDocument` teklif çıktısını aynı yolla verir. Bu akışlara ve teklif PDF'ine müdahale edilmedi.

## Ölçü ve güvenlik sözleşmesi

Tek kaynak sipariş kalemindeki üç mm kolonudur. JSON konfigürasyonundaki değerler veya üst sipariş ölçüleri eksik kolonun yerine konmaz. Sıfır, negatif ve sonlu olmayan değer de eksiktir: SVG üretilmez, `ölçü eksik: <alan>` yazılır. Ürün ailesi öncelikle kayıtlı konfigürasyondan, eski kalemlerde yalnız tam “Makaslı tente” / “WINMAX Makaslı Tente” adıyla belirlenir. Geniş ad eşleşmesi yapılmaz; motor/aksesuar adları aile kanıtı sayılmaz. Profil adı/kodu eklenmez veya tahmin edilmez. Miktar/para toplamı yoktur.

Çizim yalnız toplam genişlik/açılım ve montaj yüksekliğinin ortak ölçekli şemasıdır. Dik çizgiler montaj referansını belirtir; taşıyıcı profil veya dikme reçetesi değildir. Eğim, kumaş düşümü, kol konumu/sayısı, delik veya profil kesiti çizilmez. Onaylı imalat/kesim planının yerine geçmez. İmalat öncesi insan kontrolü gerekir; mevcut AI insan onayı akışları değiştirilmez.

API oturumdan doğrulanmış actor alır, mevcut `needTechnical` rol/güncel üretim görünüm yetkisini kullanır. Sipariş tenant filtreli; order_items doğrudan tenant kolonu taşımadığından orders join'i hem ON hem WHERE içinde oturum tenant'ına sınırlandırılır. Yanıt private/no-store. Worker için tenant içindeki iptal edilmemiş iş emrinde atama şartı `technicalWorkspace` ile ortak `requireTechnicalAssignment` yardımcısından uygulanır; atanmamış worker 404 alır. Panel worker modunda çizim bileşenini hiç oluşturmaz; proxy allowlist genişletilmez. Yazma, audit veya onay komutu yoktur.

#134–#140 dosya listeleri incelendi; bu dilimin değiştirdiği dosyalarla ortak dosya yoktur. Bu PR'ların dalları ve içerikleri değiştirilmedi.

## Sonraki bağımsız dilimler

İnsan tarafından doğrulanmış mekanizma/eğim/kol ve profil verisi sözleşmesinden sonra ayrıntılı teknik geometri; ardından ayrı PR'larda DXF, teklif PDF'ine entegrasyon, diğer ürün aileleri ve düzenlenebilir çizim değerlendirilebilir. ERP, mobil veya çok kiracılı mimari genişlemesi bu dilimde yoktur.

## İnceleme düzeltmeleri ve doğrulama

- Worker atama kuralı ortaklaştırıldı; atanmış/atanmamış, yabancı tenant iş emri ve iptal edilmiş atama senaryoları kapsanır. `technicalWorkspace` içindeki mevcut “other” aile istisnası korunur; makaslı çizim okuyucusu atanmamış worker'a her durumda 404 verir. Worker görünümünde çizim bileşeni oluşturulmaz. Mevcut null mock yerine görünür bir test bileşeniyle worker'da yokluğu ve office'te varlığı sınanır.
- Boş panel gizlenir; yazdırma görünümünde boş durum açıklaması korunur. Kalem UUID yerine ürün adı/sıra no gösterilir; ölçüler Türkçe ondalık virgülle yazılır. Görünüş başlıkları gerçek çizim genişliğinde ortalanır, iki görünüşte montaj yüksekliği etiketi bulunur. İç içe main kaldırılır. Aksesuarları yakalayan geniş ad eşleşmesi daraltılır.
- `npm run type-check`: başarılı. `npm run lint`: başarılı (değişmeyen dosyalarda üç mevcut uyarı).
- İlgili dört Jest paketi / 21 test başarılı.
- `npm run test:integration -- order-drawing order-technical`: 2/2 başarılı. Runner geçici yerel PostgreSQL kümesini hazırlar; yeni script yalnız `localTestDatabaseURL()` ile loopback `renkflow_test` kullanır, hem fixture bağlantısının hem gerçek uygulama havuzunun DB adı/adresini fixture yazmadan doğrular. Gerçek servis ve gerçek SQL ile iki tenant'ın pozitif/negatif okumaları, yabancı kalemin dışlanması, worker ataması, eksik açılımda mesaj ve SVG yokluğu, aksesuar dışlanması test edilir. Fixture'lar açıkça sentetiktir ve temizlenir; runner kümeyi siler.
- `order_items` tenant kolonu taşımaz; sahipliği parent order belirler. Test yabancı siparişe ait kalemin kendi sipariş okumasına katılamadığını doğrular; veritabanına yeni composite FK/RLS eklenmiş olduğu iddia edilmez.
- Build özgün next.config.js ile yalnız loopback renkflow_test URL override kullanılarak başarılı; standalone PDF worker ve gerçek föyden Türkçe metin çıkarma kontrolleri dahil. Test/build için bu turda geçici Next config ayarı gerekmedi; sandbox IPC/yerel süreç kısıtı nedeniyle gerekli süreç erişimiyle çalıştırıldı.
- Gerçek HTTP oturum/proxy zinciri, non-owner RLS, oturumlu tarayıcı, PDF sayfalama/görsel çıktı ve fiziksel fabrika doğrulaması yapılmadı. Yeni migration/seed eklenmedi. Hazır mevcut şema yalnız runner'ın geçici yerel geliştirme/test kümesinde uygulandı; production/Preview DB, Neon ve Vercel'e işlem yapılmadı.
- Son tam Jest turu: gerçek Debian `xmllint` yalnız `work/review-141/xmllint/extracted/usr/bin` içinden PATH'e eklenerek **227 paket / 1691 test başarılı**. Önceki turda aynı yedi XSD testi `xmllint` yokluğundan başarısızdı; doğrulayıcı yerine sahte araç kullanılmadı, repo bağımlılıkları/lockfile değişmedi.
- GitHub Validate Web App önceki commit için mevcut: run 41760555081 pending, validate/audit işleri queued; uzaktaki CI başarı sonucu henüz doğrulanmadı. Workflow self-hosted macOS runner kullanıyor; runner veya Vercel ayarları değiştirilmedi.
