# Haftalık istasyon planı — salt okunur ilk dilim

Üretim sayfasındaki bağlantı → `/production/weekly-plan?date=YYYY-MM-DD`.
Tarih Pazartesi–Pazar haftasına normalize edilir. Takvim Europe/Istanbul'dur;
mevcut scheduler ile aynı UTC+3 sözleşmesi nedeniyle tarih seçimi 2017 ve sonrasıdır.

## Mevcut kod ve yeniden kullanım

- `planning.service.ts` / `scheduler.ts`: sonlu kapasite, kaynak vardiyaları,
  bakım, malzeme hazırlığı, öncelik/termin ve kalan süre hesabı zaten var.
- `ProductionWorkspace` çizelgeleme sekmesi: öneri oluşturma/yayınlama ve
  çizelgelerin düz operasyon tablosu zaten var. Bu kod değiştirilmedi.
- `production_operations`: kayıtlı başlangıç/bitiş, durum ve miktar var;
  ayrı planlanan başlangıç/bitiş sütunu yok. Plan zamanı mevcut
  `production_schedules.tasks.tasks[].segments` içinde tutuluyor.
- Yeni görünüm motoru çalıştırmaz. Son yayınlanan çizelgeyi, o yoksa son taslak
  öneriyi okur; seçili hafta dışındaysa başka/eski çizelgeleri birleştirmez.
- Mevcut Card, rf tasarım sınıfları, birim sözlüğü, oturum aktörü ve üretim
  yetki matrisi yeniden kullanılır. Yeni bağımlılık veya migration yok.

## Veri sözleşmesi ve sınırlar

- Güncel üyelik + `production.view`, taban owner/admin/office gerekir.
  Worker, member ve accountant erişemez; özel rol daraltması uygulanır.
- Üretim sorguları tek REPEATABLE READ READ ONLY transaction içindedir.
  Her tablo tenant filtresi, her join tenant eşitliği ve oturum tenant koşulu taşır.
- Çizelgenin JSON'u yalnız mevcut tenant'ta doğrulanmış operasyon/iş emri/istasyon
  eşleşmesi için zaman kaynağıdır. Ürün, miktar ve iş bilgisi canlı kayıttan gelir.
- Yalnız açık üretim iş emirleri ve done/cancelled olmayan operasyonlar görünür.
  Kayıtlı başlayan ve running kalan operasyonlar başlangıçtan görüntüleme anına
  kadar ilgili günlerde ayrıca gösterilir; bu, kesintisiz gerçek çalışma süresi iddiası değildir.
- Her günün tahmini dakikası yalnız kayıtlı çalışma diliminin günle kesişimidir.
  Gece/hafta boşlukları eklenmez; gün ve hafta bitişi hariçtir.
- Kapasite istasyonun kayıtlı paralel operasyon sayısıdır. Dakikaya çevrilmez;
  günlük kullanılabilir kapasite, kaynak uygunluğu ve doluluk yüzdesi türetilmez.
- İş emirlerinin ayrı insan tarafından okunur numara alanı yoktur; mevcut başlık
  ve tam kayıt ID'si gösterilir. Numara uydurulmaz.
- Miktar operasyonun tamamına aittir, her kartta kendi production_uom birimiyle
  görünür. Günlere paylaştırılmaz; m/kg/adet veya başka birimler toplanmaz/dönüştürülmez.
- Geçerli çizelge dilimi olmayan açık operasyonlar hafta dışı bağımsız
  planlanmamış listesinde kalır. Eksik ürün/birim/süre/kapasite “veri yok”tur.
- Çizelge kaydedildiği haliyle bir tahmindir; sonradan değişen operasyon veya
  kapasite kayıtlarıyla eskimiş olabilir. Bu uyarı ve çizelge tarihi ekranda görünür.
- Yazma, sürükle-bırak, AI üretimi, sahte veri/KPI, landing/panel değişikliği yok.
  AI tarafından üretilen bu kod insan incelemesi gerektirir; birleştirme Berat'a aittir.

## Doğrulama yolları

`npm test -- --runInBand __tests__/lib/station-weekly-plan.test.ts`:
boş hafta, İstanbul/UTC sınırı, yıl/hafta geçişi, planlanmamış operasyon,
haftayı aşan dilimler, bitiş sınırı, running kaydı ve birimlerin korunması.

`npm run test:integration -- station-weekly-plan`: gerçek yerel renkflow_test,
iki tenant, aynı istasyon kodu, hatalı tenant FK'ları, yabancı JSON operasyonu,
rol daraltması, worker reddi, eksik ürün/çizelge ve hafta sınırı.
`scripts/test-station-weekly-plan.ts`, mevcut runner'ın `test-*.ts` keşfine ve
`.github/workflows/validate.yml` validate job'ının integration adımına otomatik dahildir.
Ortak package/runner/CI dosyalarını değiştirmek gerekmez; #133–#143 dosyalarına dokunulmaz.

## Bu PR'da çalıştırılan kontroller

- `apps/web` type-check, lint ve build geçti; lint'te üç mevcut unused-disable uyarısı var.
- Yeni birim suite'i 8/8; yerel gerçek DB entegrasyonu 1/1 geçti.
- Tam Jest: 224 suite / 1674 test geçti; mevcut einvoice-xsd suite'inde 7 test
  `spawnSync xmllint ENOENT` nedeniyle başarısız (225 suite / 1681 test toplam).
- SQL guard yeni dosyalarda bulgu üretmedi; değişmeyen SSO callback/sso.ts
  dosyalarındaki beş mevcut bulgu nedeniyle genel kontrol başarısız.
- CI sonucu, oturumlu tarayıcı akışı ve gerçek fabrika pilotu doğrulanmadı.
  Tüm integration scriptleri yerelde yeniden koşulmadı. Yerel Node v24.19.0;
  repo/CI Node 22.x sözleşmesi değiştirilmedi.
- Production Neon/Vercel/canlı DB, main push veya merge işlemi yapılmadı.
