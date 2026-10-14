# RenkFlow geliştirme devam kaydı

Kullanıcı 14 Ekim 2026'da Claude kullanım sınırındayken geliştirmeyi Codex'in
sürdürmesini ve limit açılınca değişiklikleri Claude'a bildirmesini istedi.
Hedef mevcut endüstriyel ERP'nin işlev, güvenilirlik, mobil kullanım ve tasarım
kalitesini yükseltmek. Program tamamlanmadı; aşağıdaki işler bitmiş sayılmamalı.

## Çalışma alanları

- Asıl Claude projesi: `/Users/beshnovski/Desktop/renkflowV2`.
  Önceki müşteri taslaklarına dokunulmadı. Son manuel devam kontrolünde proje
  `claude/roadmap-vat` dalında, yalnız `.claude/launch.json` izlenmiyordu;
  bu çalışma alanı değiştirilmedi.
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
- Bu paket yeni migration gerektirmiyor. Ürün/mamul ve reçete paketi aşağıda
  ayrıca tamamlandı; genel ERP geliştirme programı bitmiş değil.

### Ürün kartları ve reçete önizlemesi — üçüncü geliştirme paketi

- `/products/import` mamul, hammadde ve sarf kartlarını 500 satırlık CSV ile
  önizleyip açar. Türkçe şablon, BOM/UTF-8/Windows-1254, sayı/birim/durum
  doğrulaması, satır sonuçları ve hata raporu ortak sihirbazdan gelir.
- Manuel kart açma ve aktarım aynı `MaterialInputSchema` ve üretim komutunu
  kullanır. Stok miktarı, bakiye ve lot oluşmaz. Kayıtlı kart değişmez; farklı
  bilgiler, arşiv, yinelenen SKU/profil kimliği ve birden fazla eşleşme durur.
- Kullanıcı/firma/dosya/adaya bağlı önizleme hash'i zorunlu. Adaylar kilitlenir;
  eşzamanlı aktarım veya aradaki manuel kart açma eski incelemeyi 409 ile durdurur.
  Yeni kartlar, komutlar ve denetim aynı işlemde yazılır.
- Reçete API'sinin önizlemesiz kayıt açığı önce testte yeniden üretildi.
  Önizleme artık dosya, alanlar, kullanıcı/firma, mamul, malzeme, iş merkezi ve
  son reçetenin içeriği/sürümü/örneklerine bağlı. Eksik/değişmiş hash 409'dur.
  Aile kodu kaydı, taslak kaydı ve audit aynı transaction içinde; eski ayrı
  claim/kayıt penceresi kaldırıldı. Üretim komutlarının idempotency yolu korundu.
- Reçete formunun alan değişince önizlemeyi temizleyen kontrolü zaten vardı.
  Eksik sunucu doğrulaması ve istek sırasında alan kilidi eklendi; dosya okuma
  yarışları/unmount ele alındı. Taslak örnekleri korunur, yayın kuralları sürer.
- CSV'deki tekrarlanan başlık ve harf katlama sonrası birden fazla SKU/iş merkezi
  artık rastgele ilk/son kaydı seçmez. Sayım ve kart yaratma aynı firma kilidini
  kullanır; bakiye satırı kilitleri de korunur.
- Ürün aktarımı inventory.create, reçete aktarımı production.create/edit
  matrisini ve firma yöneticisi rolünü kontrol eder. Yeni yollar proxy haritasına
  alındı; API içinde güncel oturum ve daraltılmış yetki ayrıca kontrol edilir.
- Ürünler menüsü, ürün/stock kartı aktarım bağlantıları, sayfa başlığı,
  breadcrumb ve mobil reçete kartları tamamlandı. Gereksiz boş alan doldurma
  seçenekleri kart aktarımında gösterilmez. Yeni migration yok.

Kabul: yeni mamul kartı → reçete önizleme → ad değişince onay kaldırılması →
yeniden önizleme → taslak kaydı gerçek tarayıcı ve SQL ile doğrulandı. Üç ürün
kartı açıldı, aynı listede dört mevcut kart atlandı, bir hatalı satır korundu.
Profil 6 m / 1,25 kg/m saklandı; yeni kartlarda stok bakiyesi yok. Mobil 390 px,
tek h1, iç içe main/etiketsiz alan yok; açık/koyu tema ve konsol kontrol edildi.

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

