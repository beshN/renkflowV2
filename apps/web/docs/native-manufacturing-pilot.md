# RenkFlow native stok ve üretim pilotu

> Bu dosya arşivlenmiş ilk 012 migration pilotunu açıklar. `pilot:manufacturing` fiziksel lotları temsil etmediği için yazmadan durur; güncel doğrulama komutu `npm run test:production` olarak değişmiştir. Aşağıdaki komutlar tarihsel kayıttır. 014 ile eklenen makaslı tente, fiziksel toplu kesim/artık, usta, rework ve iletişim akışı için [güncel üretim platformu rehberini](production-platform.md) kullanın.

Bu modül ERPNext/Frappe çalıştırmaz ve ERPNext kaynak kodu içermez. Belge yaşam döngüsü,
değiştirilemeyen stok defteri, rezervasyon ve WIP yaklaşımı bağımsız RenkFlow koduyla
uygulanmıştır. İlk sürüm tek şirket ve web uygulaması içindir.

## Veri otoritesi

- Yeni stok gerçeği `stock_entries`, `stock_entry_lines` ve `stock_balances` tablolarıdır.
- `stock_movements` pilot boyunca yalnız karşılaştırma/uyumluluk amacıyla okunur; yeni akış
  bu tabloya yazmaz.
- Onaylanmış stok kayıtları düzenlenemez veya silinemez. Düzeltme, ters kayıt API'siyle
  yeni bir `REVERSAL` kaydı oluşturarak yapılır.
- Stok mutation komutları idempotency anahtarı taşır. Bakiye ve rezervasyon satırları
  `SERIALIZABLE` transaction ve satır kilitleriyle korunur.

## Pilot akışı

Önce bağlı veritabanını yazma yapmadan kontrol edin:

```sh
npm run db:check-manufacturing
```

Komut `.env.local` dosyasını okur, salt okunur transaction içinde eksik tabloları ve
stok/iş emri alanlarını listeler. Eksik şemada çıkış kodu 1 döner. Tabloların mevcut
olması pilotun tamamlandığı veya veri bütünlüğünün doğrulandığı anlamına gelmez.
Migration ve aşağıdaki yazma yapan pilotu **ayrı geliştirme/test veritabanında**
çalıştırın; yerel ortamın canlı veritabanına bağlı olabileceğini kontrol edin.

1. `012_native_manufacturing.sql` göçünü çalıştırın.
2. Mevcut bir RenkFlow siparişinin, tenant'ın ve işlemi yapacak kullanıcının UUID'sini seçin.
3. Ortam değişkenlerini tanımlayıp pilotu çalıştırın:

```powershell
$env:PILOT_TENANT_ID = '<tenant uuid>'
$env:PILOT_USER_ID = '<user uuid>'
$env:PILOT_ORDER_ID = '<order uuid>'
$env:NATIVE_INVENTORY_ENABLED = '1'
npm run db:migrate
npm run pilot:manufacturing
```

Komut idempotent anahtarlar kullanır. Şunları oluşturur:

- `PROF-AL-4040`: 40×40 mm, 6 m ticari boy, `0.85 kg/m` pilot değeri.
- `FG-DEMO`: bir adet mamul.
- `SCRAP-AL`: kg UOM'lu alüminyum hurda.
- `BOM-FG-DEMO` v1: bir mamul için 4 m profil.
- RAW, WIP, FINISHED, REUSABLE_REMNANTS, SCRAP ve REJECTED depoları.

Akış RAW'a 12 m mal kabul eder, 4 m rezerve eder, bu miktarı WIP'e taşır ve bir mamul
üretir. Tamamlamada WIP'ten gerçek 4 m tüketilir, FINISHED'a 1 adet mamul girer ve
0.05 m hurda için `0.0425 kg` hesaplanır. Üretimden önce kontrollü bir hata, stok
defterine yazıldıktan sonra tetiklenir; transaction geri alındığında hem bakiyenin değişmediği
hem de deneme defter kaydının kalmadığı doğrulanır. Sonuçta `rollbackAtomicityVerified: true`
dönmelidir.

Beklenen son bakiyeler:

| Kalem        | Depo     |    Eldeki | Rezerve | Kullanılabilir |
| ------------ | -------- | --------: | ------: | -------------: |
| PROF-AL-4040 | RAW      |       8 m |     0 m |            8 m |
| PROF-AL-4040 | WIP      |       0 m |     0 m |            0 m |
| FG-DEMO      | FINISHED |    1 adet |       0 |         1 adet |
| SCRAP-AL     | SCRAP    | 0.0425 kg |       0 |      0.0425 kg |

