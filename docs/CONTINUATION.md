# RenkFlow geliştirme devam kaydı

Kullanıcı 14 Ekim 2026'da Claude kullanım sınırındayken geliştirmeyi Codex'in
sürdürmesini ve limit açılınca değişiklikleri Claude'a bildirmesini istedi.
Hedef mevcut endüstriyel ERP'nin işlev, güvenilirlik, mobil kullanım ve tasarım
kalitesini yükseltmek. Program tamamlanmadı; aşağıdaki işler bitmiş sayılmamalı.

## Çalışma alanları

- Asıl Claude projesi: `/Users/beshnovski/Desktop/renkflowV2`,
  `claude/customer-import` dalında korunmuş commit edilmemiş taslaklar.
- Codex devamı: `/Users/beshnovski/Desktop/renkflow-director-audit`,
  `codex/director-audit-20261014` dalı. Çalışmaya bu dalın güncel HEAD'i üzerinden
  devam edin; eski Claude taslağını tekrar üstüne kopyalamayın.
- Claude oturumu: **RenkFlow ERP genel durum**,
  `c5b9899e-44e6-4028-be38-5cfe2da0e16b`.
- Program tablosu: `docs/ROADMAP.md`. 3D oturumu ayrı; ERP ile karıştırılmamalı.

## Birleştirilen Claude işleri

#87 muhasebe, #88 banka ekstresi, #89 KVKK, #90 UBL şema doğrulaması yerelde
birleştirildi. #87/#88 ortak muhasebe ekranındaki importlar, #87/#89/#86 ve
Codex'in 060 migration listesi ile FX/KVKK cron tanımları birlikte korundu.
Bu PR'lar GitHub'da henüz açık olabilir; yalnız yerel merge üretime geçiş değildir.

## Tamamlanan geliştirme

### Müşteri ve tedarikçi CSV aktarımı

- Claude'un müşteri taslağı tamamlandı ve tedarikçiler için ortak aktarım motoru
  kuruldu. Kullanıcı akışı: dosya → sunucuda önizleme → onay → satır sonuçları.
- Türkçe başlıklar, virgül/noktalı virgül, BOM, UTF-8 ve Windows-1254 okunuyor.
  Kapanmamış tırnak, geçersiz e-posta/kimlik, aşırı uzun alan, boş/çok büyük dosya
  veya 2.000 satırı aşan liste sessizce aktarılmıyor.
- Vergi numarası, e-posta ve telefon farklı kartlara işaret ediyorsa satır
  reddediliyor. Aynı güçlü kimliğin birden çok kayıtla eşleşmesi de reddediliyor.
- Arşivli kartlar çoğaltılmıyor/otomatik etkinleştirilmiyor. Tedarikçi adı
  benzersiz kalıyor. Müşteride yalnız ad benzerliğinden ayrı kart açma açık seçenek.
- Mevcut kartların yalnız boş alanları, ayrıca güncelleme yetkisiyle dolduruluyor.
  Tedarikçi sürümü artırılıyor; her değişiklik ve aktarım denetim kaydında.
- Dosya, seçenekler, kullanıcı/firma ve aday kartlardan üretilen parmak izi
  değişirse kayıt 409 ile duruyor. Eşzamanlı aktarımlar kartları çoğaltmıyor.
- Aynı dosyanın sonraki satırları önizlemede de yeni eklenmiş kartları görüyor;
  önizleme ve kayıt sayıları aynı. İlgisiz kart değişikliği incelemeyi bozmaz.
- Yalnız aday kartlar ve gerekli sütunlar okunuyor; tüm firmanın kartları ve
  kullanılmayan JSON/finans alanları aktarılmıyor. 10.000'den fazla adayda işlem
  açıklamayla duruyor; ilk eşleşme rastgele seçilmiyor.
- Ekranda şablon, sürükleyerek/seçerek yükleme, hata listesi indirme, filtre,
  50 satırlık sayfalama, mobil kartlar, açık/koyu tema ve erişilebilir etiketler var.
  Hata raporundaki metinler Excel formülü olarak çalıştırılmayacak biçimde yazılıyor.

Adresler: `/crm/import`, `/suppliers/import`. Liste ekranlarından erişiliyor.
API: `/api/v1/customers/import`, `/api/v1/procurement/suppliers/import`.

### Fatura güvenilirliği

- Önceki Codex düzeltmesi: XML ve alıcı posta kutusu kesim anında saklanıyor.
  Firma kartının daha sonra değişmesi gönderilen/indirilen XML'i değiştirmiyor.
- Geçici durum sorgulama hatası görünür ve denetlenebilir. Belirsiz teslimatta
  ikinci send yapılmıyor; aynı sağlayıcı kimliği sorgulanıyor. Sonraki başarı
  hata mesajını temizliyor.
- Migration `060_e_invoice_document_snapshot.sql` gerekiyor. Eski gönderilmiş
  faturanın özgün XML'i saklanmamışsa yeniden üretip özgün diye sunulmuyor.