Ürün/reçete paketi: 39/39 taze DB entegrasyonu, gerçek HTTP/session rol ve
daraltılmış yönetici/cross-site 403, eksik/değişmiş/tekrar önizleme 409. Kart
açmada bakiye/lot yok; reçete taslak kalır. Önizlemesiz kayıt açığı önce kırmızı
testle yeniden üretildi, düzeltmeden sonra geçti. Son validate bütün kapılarla
başarılı. Son statik route-guard kontrolünün yeni yardımcıyı tanımama sorunu,
oturum kontrolünü API rotalarında açık tutarak çözüldü; kapı gevşetilmedi.

- Önceki birleşik paket: `npm run test:integration` **37/37** betik geçti.
- CSV sayım paketinin son kontrolü: taze yerel PostgreSQL ile **5/5** betik
  (`count-csv`, `count-import`, `warehouse`, `stock-depth`, `stock-threshold`).
  Yeni `test-count-csv.ts` runner tarafından otomatik keşfedilir; güncel tüm
  betiklerin tamamı ürün/reçete paketinden sonra yeniden koşuldu: **39/39** başarılı.
- Gerçek tarayıcı: sentetik sahip hesabıyla müşteri ve tedarikçi CSV'si →
  önizleme → boş alan doldurma → onay → kayıt; tekrar yüklemede yeni kayıt yok.
- Önizleme arası müşteri notu değiştirilince kayıt durdu; yenilenen önizlemeden
  sonra kayıt yapıldı ve aradaki not korundu. Veritabanı sonucu ayrıca okundu.
- Gerçek HTTP/session: sahip önizlemesi 200; usta ve cross-site 403; eksik/değişmiş
  önizleme 409; bozuk CSV 400. Reddedilen isteklerde veritabanı değişmedi.
- 390 px mobil: yatay sayfa taşması yok, tek h1, iç içe main yok, etiketsiz alan
  yok. Açık/koyu tema kontrol edildi. Konsolda yeni uygulama hatası görülmedi.
- Son tam `npm run validate` başarılı: **151 paket / 1.118 Jest testi**, tip
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

**Yeni öncelik:** Kullanıcı bütün siteyi karmaşık bulduğunu ve kalan görevlerin
basit kullanıma göre yapılmasını açıkça söyledi. Önce kalan modüllerin günlük
iş, form ve isteğe bağlı alanlarını inceleyin; aşağıdaki yeni işlevler de aynı
sadelik kabul ölçütüne tabi. Otomasyon yeniden açılmamalı; mevcut devam manueldir.

1. Ekipman bakım planı, arıza/duruş defteri ve gerçek verilere dayalı OEE.
   Planlı süre, çalışılan süre, ideal çevrim ve sağlam/red üretim olmadan yüzde uydurmayın.
2. Fason iş akışı; verilen malzeme, teslimat, kısmi kabul, maliyet ve kalite bağlantısı.
3. Native Android/iOS girişte 2FA kod/kurtarma akışı. Web MFA tamamlandı diye
   saha uygulamasının MFA desteğini tamamlandı saymayın.
4. RLS/firma izolasyonu ve CI'da gerçek tarayıcı/erişilebilirlik kapısı.
5. Defter bazlı raporların giderlerle tamamlanması; bordro köprüsü ve muhasebeci
   dışa aktarımı. Yasal hesap kurallarını resmi kaynaklardan doğrulayın.
6. Müşteri portalı, belge erişimi, RFQ e-postası ve uygun sağlayıcıyla SMS.
7. Özel alanlar, pivot rapor ve montaj/servis zaman kayıtları.
8. Sayfa başlığı/form/listelerin tutarlılığı; dokunmatik montaj takvimi;
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
Kullanıcı 14 Ekim üçüncü tur sırasında otomasyonu durdurmayı açıkça istedi.
`renkflow-claude-direkt-r-denetimi` PAUSED olarak doğrulandı. Otomatik geliştirme
ve Claude takibi/devir çalışmayacak. Son ürün/reçete paketi kayda alınarak
bırakıldı. Bu durdurma genel ERP programının tamamlandığı anlamına gelmez.
Yeni otomatik takip kullanıcı yeniden istemedikçe açılmamalı.

## PR durumu

Draft PR: https://github.com/beshN/renkflowV2/pull/91.
`f061d6fd` CSV sayımı için GitHub validate ve Vercel başarılı olduğu
14 Ekim üçüncü tur başında doğrulandı. Son ürün/reçete push'undaki kontrolleri
önceki commit'in yeşil sonucu ile karıştırmayın. Otomasyon durduğundan yeni
CI/devir takipleri otomatik sürdürülecek diye söz verilmemeli.