## API özeti

- `POST /api/v1/inventory/stock-entries`
- `POST /api/v1/inventory/stock-entries/:id/reverse`
- `GET /api/v1/inventory/balances`
- `POST /api/v1/boms`
- `POST /api/v1/procurement/goods-receipts`
- `POST /api/v1/manufacturing/work-orders`
- `POST /api/v1/manufacturing/work-orders/:id/reserve`
- `POST /api/v1/manufacturing/work-orders/:id/transfer`
- `POST /api/v1/manufacturing/work-orders/:id/complete`
- `POST /api/v1/manufacturing/work-orders/:id/release`

Mevcut `POST /api/work-orders` yolu da isteğe bağlı `manufacturing` alanını kabul eder;
bakım/operasyon iş emirlerinin mevcut payload ve ekran sözleşmeleri değişmemiştir.

`NATIVE_INVENTORY_ENABLED=1` iken eski stok hareketi server action'ı yazmaya kapatılır.
Böylece eski ve yeni stok tabloları aynı anda otorite olamaz. Bayrak kapalıyken mevcut stok
ekranı çalışmaya devam eder; native mutation servisleri stok yazmayı reddeder.

## Pilot sonrası sınır

Satın alma talebi ve siparişi tabloları hazırlanmıştır; pilot yalnız doğrudan mal kabulü
çalıştırır. PDF AI çıktısı `document_extractions` içinde insan onaylı taslak olarak kalır
ve kendi başına stok hareketi oluşturamaz. Fiziksel artık lotları için `stock_lots`
hazırdır; kesim optimizasyonu ve yeniden kullanılabilir parça işleme pilot sonrası açılır.

## Pilot öncesi kontrol listesi

### Salt okunur yönetici sayfası (#134 devamı)

`/production/pilot-readiness` sunucuda render edilir. Yalnız `owner/admin`
rolleri (mevcut `team.manage` izni), üretim görüntüleme yetkileri korunarak
erişebilir; menüde tek bağlantı bulunur. Güncel üyelik `requireWorkOrderActor`
ile çözülür. Yetkisiz oturum girişe, yetkisiz rol dashboard'a yönlendirilir.

`pilotReadinessReport(actor)` yalnız doğrulanmış actor'ün tenant'ını kullanır;
URL'den tenant seçimi almaz. Sabit rapor alanları tek `READ ONLY` transaction'da
okunur; her veri SELECT'i `WHERE tenant_id = actor.tenantId` ile sınırlıdır.
Şema metaverisi dışında tenant dışı satır okunmaz. CLI ve sayfa aynı okuyucuyu
ve #134'ün saf `checkPilotReadiness` değerlendirmesini kullanır. Yazma, otomatik
düzeltme, audit/event üretimi, migration veya yeni API route yoktur.

Eksik aile eşlemesi ve eksik şema bulguları açıkça gösterilir. Okuma hatası
boş başarılı rapora çevrilmez; bağlantı ayrıntıları açığa çıkarılmadan
“Rapor okunamadı” gösterilir. KPI, miktar/para toplamı veya tahmin üretilmez.
AI çıktısı insan onayı gerektirir; rapor fiziksel pilot onayı değildir.

Jest servis/sayfa testleri yetki, tenant kapsamı, boş/hatalı veri ve menü
politikasını kapsar. Aşağıdaki yerel `test:pilot-readiness` doğrulaması gerçek
servisi de ayrı tenant A/B ve boş tenant ile `default_transaction_read_only=on`
oturumunda çalıştırır; fixture satırlarının değişmediğini kontrol eder.

`apps/web` içinde, yalnız yetkilendirilmiş veritabanını işaret eden `.env.local`
ile çalıştırın:

```sh
npm run pilot:readiness
npm run pilot:readiness -- --json
```

Komut varsayılan olarak yalnız loopback bağlantılara (`localhost`, `127.0.0.0/8`,
`::1`) izin verir. Uzak bağlantı için ayrıca `--allow-remote` gerekir; bayrak yoksa
bağlantı kurulmadan engel ve çıkış kodu 1 üretilir. Unix socket de uzak kabul edilir:
socket bir uzak DB vekiline bağlı olabilir. Belirsiz/çoklu host ve host override
biçimleri reddedilir. Bağlanılacak host ve port açıkça sabitlenir; `PGHOST`/`PGPORT`
geridönüşü kullanılmaz. Bu çalışma kapsamında production veya Preview DB'ye
bağlanılmaz ve `--allow-remote` kullanılmaz.

