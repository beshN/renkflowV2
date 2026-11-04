# Makaslı tente: ilk teknik çizim dilimi

Siparişin teknik dosyasında **İmalat ölçü föyü / PDF** bağlantısı, `/orders/<id>/manufacturing` görünümünü açar. Kayıtlı makaslı tente kalemleri için önden ve yandan ölçü şeması gösterilir. Yazdır / PDF olarak kaydet tarayıcının mevcut yazdırma akışını kullanır; sunucuda PDF dosyası üretilmez. SVG saf `makasliDrawing` fonksiyonundan gelir.

## İncelemede bulunan mevcut yapı

- `products/families.ts`, makaslı ailede widthMm, projectionMm, mountingHeightMm alanlarını tanımlar. `configuration.ts` / `configure.service.ts`, reçete parametrelerini, malzeme/kesim listesini ve fiyat kaynağını kaydeder. `configuredLine` ve `awning/configuration.ts:applyAwning` ölçüleri kalem alanlarına taşır. Order kaleminde width_mm, projection_mm, mounting_height_mm zaten bulunur (013/014 migration). Yeni migration gerekmez.
- Reçete motoru özel parametre tanımlarını destekler; bu ilk dilimde sabit bir kol sayısı/kol yerleşimi sözleşmesi yoktur. 3D model/DEFAULT_AWNING veya reçete varsayılanları teknik ölçü kaynağı olarak kullanılmaz.
- `OrderTechnicalPanel`, yüklenen föy, revizyon, teknik onay ve kesim planını zaten gösterir. `foy/pdf.server.ts` PDF üreticisi değil, PDF.js ile mevcut belgeden metin/çizgi okuyucusudur. `MeasuredFoyView`/`FoySchema` yüklenen belgenin görünümleridir; belge ölçüleri cm olabilir.
- `ProductDrawing` mevcut genel React SVG şemasıdır: pergola/giyotin için önden/plan görünüşleri vardır; pergola açılımı eksikse enin %60'ı kullanılır. Yeni makaslı çizimi bunu kullanmaz; salt gerçek kayıtlı ölçülerden önden/yandan görünüş verir.
- `production/cut-plans/[id]/print` mevcut kesim föyünü tarayıcıdan yazdırır/PDF kaydeder. `quotations/[id]/print` + `QuotationDocument` teklif çıktısını aynı yolla verir. Bu akışlara ve teklif PDF'ine müdahale edilmedi.

## Ölçü ve güvenlik sözleşmesi

Tek kaynak sipariş kalemindeki üç mm kolonudur. JSON konfigürasyonundaki değerler veya üst sipariş ölçüleri eksik kolonun yerine konmaz. Sıfır, negatif ve sonlu olmayan değer de eksiktir: SVG üretilmez, `ölçü eksik: <alan>` yazılır. Ürün ailesi öncelikle kayıtlı konfigürasyondan, eski kalemlerde mevcut aile tanıma yordamından belirlenir. Profil adı/kodu eklenmez veya tahmin edilmez. Miktar/para toplamı yoktur.

Çizim yalnız toplam genişlik/açılım ve montaj yüksekliğinin ortak ölçekli şemasıdır. Dik çizgiler montaj referansını belirtir; taşıyıcı profil veya dikme reçetesi değildir. Eğim, kumaş düşümü, kol konumu/sayısı, delik veya profil kesiti çizilmez. Onaylı imalat/kesim planının yerine geçmez. İmalat öncesi insan kontrolü gerekir; mevcut AI insan onayı akışları değiştirilmez.

API oturumdan doğrulanmış actor alır, mevcut `needTechnical` rol/güncel üretim görünüm yetkisini kullanır. Sipariş tenant filtreli; order_items doğrudan tenant kolonu taşımadığından orders join'i hem ON hem WHERE içinde oturum tenant'ına sınırlandırılır. Yanıt private/no-store. Yazma, audit veya onay komutu yoktur.

#134–#140 dosya listeleri incelendi; bu dilimin değiştirdiği dosyalarla ortak dosya yoktur. Bu PR'ların dalları ve içerikleri değiştirilmedi.

## Sonraki bağımsız dilimler

İnsan tarafından doğrulanmış mekanizma/eğim/kol ve profil verisi sözleşmesinden sonra ayrıntılı teknik geometri; ardından ayrı PR'larda DXF, teklif PDF'ine entegrasyon, diğer ürün aileleri ve düzenlenebilir çizim değerlendirilebilir. ERP, mobil veya çok kiracılı mimari genişlemesi bu dilimde yoktur.

## Bu çalışmadaki doğrulama

- `npm run type-check` başarılı; `npm run lint` başarılı (değişmeyen dosyalarda üç mevcut uyarı).
- SVG, API/servis tenant sınırı, yazdırma/eksik ölçü ve mevcut teknik onay regresyonu: dört paket / 16 test başarılı. Tenant A/B karşılıklı 404 kontrolü gerçek servis/API ile mock SQL sınırında yapılır; gerçek PostgreSQL/RLS veya HTTP oturum zinciri testi değildir.
- Tam `npm test -- --runInBand`: 226/227 paket, 1679/1686 test başarılı; e-fatura XSD paketinin yedi testi ortamda `xmllint` bulunmadığından (`ENOENT`) başarısız. Tam paket yeşil değildir.
- Yerel `renkflow_test` loopback URL override ile `npm run build` başarılı; standalone PDF worker ve gerçek föyden Türkçe metin çıkarma postbuild kontrolleri dahil. Bu, yeni görünümün görsel PDF kontrolü değildir.
- Next TypeScript CLI `--showConfig` çıktısını bu ortamda okuyamadığı için yalnız test/build sırasında `experimental.useTypeScriptCli=false` yerel geçici ayarı kullanıldı; özgün next.config.js geri kondu, PR'a ayar değişikliği dahil edilmedi. İlk sandbox Turbopack denemesi durduruldu; başarılı build gerekli yerel süreç/port erişimiyle çalıştırıldı.
- Gerçek DB entegrasyonu, RLS, oturumlu tarayıcı uçtan uca testi, PDF sayfalama/çıktı görsel kontrolü ve fiziksel fabrika doğrulaması yapılmadı. Migration/seed veya DB bağlantı komutu çalıştırılmadı. Production/Preview DB, Neon ve Vercel'e işlem yapılmadı.
