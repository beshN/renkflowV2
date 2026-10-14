# Codex direktör denetimi — 14 Ekim 2026

Aktif Claude görevi: **RenkFlow ERP genel durum**, `c5b9899e-44e6-4028-be38-5cfe2da0e16b`.
Asıl proje `/Users/beshnovski/Desktop/renkflowV2`. Denetim ve düzeltme ayrı
`codex/director-audit-20261014` dalında, `/Users/beshnovski/Desktop/renkflow-director-audit`.
Taban `5051df4c` (PR #86 sonrası). Asıl çalışan oturumun dalı/dosyaları değiştirilmedi.

## Doğrulanıp düzeltilen kusur

`ublInput` satıcıyı güncel `tenants` kaydından okuyordu. `invoiceXml` her indirmede
XML'i yeniden oluşturuyordu; kuyruk da güncel müşteri posta kutusunu kullanıyordu.
Fatura kesildikten sonra firma unvanı değişince eski belgenin XML'i değişiyordu.
Bu durum gerçek PostgreSQL'de testle yeniden üretildi: düzeltme öncesi test başarısız,
düzeltme sonrası başarılı.

- Kesim transaction'ında XML ve alıcı posta kutusu kaydediliyor.
- İlk gönderim, yeniden deneme ve indirme aynı XML'i kullanıyor.
- Yeni migration: `060_e_invoice_document_snapshot.sql`; release listesine eklendi.
- Daha önce gönderilmiş, XML'i kaydedilmemiş belge için 409 ve entegratörden alma
  açıklaması veriliyor; özgün belgeymiş gibi yeniden üretilmiyor.
- Eski kuyrukta yalnız hiç gönderim denenmemiş belge bir kez sabitlenebiliyor.
- Migration olmadan e-Belge kesme/gönderme 503 ile anlaşılır biçimde duruyor.

## Claude'a devam ve kabul görevleri

1. Bu düzeltmeyi güncel main ile birleştirirken #87 muhasebe ve #90 UBL şema
   düzeltmesini koru. `060` dosya adı varsa farklı bir ad seçip release listesini
   ve açıklamaları birlikte güncelle. Production migration'ını yedek ve prova
   koşulları sağlanmadan uygulama.
2. `docs/ROADMAP.md` durumlarını gerçek PR merge/CI sonuçlarıyla yenile. "Kod
   birleşti", "yerelde doğrulandı", "canlı yapılandırıldı" ve "dış girdi bekliyor"
   sonuçlarını birbirine karıştırma. DSN olmadan Sentry canlı doğrulandı sayılmaz.
3. `drainEInvoices` polling bölümünde sağlayıcının `status: 'error'` yanıtı ve
   fırlattığı hata şu anda yalnız sonraki sorgu saatini ileri atıyor; mesajı
   kaydetmiyor. Hata mesajını kullanıcıya görünür tut. Belirsiz teslimat durumunda
   otomatik ikinci gönderim üretme; sağlayıcı kimliğiyle sorgulamaya devam et.
   Test: sağlayıcı hata → sonraki sorguda accepted; arada hata görünür, send sayısı 1.
4. Geri yükleme runbook'undaki salt okunur dal karşılaştırmasını gerçek restore
   provası diye kapatma. Ayrı test dalına geri yükle, veri/şema/ilişkiler ve
   uygulama erişimini doğrula; süreyi ve sonuçları kaydet. coming-soon bütün
   yazmaları durdurmaz: subscribe, auth ve ayrı production worker çalışabilir.
   Dondurulacak yazıcıları ve yeniden açma adımlarını açıkça tarif et.
5. MFA webde var, mobil açık MFA hesabını reddediyor. Native girişe kod ve
   kurtarma akışını ekle; yanlış kod, tekrar kod, iptal edilen oturum ve çevrimdışı
   durumları doğrula. Mobil desteği olmadan genel 2FA işi bitmiş sayılmaz.
6. CI'da gerçek tarayıcı/e2e ve erişilebilirlik kapısı yok. Giriş → teklif →
   sipariş → üretim → fatura → tahsilat zincirini masaüstü ve mobilde doğrula.
   Firma/rol izolasyonunu negatif testlerle de sınamalısın; test sayısı tek başına
   tamamlanma kanıtı değildir.
7. Yol haritasında henüz açık RLS, yük/Web Vitals, bordro dışa aktarımı, toplu
   müşteri/tedarikçi/ürün/stok içe aktarma, RFQ e-postası/SMS, portal, ekipman/fason,
   stok maliyet yöntemi, özel alan/pivot, zaman kaydı ve kullanım kalitesi
   maddelerini ayrı kabul ölçütleriyle tamamla. "Öncelik dışı" ile "tamamlandı"
   aynı sonuç değildir. Gerçek entegratör, hesap anahtarları, mağaza imzası ve
   gerçek veri pilotunun eksikliğini açıkça belirt.

## Doğrulama sonucu

`5051df4c` tabanı + bu düzeltme üzerinde `npm run validate` başarılı:
144 Jest paketi / 1.038 test, tip kontrolü, lint (0 hata, 3 mevcut uyarı) ve
production build geçti. `npm run test:integration` taze yerel PostgreSQL'de
32/32 betik geçti. XML değişmezliği regresyonu düzeltme öncesinde başarısız,
düzeltme sonrasında başarılı. Gerçek entegratör veya production migration
çalıştırılmadı; tarayıcı akışı bu düzeltmede ayrıca denenmedi.

## Erişim ve devam

Mac ekranı kilitli; parola istenmedi. Resmi Claude Code CLI ile bağımsız salt
okunur denetim çağrısı yapıldı, fakat Claude kullanım sınırı yanıtı verdi:
13:20 Europe/Istanbul. Mevcut çalışan oturum eşzamanlı resume edilmedi.
Bu sohbette 30 dakikalık takip etkin; yeni sonuçlar geldikçe görev ve test durumu
tekrar değerlendirilecek. Tamamlanmamış program için tam başarı iddia edilmemeli.