İnsan çıktısı `Bağlantı türü: yerel/uzak` ile başlar; yapılandırma çözümlenemiyorsa
`bilinmiyor` gösterilir. Adres ve hata ayrıntıları yazdırılmaz. JSON tek bir nesnedir:
`connectionType`, `findings` ve `summary` alanlarını içerir. Her bulgu `code`,
`severity`, `message`, `hint`; özet ise `blockers`, `warnings`, `message` içerir.
İnsan çıktısının son satırı ve JSON özet mesajı şu biçimdedir:

```text
N engel, M uyarı. Engel olmaması pilota hazır olunduğu anlamına gelmez.
```

Tüm sorgular tek `READ ONLY` transaction içindedir. Komut veri, migration, seed
veya otomatik düzeltme yazmaz. Engel varsa çıkış kodu 1; yalnız uyarı/bilgi varsa
0'dır. Bağlantı ve yapılandırma hataları da engeldir.

- Ortak native üretim şeması ve ek pilot alanları mevcut mu?
- `product_family_recipes.family = 'makasli'` için yayınlı reçete var mı?
  Her tenant/reçete kodu için yalnız en yüksek yayınlı sürüm engel/uyarı hesabına
  girer; eski yayınlı ve arşiv sürümler incelenmez. Taslak bulgularının tamamı
  `info` olur ve `(taslak)` etiketlenir. Yalnız taslak varsa yayınlı reçete eksikliği
  yine engeldir. `validateRecipeExamples` sonucu gösterilir.
- Her profil kaleminde kg/m, standart boy ve kesit dolu mu? Malzeme kartı yoksa
  yalnız `MATERIAL_MISSING` üretilir; aynı kalem için profil/stok bulgusu eklenmez.
- Rotanın her operasyonunda aktif iş merkezi ve atanabilir çalışan var mı?
  014/025 migration'larındaki `work_centers`, `production_resources` ve aktif
  `tenant_members` üyeliği kullanılır; zorunlu ekip/makine de kontrol edilir.
  `platform.service.ts` içindeki `operation.assign` ile aynı şekilde, aktif
  `owner/admin/office/worker` üyeliği yeterlidir; ayrı `employee` kaynak kartı
  zorunlu değildir. Atama servisi employee kartının aktifliğini/merkezini de
  filtrelemez. Seçilen makine/ekip kaynağı ve ekip üyeliğini ayrıca kontrol eder.
  `scheduler.ts` çalışan kartı yoksa kapasitesi 1 olan varsayılan takvim oluşturur.
  Bu rapor atama uygunluğunu kontrol eder; çalışma takvimi veya anlık yükü hesaplamaz.
- Her malzemede pozitif kullanılabilir lot ve pozitif bakiye var mı?
  Eksiklik uyarıdır; miktar yeterliliği, rezervasyon ve depo uygunluğu hesaplanmaz.
- Genişlik ve derinlik/açılım min/max değerleri bilgi olarak gösterilir;
  uygunluk hükmü verilmez. Koşullu kalemler ve operasyonlar da incelenir.

### Yerel boş DB ve test reçetesi doğrulaması

İlk terminalde yeni, ayrılmış bir yerel küme dizini ve boş port seçin:

```sh
RENKFLOW_TEST_DB_DIR=/tmp/renkflow-pilot-check RENKFLOW_TEST_DB_PORT=55538 npm run db:local -- --empty
```

`--empty`, `renkflow_dev` ve `renkflow_test` veritabanlarını şema veya migration
uygulamadan açar; mevcut tabloları silmez. Bu seçenek olmadan `db:local` eski şema
hazırlama davranışını korur. Bu doğrulamada **daima `--empty` kullanın**.

İkinci terminalde aynı portla:

```sh
RENKFLOW_TEST_DB_PORT=55538 npm run test:pilot-readiness
```