## Manuel kullanım sadeleştirmesi — 14 Ekim

Kullanıcı çakışmasız devam istedi. Temiz `4efee736` dalına önce
`origin/main@fa196305` birleştirildi (`f6a5a631`). KDV/gider kaydı, kesim listesi,
demir föyü okuma, araç demo takibi ve önceki form sadeleştirmeleri korundu.
Eski müşteri importunun çakışan yedi dosyasında incelenmiş sürüm tutuldu;
ürün/kesim listesi menüleri, KDV paneli, breadcrumb, 058 ve 060 migration'ları
birlikte korundu. Asıl Claude ağacına ve oturumuna yazılmadı.

- Ortak masaüstü menüsünde role göre en çok altı günlük bağlantı var. Tüm izinli
  bölümler ayrı aranabilir menüden erişiliyor; listede 14 sonuç sınırı yok.
  Mobil üst/alt menü aynı dizini açıyor. Türkçe harfsiz `urun` araması `Ürünler`
  buluyor. Oturum yüklenirken yetkili bölümler yanlışlıkla görünmüyor.
- Yeni sipariş, teklif, sayım ve diğer ortak kısayollar daraltılmış oluşturma
  yetkisine de uyuyor. Bugün ekranında izinsiz kart/kısayollar gizleniyor;
  usta ve muhasebe günlük menüsü ayrı. Asistan için yetkisiz komut bağlantısı
  kaldırıldı. Sunucu yetki denetimleri değiştirilmedi.
- Üretimde günlük işler, kesim ve iş planı önde; reçete ve diğer bölümler
  seçiciden erişiliyor. Kalite/analitik ayrı bölümde, yeniden işlem vakaları ve
  hatalar günlük görünümde korunuyor. Büyük dört sayaç kısa özet satırına indi.
  Üretim emri ve beş stok/tanım formu istenince açılıyor; stokta aynı anda bir
  form açık. Ziyaret edilmiş form kapanırken değerleri korunuyor. Stok ters
  kaydı gerekçesiyle birlikte ayrı açılır işlem oldu.
- Ayarlarda tek konu, üretim/renk/neden ve teklif/kayıt formlarında tek açılır
  işlem var. Muhasebede üç günlük rapor ve diğer raporlar seçicisi var; KDV
  gider formu gerektiğinde açılıyor. Ayarlar/muhasebe/finansta iç içe main
  kaldırıldı; finansın başlığı ve açıklaması basitleşti.
- Bölüm seçimi ve geri düğmesi, reçete/kesim/lot bağlantıları ve kesim ayarı
  hash'i korunuyor. Muhasebede rapor doğrudan `?tab=taxes` ile açılabilir.
  Asistan şeridi yalnız bulunduğunuz bölümle ilgili öneri gösteriyor; genel
  öneriler asistanın kendi panelinde kalıyor.

Tarayıcı kabulü: sahip, usta ve salt okunur yönetici; tüm bölümlere erişim ve
daraltılmış menü; Türkçe harfsiz arama, Escape/fokus dönüşü; tek stok formu,
formlar arasında değer korunması, depo kaydı; kesim ayarı doğrudan bağlantısı,
seçici ve geri düğmesi; KDV formu → yerel gider → rapor/CSV. SQL: depo
`UI-SADE` RAW, gider 1.000 TL ve 200 TL KDV. Yalnız izole sentetik veriler.
390 px üretim/ayar/muhasebe/usta ekranında yatay sayfa taşması yok; tek h1,
iç içe main yok. Açık/koyu tema ve konsol kontrolü, yeni error/warn yok.

Bu paket bütün modüllerin tüm iç formlarının sadeleştiği anlamına gelmez.
Genel kullanım programı açık; diğer ekranlardaki seyrek/teknik alanlar ve
sayfa içi rol kısayolları sıradaki inceleme konusu. Otomasyon PAUSED kalır.
Claude'a bu tur devir gönderilmedi.

Son doğrulama: `npm run validate` başarılı — 154 paket / 1.161 Jest testi,
tip kontrolü, uyarısız lint, güvenlik kapıları ve build. Birleştirilmiş ana dal
dahil taze PostgreSQL'de 41/41 entegrasyon betiği geçti. Gerçek HTTP/session
import kontrolü de başarılı: sahip/usta/daraltılmış yönetici/cross-site ve
eskimiş/tekrar önizleme yolları korundu. Loglar, SQL ve ekran kanıtları
`review-reports/2026-10-14-simple-*` dosyalarında. Canlı deploy/migration yok.
