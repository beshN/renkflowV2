# Üretim analitiği: kayıtlı geçmiş, ilk dilim

`/reports` → `/reports/production`. Salt okunur sunucu sayfası; mevcut AppleCard ve rapor yetkisi kullanılır. Landing/panel kabuğu değişmez. `getServerUserContext` güncel üyeliği; `requirePermission('reports.view')` taban rol ve özel daraltmaları doğrular. Servis aynı kontrolü tekrarlar. Worker erişemez; istemci tenant seçemez.

## Ön inceleme

- `/reports`: sipariş sayıları, durum dağılımı, CSV ve ProductionReport.
- `/api/v1/reports/operations`: tarih filtresiz merkez kuyrukları/aktif süre, üretim, kesim kaybı ve rework toplamları. Yeni tarih/örnek/birim sözleşmesini sağlamadığı için çağrılmaz; değiştirilmedi.
- `manufacturing/analytics.ts` + `analytics.service.ts`: 30 günlük olay geçmişi, çevrim/bekleme, WIP, kapasite, darboğaz ve çizelgeden tahmini bitiş. Tahminler bu görünümde kullanılmaz.
- `lib/analytics/reporting.ts#getProductionMetrics`: sipariş durum süreleri ve teslim uyumu; tamamlanan operasyon medyanı veya iş emri termin uyumu değildir. Kopyalanmadı.
- Gerçek aktif süre geçişleri mevcut üretim komutundadır; yeni süre/tahmin algoritması yoktur.
- Açık draft #134–#142 dosya listeleri incelendi; ortak değişen dosya yok. Package, integration runner ve mevcut üretim servisleri değiştirilmez.

## Sözleşme

- Tarihler Türkiye saatiyle, başlangıç dahil/bitişin ertesi gece yarısı hariç. Varsayılan bu ay. Operasyon/iş emrinde completed_at; kesimde tamamlanmış planın completed_at değeri kullanılır.
- Yalnız category=production ve status=done. Merkez başına tamamlanan operasyon sayısı; başlangıcı kaydedilmiş, sonlu ve pozitif active_seconds medyanı. Süre n değeri operasyon n değerinden farklı olabilir. En az iki süre örneği gerekir. Başlangıcı olmayan süreler ve eski varsayılanlardan ayırt edilemeyen 0 saniyelik kayıtlar süre örneğine alınmaz; tamamlanan operasyon sayısında kalırlar.
- İş emrinin due_at/completed_at değerlerinin Europe/Istanbul takvim günleri karşılaştırılır; termin gününün tamamı zamanındadır. Timestamptz doğrudan okunur, SQL text biçimi ayrıştırılmaz. Eksik termin dışarıda, sayısı ayrıca görünür. Siparişten fallback veya tahmin yapılmaz.
- cutting_losses.length_mm tamamlanmış planlara tenant koşullu join ile okunur. Üretim komutu actualBars girilmediğinde planlanan remainingMm değerini kullanabilir; kalıcı ölçüm kaynağı işareti yoktur. Bu yüzden doğrulanmış ölçüm **veri yok (n=0)**; kayıtlı hesaplanan mm firesi ayrı **ölçüm doğrulanamıyor** etiketiyle gösterilir. Katsayıdan türeyen weight_kg ve cost okunmaz. Gerçek ölçüm metriği için ileride provenance gerekir; bu dilim şemayı genişletmez.
- Birimler ayrı tutulur, dönüşüm yoktur. mm, metre, kg, adet ve para toplanmaz. Fire n: kayıp kayıtlarının sayısı, plan sayısı değildir. Yeniden kullanılabilir artık fireye eklenmez.
- Her metrik n gösterir. Boş sonuç veri yok; hata sıfıra çevrilmez. Her sorgu oturum tenant'ıyla sınırlı; join'lerde tenant eşitliği ve oturum tenant koşulu vardır. Tek REPEATABLE READ READ ONLY transaction kullanılır. Migration yoktur.

## Test ve CI

- production-history.test.ts: açıkça sentetik fixture; boş, tek örnek, geçersiz/sıfır süre dışlama, tek/çift medyan, karışık birim, termin eşitliği, tarih sınırı.
- `npm run test:integration -- production-history`: gerçek PostgreSQL, yalnız izole localhost renkflow_test; current_database kontrolü, iki tenant, kasıtlı hatalı tenant FK, aynı merkez kodu, tarih sınırı, worker ve özel yetki daraltması; fixture temizliği.
- scripts/test-production-history.ts mevcut integration runner'ın test-*.ts keşfine kayıtlıdır. .github/workflows/validate.yml validate job'ı zaten tüm integration scriptlerini çalıştırır; ortak dosyayı değiştirmek gerekmez.
- Gerçek fabrika verisi, tarayıcıdaki oturum akışı ve fiziksel pilot doğrulanmadı. Production Neon/Vercel/canlı DB erişimi ve deployment yok. AI çıktısı insan onayı gerektirir; draft incelemesi ve merge Berat'a aittir.

## Bu çalışma ortamındaki sonuçlar

- apps/web: type-check geçti; lint 0 hata / mevcut 3 unused-disable uyarısı.
- Tam Jest: 224 suite / 1673 test geçti; mevcut einvoice-xsd.test.ts içindeki 7 test xmllint bulunamadığı için başarısız. Tam paket yeşil değildir. Yeni odaklı suite: 7/7 geçti.
- Yeni gerçek DB integration: 1/1 geçti; fixture temizliği dahil.
- Build geçti; /reports/production dinamik rota ve standalone PDF kontrolü başarılı.
- Tenant SQL guard: yeni dosyada bulgu yok; main ile aynı SSO dosyalarında 5 mevcut bulgu nedeniyle genel kontrol başarısız (app/api/auth/sso/callback/route.ts:36; lib/features/auth/sso.ts:192,225,447,490). Baseline bastırılmadı, ilgisiz dosyalar değiştirilmedi.
- git diff --check temiz. Node ortamı v24.19.0; repo engines 22.x, CI ortamı 22 olarak kalır. Yerel doğrulama CI sonucunun yerine geçmez.

## Claude incelemesi sonrası küçük düzeltme

Termin karşılaştırması Türkiye takvim günü bazındadır: termin gününde öğleden sonra veya günün son milisaniyesinde biten iş zamanında, ertesi gece yarısı ve sonrası gecikmiş sayılır. Planlayıcının termin günü sonu yaklaşımıyla uyumlu takvim günü seçeneği kullanıldı; planlayıcı dosyası değiştirilmedi. Timestamptz doğrudan okunur. Başlangıcı dolu eski sıfır süreler medyandan çıkarılır (operasyon sayısında kalır).

Gerçek renkflow_test testi gece yarısı termin / aynı gün öğleden sonra ve ertesi gün tamamlanma durumlarını ayrı ayrı doğrular; iki-tenant izolasyonu da korunur. Yeni odaklı suite 7/7; tam Jest 224 suite / 1673 başarılı, mevcut xmllint eksikliği nedeniyle 1 suite / 7 başarısız. Type-check, lint (mevcut 3 uyarı), build ve ilgili integration 1/1 geçti. Canlı veri, tarayıcıdaki worker mesajı ve fiziksel pilot doğrulanmadı. Opsiyonel 366 günlük üst sınır ve dostça worker yetki mesajı bu küçük commit'e dahil edilmedi; mevcut yetki kontrolü korunur. Migration yoktur.