Test betiği dışarıdan gelen `DATABASE_URL` değerini kullanmaz; yalnız loopback
üzerindeki bu iki sabit DB adına bağlanır. Her iki DB'nin de boş olduğunu doğrular;
mevcut uygulama tabloları varsa yazmadan durur. Önce boş `renkflow_dev` üzerinde
CLI'yi çalıştırır. Sonra yalnız `renkflow_test` içinde raporun okuduğu kolonlara
sahip test tabloları ve eksiksiz yayınlı reçete + eksik taslak oluşturur. Raporu
salt okunur oturumda çalıştırır; tablo, JSON, özet, çıkış kodu ve uzak bağlantı
korumasını doğrular. Oluşturduğu test tablolarını sonunda temizler; `renkflow_dev`
boş kalır. Migration veya seed betiği çalıştırmaz. Test şeması odaklı bir fixture'dır;
uygulamanın tüm constraint/RLS kurallarını veya fiziksel pilotu doğrulamaz.
Test bitince ilk terminalde Ctrl+C ile yerel sunucuyu durdurun.

024, 035 ve 073 migration'larında test/sentetik bayrağı bulunmadığından bu uyarı
kuralı eklenmemiştir. 073'teki `verification_source` serbest metin teknik kaynak
bilgisidir; test bayrağı olarak yorumlanmaz.
Rapor tenant'lar arasında eşleştirme yapmaz; reçete kodu/sürümü ve kalem adları
çıktıya girer. Çıktıyı yetkili kişilerle paylaşın. Başarılı rapor fiziksel pilotun
veya kapasite takviminin doğrulandığı anlamına gelmez.

### Makaslı uçtan uca prova

`apps/web` içinde:

```sh
npm run test:integration -- makasli-e2e
```

Runner boş ve geçici bir PostgreSQL kümesini boş bir portta açar; yalnız
`renkflow_test` oluşturur (`dev-database.ts --test-only`). Mevcut `schema.sql`,
bootstrap migration'ları ve `ensureBackendSchema` zinciri uygulanır. Eksik
`product_drilling_rules` tablosunu oluşturan mevcut adım
`lib/db/migrations/064_order_technical_files.sql` bu zincirdedir. Yeni migration
veya uygulama şeması değişikliği gerekmez. Mobil test şeması da mevcut yerel
kurulum yoluyla yalnız bu DB'ye uygulanır. Küme test sonunda kapatılıp silinir;
`renkflow_dev` hazırlanmaz. Runner dış DATABASE_URL değerlerini kullanmaz.

Önceden aynı yolla hazırlanmış bir test DB'sinde betik doğrudan da çalıştırılabilir:

```sh
RENKFLOW_TEST_DB_PORT=55547 node --require ./scripts/register-server-only.cjs --import tsx scripts/test-makasli-e2e.ts
```

Doğrudan betik DB başlatmaz veya migration uygulamaz; eksik tabloyu hata olarak
bildirir. Adım çıktıları runner'dan da doğrudan görünür.

Zincir: korumalar → TEST fixture → hazırlık raporu → teklif/idempotency →
ticari onay → insan teknik onayı/iş emri → kesim → boya/üretim →
MANUFACTURE/mamul stok → yükleme/teslim. Her geçen adım `PASS ·`, fixture
kısayolları ve rapor bulguları `BULGU ·`, hata ise adımıyla `FAIL ·` basar.
Metre, kg ve adet kontrolleri ayrıdır; her çalıştırma UUID slug'lı TEST tenant
ve `@example.invalid` kullanıcılar oluşturur.

6 Kasım 2026 doğrulaması: güncel main `f915919f`, PR head `69765122` üzerine
merge commit ile alındı. İzole test DB'sinde **10/10 PASS**, çıkış kodu **0**:
Korumalar, Fixture, Hazırlık, Teklif, Onay, İş emri, Kesim, Üretim, Mamul stok,
Sevkiyat. FINISHED stoku üretimden sonra 2 adet, yüklemeden sonra 0; fazla
sevkiyat 409 ile reddedilir; teslim sonrası sipariş tamamlanır.

Fixture `material.save` üzerinden `profileSection` gönderir; mevcut servis bu
alanı kalıcı yazar. Reçete yayını gerekçe içerir. Yapılandırılmış teklif kalemi
`TEST-MAK-PILOT` reçetesini iş emrine taşır; sevkiyatın sipariş bağlantısı
`shipment_items.order_id` üzerinden doğrulanır (`shipments.order_id` yoktur).
Raw UPDATE ile servis aşılmaz. Delme kuralı ve kimlik/üyelik bootstrap kayıtları
etiketli INSERT'tir; aile eşlemesi `importFamilyRecipe` ile yapılır. Import sonucu
yalnız reçete id/code/version içerdiği için editRevision bu id/sürümün kalıcı
kaydından okunur; sabit 1 varsayılmaz.

