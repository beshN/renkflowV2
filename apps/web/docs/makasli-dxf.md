# Makaslı tente DXF — ilk dilim

`/orders/<id>/manufacturing` föyündeki **DXF indir** bağlantısı, `GET /api/v1/orders/<id>/drawing/dxf` üzerinden ASCII DXF indirir. #141 üstüne yığılıdır; base `codex/makasli-tech-drawing`, head `codex/makasli-dxf`.

## Tek geometri ve erişim kaynağı

#141 çizgileri doğrudan SVG metnine yazıyordu. Aynı fonksiyonun çizgi/metin üretimi `makasliGeometry` modeline ayrıldı; SVG ve saf `makasliDxf` bu modeli tüketir. Geometri, ölçü sorgusu veya yetki kuralı kopyalanmaz. Eski JSON sözleşmesi korunur. Dört farklı ölçü kümesinde önceki SVG ile bayt düzeyinde eşitlik ayrıca doğrulandı; PDF akışı değiştirilmedi.

`orderDrawingModels`, #141'in mevcut oturum actor'ü / `needTechnical` / tenant filtreli orders ve order_items parent join'i / iptal edilmemiş tenant içi worker ataması kontrolünü aynen kullanır. DXF route doğrulanmış oturumdan actor alır; tenant istemciden alınmaz. private/no-store ve attachment yanıtı verir. Worker proxy allowlist'i ve panel erişimi genişletilmez.

Kaynak yalnız kayıtlı width_mm, projection_mm, mounting_height_mm kolonlarıdır. Eksik, sıfır, negatif veya sonlu olmayan ölçüde o kalemin hiçbir konturu çizilmez; föyün eksiklik mesajı DXF metnine aktarılır. Konfigürasyon/varsayılan/tahmin ile tamamlama yoktur. Farklı miktar veya ölçü birimleri toplanmaz ya da dönüştürülmez.

## DXF sözleşmesi

- AC1009 (R12), HEADER/TABLES/BLOCKS/ENTITIES, ENDSEC ve EOF; CRLF ASCII.
- `$INSUNITS=4`, `$MEASUREMENT=1`. Koordinatlar gerçek mm'dir: mevcut SVG görünüş ölçeği geri alınır ve Y ekseni CAD yönüne çevrilir. Eski R12 okuyucuları daha yeni bir başlık değişkeni olan INSUNITS'i yok sayabilir; çizgi uzunlukları yine mm değerindedir.
- KONTUR ve OLCU_ETIKET katmanları; LINE ve TEXT. Ölçü çizgileri/etiketler ikinci katmandadır; düzenlenebilir CAD DIMENSION nesneleri bu dilimde yoktur.
- Türkçe metinler uyumluluk için açıkça ASCII'ye çevrilir: `Çığ Şİ ölçü` → `Cig SI olcu`. Kontrol karakterleri/yeni satırlar boşluk olur, diğer ASCII dışı karakterler güvenli boşluğa döner; `%` format kaçışını önlemek için `?` olur. R12 kod sayfası/font bağımlılığı yoktur. SVG Türkçesi değişmez. Uzun metinler TEXT sınırını aşmamak için parçalara ayrılır.
- Birden fazla kalem ayrı yerleşim ofsetleriyle çizilir. Kol, eğim, delik, profil kesiti veya imalat reçetesi uydurulmaz. İnsan onayı gerekliliği dosyada da yazılıdır.

Üretim bağımlılığı yoktur. Yalnız devDependency `dxf-parser` (+ geçişli loglevel), çıktıyı bağımsız bir okuyucuyla yeniden okumak ve gerçek mm çizgi uzunluklarını doğrulamak için eklendi.

## Doğrulama

- apps/web type-check başarılı (Node 22).
- Lint başarılı; kapsam dışındaki üç mevcut uyarı.
- Tam Jest: 228 paket / 1705 test başarılı (Node 22). İlk turdaki yedi mevcut XML testi ortamda xmllint yokluğundan hatalıydı; resmi Debian gerçek xmllint ikilisi yalnız work/ altına çıkarılıp PATH'e eklenerek tam tur geçti. Repo/sistem için XML bağımlılığı eklenmedi.
- İlgili beş Jest paketi: 35/35 başarılı. DXF bölüm dengesi/EOF, AC1009/mm başlığı, katmanlar, bağımsız parser ile gerçek uzunluklar, eksik/geçersiz ölçüler, Türkçe/kaçış metni, çoklu kalem, oturumsuz/yetkisiz/yabancı tenant ve atanmamış worker route senaryoları.
- `npm run test:integration -- order-drawing order-technical`: 2/2 başarılı. #141'in gerçek yerel PostgreSQL testi DXF modeli/çıktısıyla genişletildi: iki tenant'ın kendi verisi, karşılıklı yabancı sipariş reddi, yabancı kalem dışlanması, atanmamış/yabancı tenant/iptal worker atamalarının reddi ve geçerli atama, eksik ölçüde kontur yokluğu. Fixture'lar yalnız geçici loopback renkflow_test içindedir ve temizlenir.
- CI `.github/workflows/validate.yml` içindeki mevcut validate job'u tüm `test-*.ts` scriptlerini geçici yerel PostgreSQL ile çalıştırır; genişletilmiş test otomatik keşfedilir. codex/** push tetikleyicisi bu stacked dalı kapsar. Workflow değiştirilmedi.
- Build başarılı (Node 24 ortam varsayılanı; uygulama adresi yalnız loopback test DB ile override edildi); standalone PDF worker ve gerçek föy Türkçe metin çıkarma postbuild kontrolleri dahil.
- Backend guard, tenant-scope guard ve env:audit başarılı. **Tam validate yeşil değildir:** mevcut tenant-scope-sql guard bu PR'da değişmeyen beş SSO sorgusunu reddeder: app/api/auth/sso/callback/route.ts:36 ve lib/features/auth/sso.ts:192/225/447/490. Kapsam dışı auth sorguları veya guard istisnaları değiştirilmedi. CI başarı sonucu olarak sunulmaz.

Gerçek HTTP oturum/proxy zinciri, oturumlu tarayıcı indirmesi, AutoCAD/LibreCAD görsel kontrolü, non-owner RLS ve fiziksel fabrika doğrulaması yapılmadı. Parser round-trip CAD uygulaması doğrulamasının yerine geçmez.

#133–#144 dosya listeleri salt okunur incelendi. #134/#135/#138/#139 ile package.json ortak; bu dal yalnız bağımsız parser devDependency satırını ekler. #141 ve diğer PR dallarına yazılmadı. Migration, seed, sahte üretim verisi, 3D, CAD editörü, landing/panel tasarım değişikliği yoktur. ERP/mobil/multi-tenant kapsamı genişletilmedi. Production/Neon/Vercel/canlı DB'ye işlem yapılmadı; sır eklenmedi; main push veya merge yoktur. AI çıktısı insan onayı gerektirir; inceleme ve merge Berat'a aittir.