### Kullanım kalitesi

CRM ve tedarik ekranındaki iç içe main kaldırıldı. Yeni sayfalarda yükleme
yetkisizlik mesajı olarak gösterilmiyor. Breadcrumb içe aktarımı doğru adlandırıyor.
Reduced-motion uyumu korundu; Next smooth-scroll işareti ve üç eski lint
bastırma uyarısı düzeltildi.

## Doğrulama

- `npm run test:integration`: **37/37** betik, sıfırdan kurulmuş yerel PostgreSQL.
- Gerçek tarayıcı: sentetik sahip hesabıyla müşteri ve tedarikçi CSV'si →
  önizleme → boş alan doldurma → onay → kayıt; tekrar yüklemede yeni kayıt yok.
- Önizleme arası müşteri notu değiştirilince kayıt durdu; yenilenen önizlemeden
  sonra kayıt yapıldı ve aradaki not korundu. Veritabanı sonucu ayrıca okundu.
- Gerçek HTTP/session: sahip önizlemesi 200; usta ve cross-site 403; eksik/değişmiş
  önizleme 409; bozuk CSV 400. Reddedilen isteklerde veritabanı değişmedi.
- 390 px mobil: yatay sayfa taşması yok, tek h1, iç içe main yok, etiketsiz alan
  yok. Açık/koyu tema kontrol edildi. Konsolda yeni uygulama hatası görülmedi.
- Son tam `npm run validate` başarılı: **149 paket / 1.091 Jest testi**, tip
  kontrolü, hatasız/uyarısız lint, ortam/backend/firma kapsamı kapıları ve production build.

Görseller ve ayrıntılı raporlar `/Volumes/HIKSEMI/RenkFlow V2/review-reports` içinde.
Yalnız sentetik yerel veri kullanıldı; üretim verisi veya hesap sırları taşınmadı.

### Kontrolleri yeniden çalıştırma

```sh
cd apps/web
npm run validate
npm run test:integration
```

Gerçek HTTP kontrolü ayrıca açık bir **yerel** sunucu ve sentetik fixture ister:
`RENKFLOW_TEST_DB_PORT` ile izole test PostgreSQL'ini seçin,
`npm run preview:imports:seed` ile fixture hazırlayın. Aynı yerel DB ve test
AUTH_SECRET ile sunucuyu açıp `npm run test:imports:http -- http://127.0.0.1:3131`
çalıştırın. Betikler dış URL ve production DB kabul etmez.

## Sıradaki geliştirme paketleri

1. Ürün ve stok toplu aktarımının mevcut CSV/sayım akışlarıyla tamamlanması.
2. Ekipman bakım planı, arıza/duruş defteri ve gerçek verilere dayalı OEE.
   Planlı süre, çalışılan süre, ideal çevrim ve sağlam/red üretim olmadan yüzde uydurmayın.
3. Fason iş akışı; verilen malzeme, teslimat, kısmi kabul, maliyet ve kalite bağlantısı.
4. Native Android/iOS girişte 2FA kod/kurtarma akışı. Web MFA tamamlandı diye
   saha uygulamasının MFA desteğini tamamlandı saymayın.
5. RLS/firma izolasyonu ve CI'da gerçek tarayıcı/erişilebilirlik kapısı.
6. Defter bazlı raporların giderlerle tamamlanması; bordro köprüsü ve muhasebeci
   dışa aktarımı. Yasal hesap kurallarını resmi kaynaklardan doğrulayın.
7. Müşteri portalı, belge erişimi, RFQ e-postası ve uygun sağlayıcıyla SMS.
8. Özel alanlar, pivot rapor ve montaj/servis zaman kayıtları.
9. Sayfa başlığı/form/listelerin tutarlılığı; dokunmatik montaj takvimi;
   ölçülmüş yük/Web Vitals, gerçek yedek geri yükleme provası.

Her paket gerçek veritabanı, rol/firmalar arası negatif testler, ilgili ekran
ve hata yollarıyla tamamlanmalı. Üretim e-Belge entegratörü, Sentry DSN, banka/SMS
sözleşmesi, mağaza imzası ve gerçek saha pilotu için dış bilgiler eksik.
Web/e-ticaret/POS, genel API ve genel proje yönetimi için mevcut iç operasyon
stratejisi korunuyor; bunlar sessizce tamamlandı veya kullanıcı isteğinden
çıkarıldı sayılmamalı. İhtiyaç/scope daha sonra açıkça kararlaştırılmalı.

## Claude'a bildirim

Limit açıldığında bu dosyayı ve güncel git diff/commitleri Claude'a iletin.
Asıl oturumda canlı bir iş varken aynı session'ı ikinci süreçte resume etmeyin.
Bildirim gerçekten gönderilip yanıt alınmadıysa gönderildi demeyin.
30 dakikalık sohbet takibi geliştirme ve devir işlemini sürdürüyor.