Dış `DATABASE_URL` yok sayılır. Özel istemci yanında, ilk domain servisinden ve
fixture yazımından önce `withTransaction` ile **lib/db servis havuzunda** da
`current_database()='renkflow_test'` ve sunucu adresi `127.0.0.1` doğrulanır.
`lib/db/index.ts` kod incelemesi: ana/meta havuzlar yalnız `DATABASE_URL`
kullanır; `POSTGRES_URL`/`DIRECT_URL` önceliği, dotenv yüklemesi veya Neon
sürücüsü yoktur. URL, lib/db import edilmeden önce yerel test URL'sine sabitlenir.

Prova artık genel runner'ın EXCLUDED listesinde değildir. Varsayılan
`npm run test:integration` keşfi ve `.github/workflows/validate.yml` içindeki
mevcut entegrasyon adımı provayı çalıştırır; ayrı workflow/npm satırı gerekmez.
Tekli ve karma seçim de desteklenir. Boş DB isteyen pilot-readiness testi ise
aynı gerekçeyle genel runner dışında kalır; ayrı komutu aşağıdadır.

Föy şemasında makaslıya özel tip yoktur (pergola/windbreaker/unknown).
Sentetik fixture mevcut pergola `systems/railOuter/bays` alanlarını
`family=makasli` adaptörüne verir ve bunu BULGU olarak yazar; gerçek makaslı
föy doğrulaması değildir. `approveTechnicalPlan`, yapılandırılmış teklif için
`createJobsForConfiguredOrder` üzerinden TEST-MAK-PILOT reçetesine bağlı iş emri
ve reçetede tanımlı Kesim/Boya/Son hazırlık operasyonlarını üretir. Mamul/reçete kartları önceden TEST
adlarıyla oluşturulur. `preferences.save` üretim lideri alanını yok sayar; fixture mevcut
`saveProductionLead(actor, {leadUserId})` servisini kullanır ve kalıcı ayarı
doğrular. İş emri oluşturma servisi bu ayarı iş emri ve operasyon atamasında kullanır. `operation.assign` yalnız operasyonu değiştirir;
iş emri atanmamışsa prova raw UPDATE yapmadan açıkça fail eder.
Onaysız dosyanın total_amount=0 beklentisi `ensureQuoteFile` davranışıdır;
`acceptQuoteFile` müşteri onayında ticari tutarı aynı dosyaya kopyalar.

Fiziksel pilot, gerçek reçeteler/fotoğraf, PDF/AI çıkarımı, bildirim, finans ve
kapasite doğrulanmaz. Owner teknik onayı insan onayı sınırını temsil eder;
AI çıktısı insan onayı gerektirir.

### Genel entegrasyon runner'ından ayrım

`npm run test:integration` ve CI `validate.yml`, testlerden önce uygulama şemasını
hazırlar. `test-pilot-readiness.ts` ise tamamen boş `renkflow_dev` ve
`renkflow_test` gerektirdiği için bu runner'ın `EXCLUDED` listesinde gerekçesiyle
birlikte tutulur. Genel entegrasyon turu bu testi çalıştırmaz. Yukarıdaki
`db:local -- --empty` ve ayrı `npm run test:pilot-readiness` adımlarıyla
çalıştırılabilir. CI `validate` işi genel entegrasyon adımından sonra
`Pilot readiness on an empty local database` adımında bu kontrolü otomatik çalıştırır.
`scripts/ci-pilot-readiness.ts`, runner'ın geçici dizininde her seferinde yeni,
boş bir cluster açar; ayrı portta `db:local -- --empty` başlatır, hazır olmasını
en çok 180 saniye bekler ve `npm run test:pilot-readiness` çalıştırır.
Başarıda, hatada ve SIGINT/SIGTERM durumunda alt süreçler durdurulur.
Harici `DATABASE_URL` kullanılmaz; bağlantı loopback yardımcılarıyla sabitlenir.
Ham DB/test çıktısı bağlantı bilgileri ve sunucu hatalarını gizlemek için aktarılmaz.
Boş DB koruması, loopback sınırlaması ve salt okunur rapor oturumu korunur.
