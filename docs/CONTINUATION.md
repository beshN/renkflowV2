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

### Stok sayımı CSV aktarımı — ikinci geliştirme paketi

- `/inventory/count-import` artık PDF yanında CSV kabul ediyor. Türkçe CSV
  şablonu, UTF-8/Windows-1254 okuma, virgül/noktalı virgül ve BOM var; 2 MB ve
  500 satır sınırı uygulanıyor. Malzeme, miktar ve birim zorunlu. Bilinmeyen veya
  tekrarlanan sütunlar reddediliyor; satırdaki hatalar açıkça gösteriliyor.
- Adet/takım/boy tam sayı kalıyor. Metre profilinde kod, gramaj ve toplam ağırlık;
  boyda mm cinsinden çubuk boyu gerekiyor. Ölçü/renk/durum çelişkisi, gramaj
  tutarsızlığı, yinelenen kalem ve geçersiz sayı uygulamaya alınmıyor. Boyasız
  renk boyalı karta dönüşmüyor; sözlük prototip adları geçerli birim sayılmıyor.
- Mevcut yönetici öneri/onay yolu korunuyor: yükleme stoğa yazmaz. Adet/takım
  onayda yalnız mevcut bakiyeyi aşan fark kadar girer. Metre/boy kartı onaydan
  sonra fiziksel çubuk sayımı bekler; boyları/adetleri tahmin edilmez.
- CSV'nin kodlaması, ayıracı veya satır sırası değişince aynı içerik yeni belge
  sayılmıyor. Aynı firmanın iki depo kuyruğunda eşzamanlı onay da tek belge
  oluşturur; diğer işlem 409 alır. Farklı firmanın aynı listesi ayrı kalır.
- Sayım onayları firma kilidiyle sıralanıyor; bakiye farkı, diğer stok
  hareketlerinin kullandığı bakiye satırı kilitlenerek hesaplanıyor. Eşzamanlı
  20/30 sayımları 30 stok bırakır, iki farkı üst üste eklemez.
- Üretilen stok kodu farklı adlı karta çarpışırsa satır durur. Bir profil kimliği
  birden fazla kartla eşleşirse rastgele kart seçilmez. Pasif kart canlandırılmaz.
- Mobil kartlar, renk gösterimi, dosya satırı, 50 satırlık sayfalama, açık/koyu
  tema; iç içe main düzeltmesi ve sayım breadcrumb'ı var. Dosya/depo değişikliği
  eski sonucu temizler; çift gönderim, okuma hatası ve unmount ele alındı.
- Yeni migration gerekmiyor. Genel ürün/mamul kartı aktarımı ve reçete aktarımının
  önizleme bağlama kontrolü ayrı açık işler; toplu aktarım programı bitmiş değil.

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

- Önceki birleşik paket: `npm run test:integration` **37/37** betik geçti.
- CSV sayım paketinin son kontrolü: taze yerel PostgreSQL ile **5/5** betik
  (`count-csv`, `count-import`, `warehouse`, `stock-depth`, `stock-threshold`).
  Yeni `test-count-csv.ts` runner tarafından otomatik keşfedilir; güncel tüm
  38 betik birlikte yeniden koşulmuş diye raporlanmamalı.
- Gerçek tarayıcı: sentetik sahip hesabıyla müşteri ve tedarikçi CSV'si →
  önizleme → boş alan doldurma → onay → kayıt; tekrar yüklemede yeni kayıt yok.
- Önizleme arası müşteri notu değiştirilince kayıt durdu; yenilenen önizlemeden
  sonra kayıt yapıldı ve aradaki not korundu. Veritabanı sonucu ayrıca okundu.
- Gerçek HTTP/session: sahip önizlemesi 200; usta ve cross-site 403; eksik/değişmiş
  önizleme 409; bozuk CSV 400. Reddedilen isteklerde veritabanı değişmedi.
- 390 px mobil: yatay sayfa taşması yok, tek h1, iç içe main yok, etiketsiz alan
  yok. Açık/koyu tema kontrol edildi. Konsolda yeni uygulama hatası görülmedi.
- Son tam `npm run validate` başarılı: **150 paket / 1.105 Jest testi**, tip
  kontrolü, hatasız/uyarısız lint, ortam/backend/firma kapsamı kapıları ve production build.

- CSV sayımı: 14 yeni ayrıştırıcı testi; gerçek HTTP sahibi/usta oturumu,
  yönetici onayı ve SQL sonucu. Çalışan ve cross-site 403, hatalı JSON/başlık/depo
  400, tekrar belge 409. Onaylanan geçerli satır tam 7 adet, belirsiz satır sıfır.
- Gerçek tarayıcıda CSV yükleme → satır önizleme → Önerilenler → Onayla:
  24 adet işlendi, profil `needs_bars`, kesirli takım `uncertain` kaldı. SQL ile
  doğrulandı. 51 satır önizlemede ilk sayfa 50, ikinci sayfa 1 satır gösterdi.
- 390×844 mobilde document genişliği 379 px, tek h1, iç içe main ve etiketsiz
  alan yok; konsolda error/warn yok. Açık/koyu tema görselleri kaydedildi.

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

1. Genel ürün/mamul kartı CSV aktarımı ve reçete aktarımının tamamlanması.
   Mevcut `/products` aile reçetesi CSV'si; genel ürün kataloğu aktarımı değil.
   `recipe-template.service.ts` önizlemesi fingerprint taşımıyor ve mevcut UI
   alan değişikliğinde önizlemeyi temizlemiyor; kaydın incelenen dosya/alan/kart
   sürümüne bağlanması sonraki paketin güvenilirlik işi. CSV stok sayımı bitti;
   fiziksel çubuk onayı korunuyor.
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
14 Ekim ikinci tur kontrolü: resmi Claude Code CLI, **13:20 Europe/Istanbul**
limit sıfırlama saatini hâlâ bildiriyor. Asıl ERP oturumu `idle`, son kayıt
09:26:34; bu tur devir gönderilmedi ve asıl ağaca dokunulmadı.
30 dakikalık sohbet takibi geliştirme ve devir işlemini sürdürüyor.

## PR durumu

Draft PR: https://github.com/beshN/renkflowV2/pull/91.
Önceki `9da8180c` için GitHub validate ve Vercel başarılı, mergeable olduğu
14 Ekim 07:34 UTC sonrasında doğrulandı. Yeni CSV paketinin push kontrolleri
ayrıca izlenecek; eski yeşil sonucu yeni commit'e mal etmeyin.
