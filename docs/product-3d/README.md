# Ürün 3D görselleştirmeleri

Yerel geliştirme: `codex/product-3d`. Mevcut WINMAX sahnesi korunur; diğer ürünler ayrı, tembel yüklenen Three.js modelleridir. Katalogdaki ölçü aralıkları görselleştirme girdilerini sınırlar. Üretim reçetesi, fiyat, BOM veya taşıma hesabı onayı oluşturmaz.

## Kaynaklar ve inceleme kaydı

`source-manifest.json`, renkaluminyum.com arşivindeki 699 medya kaydının URL, dosya boyutu, MD5, tekrar ilişkisi ve PDF sayfa yollarını içerir. İndirilen dosyalar: 655 görsel, 30 PDF, 14 video. İçerik hashine göre 602 ayrı görsel, 24 PDF sürümü ve 9 video vardır. Yerel araştırma arşivi `.local/product-3d-research/` altında tutulur ve Git'e eklenmez.

24 PDF sürümünün 578 sayfası görüntüye dönüştürülmüştür. Bu sayı bütün sayfaların ayrıntılı okunmuş olduğu anlamına gelmez. Güncel Türkçe 2026 katalog metninin tamamı ve ürüne özel teknik föyler okunmuş; mekanizma, kesit ve montaj çizimleri görsel olarak incelenmiştir. Eski katalog çevirileri kaynak arşivine alınmıştır; bunların tamamı bağımsız biçimde okunmuş kabul edilmez. Görsel arşivi 15 temas sayfasıyla taranmış; model kararları için ilgili fotoğraf ve video kareleri ayrıca büyütülmüştür.

Başlıca kaynaklar:

- [2026 Türkçe katalog](https://www.renkaluminyum.com/wp-content/uploads/2025/11/Mobil-Katalog-TR-2026.pdf): ürün aralığı, malzeme, seçenek ve montaj bilgileri.
- [Pergola teknik föyü](https://www.renkaluminyum.com/wp-content/uploads/2024/07/Pergola-Technical-Data.pdf): iki sayfanın metni ve kesitleri; taşıyıcı ve ön dere ölçüleri.
- [Rolling Roof teknik föyü](https://www.renkaluminyum.com/wp-content/uploads/2024/07/Rolling-Roof-Technical-Data.pdf): iki sayfanın metni ve kesitleri; 243,45 × 60,2 mm lamel, 165 mm dikme. Eski taranmış teknik şartname ve CAD kesitleri de karşılaştırılmıştır.
- [Manuel rüzgâr kırıcı föyü](https://www.renkaluminyum.com/wp-content/uploads/2024/07/Manual-Wind-Breaker-Technical-Specs.pdf): sabit 8 mm / hareketli 6 mm cam. Güncel katalogdaki alternatif yükseklik ve çift cam seçeneği ayrıca değerlendirilmiştir.
- [Manuel rüzgâr kırıcı videosu](https://www.renkaluminyum.com/wp-content/uploads/2024/05/20240307_201607000_iOS.mov): kısa sabit yan dikmeler, yukarı çıkan çerçeveli üst cam ve aşağı inen yatay denge demiri. `dense/mrk/` ve `sheets/d_mrk.jpg` kareleri karşılaştırılmıştır.

| Ürün | Modeldeki davranış | Dayanak / açık varsayım |
| --- | --- | --- |
| WINMAX makaslı | Mevcut ayrıntılı makas sahnesi | Mevcut kullanıcı çalışması korunur. |
| Pergola tente | Sıralı taşıyıcı hareketi, arkada biriken sabit uzunlukta katlı kumaş | Teknik föy, katalog ve video; kat aralığı görsel yaklaşım. |
| Rolling Roof | Önce lamel döndürme, ardından rayda toplama; makas ve ayrı teker arabaları | CAD kesiti, teknik föy ve video; gizli kol oranları yayımlanmamış. |
| Zip perde | Değişen sarım yarıçapı, yan kanal ve alt ağırlık barı | Katalog ve fotoğraf/video; kumaş kalınlığı yaklaşık. |
| Giyotin cam | Alt sabit panel önünde üç derinlikte toplanma | Katalog, montaj çizimleri ve fotoğraflardan çıkarım. |
| Manuel rüzgâr kırıcı | Alt cam yüksekliğinde sabit dikmeler; üst camla ters yönde hareket eden yatay ağırlık | Kullanıcı düzeltmesi ve üretici videosu; iç halat bağlantı detayı görsel yaklaşım. |
| Pistonlu rüzgâr kırıcı | Teleskopik dikme, üst yatay profilsiz cam, iki seviye | Fotoğraf/video; iç piston ve cam kalınlığı ölçüleri yayımlanmamış. |
| Cam tavan | Sabit eğimli cam çatı, baskı kapağı, conta ve dere | Katalog ve uygulama fotoğrafları; kesit/cam kalınlığı yaklaşık. |
| Sürme cam | Dört ayrı rayda yanal panel toplama | Broşür ve uygulama fotoğrafları; kanal kesiti yaklaşık. |
| Biyoklimatik | Sabit merkezde dönen lameller | Broşürdeki döner seçenek; gizli tahrik ve azami açı yaklaşık. |
| Kış bahçesi | Sabit cam çatı, yan camlar ve sürme ön cephe | Uygulama fotoğraflarından birleşik sahne; birleşimler mühendislik projesi sayılmaz. |
| Kasetli tente | Kapalı kaset ve montaj konsolları | Kapalı uygulama fotoğrafları; kanıtı olmayan açık kol mekanizması eklenmez. |

`previews/` içindeki 11 JPEG uygulamanın kendi sahnesinden alınmış kontrol görselleridir. Manuel modelde %0 açıklık camın yüksek, %100 açıklık alçak konumudur; denge demiri camla ters yönde ve eşit mesafede hareket eder.

## Entegrasyon

`product_visualization` JSONB alanı, ticari `product_configuration` alanından ayrıdır. Migration `049_product_visualization.sql`, teklif ve sipariş kalemlerine bu alanı ekler. Migration mevcut backend şema kontrolüne dahil edilmiştir. Eski şemada görsel kaydetme isteği 409 ile açıklanır; temel teklif akışı çalışmaya devam eder.

Görünüm; yeni sipariş, sipariş detayı, üretime alım, teklif düzenleme, teklif baskısı, müşteriye açık teklif ve sipariş takip sayfalarında kullanılır. Tekliften siparişe dönüşüm görseli korur. Görselleştirme ürün fiyatını, reçeteyi, ölçü hesabını ve BOM'u değiştirmez. Müşteri ekranında seçimler kilitlidir; kamera ve animasyon incelenebilir.

Teklif listesi, düzenleme ve A4 baskı düzeni kurumsal başlık, müşteri bilgisi, ürün kapsamı ve ticari toplamları ayırır. Müşteri teklifinde birim fiyat, kalem toplamı, şartlar ve karar alanları görünür. Düzenleme isteğinin yüklenmiş `status` alanı yüzünden durum komutu sayılması ve sessizce kaydedilmemesi de düzeltilmiştir.

## Asistan

Asistan 12 ürünün kaynaklı bilgilerini ve gerçek firma kayıtlarını kullanır. Arama kapsamı sipariş, müşteri, stok, iş emri, teklif, satın alma, tedarikçi, sevkiyat, reçete ve sipariş/teklif detaylarını kapsar. Araç aramaları üç turla sınırlıdır; ortak süre bütçesi 45 saniyedir. Bağlam geçerli JSON olarak kısaltılır ve görsel base64 ekleri modele gönderilmez.

Firma üyeliği, özel rol izinleri ve gizlenen mali/iletişim alanları hem bağlamda hem araç aramalarında uygulanır. Not ekleme ve taslak oluşturma aksiyonları sunucuda tekrar yetki kontrolünden geçer. Mevcut kişisel veri maskeleme, kullanım kaydı ve bütçe kontrolleri korunur. Modelin yanıt kalitesi için canlı sağlayıcı değerlendirmesi bu ortamda yapılmamıştır; OpenAI anahtarı yoktur.

## Doğrulama

- Jest: 126 test grubu, 871 test başarılı. Mekanizmalar, geometrinin sonlu kalması, kaynak bağlamı, özel yetkiler ve teklif kayıt hatası dahil.
- TypeScript ve üretim webpack derlemesi başarılı.
- `scripts/test-product-3d-storage.ts`: kendi geçici yerel PostgreSQL kümesini oluşturur; kayıt → okuma → düzenleme → sipariş dönüşümü, fiyat/ölçü korunması, firma izolasyonu ve gerçek asistan sorgularını kontrol eder. Hiçbir uzak veritabanına bağlanmaz.
- Tarayıcı: 11 sahne, hareketli sahnelerde beş açıklık, teklif görselini kaydetme ve yeniden yükleme, baskıda görsel, müşteri teklifinde salt okunur alanlar kontrol edildi. 390 × 844 mobil düzende sayfa ve 3D diyalog yatay taşma yapmadı; manuel ağırlık hareketi doğrulandı.
- Rolling Roof ortak bağlantı instancing ile 1081 yerine 253 çizim çağrısına indirildi. Kamera oranı mobil boyuta uyar; sahne görünmezken animasyon durur; geometri, materyal ve doku kaynakları kapatılınca bırakılır.

Yerel kontrol için `apps/web` altında `npm run dev -- --webpack --hostname 127.0.0.1 --port 4317`. `/product-3d-lab?product=wind-manual` yalnız geliştirme modunda açıktır. Kontrol görselini diske yazan geliştirme API'si firma oturumu ve aynı kaynak kontrolü gerektirir; üretimde 404 döner. Yayınlama veya uzak veritabanı migration'ı bu çalışmanın parçası değildir.
