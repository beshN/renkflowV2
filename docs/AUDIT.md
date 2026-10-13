# RenkFlow paneli — Faz 0 denetimi

Tarih: 6 Ekim 2026 · Dal: `claude/wonderful-faraday-w67fb4` · Kapsam: `apps/web` panel sayfaları, API uçları, modüller.

Bu belge kod yazmadan önce yapılan denetimin sonucudur. Hiçbir uygulama kodu değiştirilmedi.

> **Güncelleme (14 Ekim 2026):** Bu belge tarihsel taban çizgisidir. K1–K8 birleşti; ayrıntılar `docs/PROGRESS.md`'de. Güncel eksik listesi ve program durumu `docs/ROADMAP.md`'de.

## Nasıl denetlendi

| Adım | Ortam | Sonuç |
|---|---|---|
| Kapı komutu (`validate` adımları) | Bulut konteyner, Node 22 | guard:backends, guard:tenant-scope, env:audit, type-check, lint **geçti**; Jest **59 suite / 321 test geçti**; `next build` **geçti** |
| Şema | Yerel gömülü PostgreSQL (`npm run db:local`, 127.0.0.1:55432) | Boş veritabanına 028'e kadar tüm migration'lar hatasız uygulandı (97 tablo) |
| Entegrasyon testleri | Aynı yerel `renkflow_test` | `npm run test:production` ve `npm run test:warehouse` **tümü PASS** (teklif→sipariş, rezervasyon, artık/hurda, kısmi üretim, rework, sevkiyat, mal kabul ve ters kayıt, sayım onayı, transfer, rol izolasyonu) |
| Sayfa taraması | `next start` + Playwright/Chromium, test firması | 48 panel adresi **firma sahibi (owner)** ve **usta (worker)** rolüyle açıldı; konsol/sayfa hataları, 4xx/5xx istekler, uyarılar, İngilizce kalıntılar ve 390 px taşma kaydedildi |
| Yazma akışları | Aynı sunucu, gerçek formlar | Sipariş, teklif, malzeme kartı, iş emri, tedarikçi, tahsilat, personel, firma ayarı, müşteri formları gerçekten dolduruldu ve gönderildi; sonuç veritabanından doğrulandı |
| Neon `dev` dalı (`br-muddy-shape-b2meo8ce`) | Yalnız okuma (`SELECT`) | 98 tablo; **hiç veri yok** (0 firma, 0 kullanıcı, 0 sipariş). `audit_logs` tablosu yok. Production dalına hiç bağlanılmadı |
| Ölü kod | Statik import taraması | Hiçbir yerden import edilmeyen **103 modül, ~13.800 satır** (aşağıda) |

Neon `dev` dalı boş olduğu için tarama, aynı migration setiyle kurulan yerel veritabanında ve `test:production`'ın oluşturduğu sentetik test firmasıyla yapıldı. Gerçek Renk verisiyle (sayım PDF'i, gerçek müşteri/ürün) hiçbir şey denenmedi.

Durum anlamları: **çalışıyor** = gerçek DB'ye yazıyor/okuyor, rol uyguluyor, hata/boş durum var, kanıtı var · **kısmen** = çalışıyor ama hedefin önemli bir parçası eksik · **bozuk** = hata veriyor · **iskelet** = arayüz var, arka uç yok · **ölü** = yönlendirme veya kullanılmayan kod.

## Kritik bulgular (önce bunlar)

| # | Bulgu | Kanıt | Önem | Faz |
|---|---|---|---|---|
| K1 | **`/quotations` (teklif listesi) çöküyor.** "Bir Şeyler Yanlış Gitti" ekranı. `RFListView` sütun `render(value,row)` çağırıyor; sayfa ilk argümanı satır sanıyor (`q.validUntil`). `value: any` olduğu için tip denetimi yakalamıyor. | Tarama: `TypeError: Cannot read properties of null (reading 'validUntil')`; `app/(dashboard)/quotations/page.tsx:101,106` | Yüksek | 3 (veya hemen) |
| K2 | **Yeni iş emri her zaman 500.** `createWorkOrder` yeni kaydı transaction içinde değil global `sql` ile geri okuyor; commit edilmemiş satırı göremiyor, hata fırlatıyor, işlem geri alınıyor. | `500 POST /api/work-orders`, sunucu logu "Oluşturulan iş emri yüklenemedi"; `lib/features/work-orders/service.ts:292,574` | Yüksek | 5 (veya hemen) |
| K3 | **Usta (worker) teklif fiyatlarını ve müşteri adını görüyor.** `/quotations/[id]` ve `/print` worker ile açılıyor, birim fiyat/indirim/toplam görünüyor. `lib/features/auth/rbac.ts` worker'a `quotations: read,list` veriyor; `ROUTE_PERMISSIONS` içinde `/quotations`, `/crm`, `/shipments`, `/new-order`, `/accounting`, `/purchases` yok, yani menüde gizli olan sayfalar doğrudan adresle açılıyor. Belgelenen kural ("usta fiyat görmez") ihlal ediliyor. | Worker taraması, `lib/features/auth/permissions.ts:251-292` | Yüksek (güvenlik) | 1 |
| K4 | **Müşteri API'sinde rol kontrolü yok, firma yanlış seçilebiliyor.** `/api/v1/customers` ve `/[id]` (GET/POST/PUT/DELETE) yalnız oturum arıyor; usta dahil her üye müşteri oluşturup silebilir. Firma, oturumdaki aktif firma yerine kullanıcının **ilk** üyeliğinden (`ORDER BY created_at ASC LIMIT 1`) okunuyor. Aynı kalıp `/api/v1/dashboard/summary`'de de var. Zod doğrulaması ve aynı-köken (CSRF) kontrolü yok. | `app/api/v1/customers/route.ts:5`, `[id]/route.ts:9` | Yüksek (güvenlik) | 1 |
| K5 | **Denetim kaydı dağınık ve kısmen bozuk.** `/api/audit` var olmayan `audit_logs` tablosunu okuyor → 500. `002_audit_logs.sql` migration kaydında yok. Bu uç rol de kontrol etmiyor. Gerçek iz `activity_logs`, `production_events`, `work_order_events` ve stok defterine dağılmış; panelden yeni sipariş oluşturmak `activity_logs`'a **kayıt düşmüyor**. | Akış testi: `audit API 500`, `activityLogs: 0` | Yüksek | 1 |
| K6 | **Siparişler müşteri kartına bağlı değil.** `orders.customer_id` kolonu var ama sipariş servisi hiç yazmıyor; sipariş yalnız serbest metin `customer_name` tutuyor. CRM 0 müşteri gösterirken siparişlerde 4 farklı müşteri adı var. Cari, müşteri geçmişi, CRM ciro sütunu bu yüzden boş kalır. | Akış testi: `customerIdLinked: false`; `lib/features/orders/postgres/order.postgres.ts` | Yüksek (modül bağlantısı) | 3 |
| K7 | **CRM "Yeni Müşteri" düğmesi hiçbir şey açmıyor.** `setShowNewCustomer(true)` çağrılıyor ama bu state hiçbir yerde okunmuyor; form yok. Panelden müşteri oluşturmanın yolu yok. | Akış testi: diyalog 0; `app/(dashboard)/crm/page.tsx:39` | Orta | 3 |
| K8 | **Kesim motoru boy karışımını optimize etmiyor.** Yeni çubuk açarken parçanın sığdığı **en kısa** kaynağı seçiyor; 6–10 m boy karışımı, çoklu sipariş birlikte kesimin global kalitesi ve fire karşılaştırması yok. İki geçişli best-fit, `optimalityProven:false`. Birimler (`mm()` = mikrometre) tutarlı, hata yok. | `lib/features/manufacturing/cutting-engine.ts:79-140` | Ürünün kalbi | 4 |
| K9 | **Çoklu sağlayıcı AI katmanı ölü kod.** Prompt'ta bahsedilen `lib/features/ai/ai.service.ts` (gemini/openai/claude seçimi) hiçbir yerden import edilmiyor; etkin yol yalnız `lib/ai/service.ts` (OpenAI Responses / `gpt-6-luna`). Model değiştirme bugün bir ayar değil. | Ölü kod taraması | Orta | 7 |

## Sayfa tablosu

Süre: owner ile ilk açılış (ağ boşta + 0,8 sn). `—` = ölçülmedi. "Uzun bağlantı" = SSE akışı nedeniyle ağ hiç boşa düşmüyor (hata değil).

| Sayfa | Durum | Kanıt | Eksik / sorun | Tahmini iş | Bağımlılık |
|---|---|---|---|---|---|
| `dashboard` | çalışıyor | 200, gerçek sipariş sayıları, hata yok | Kart başlıkları ile sayfa başlığı ayrı `h1` (iki `h1`) | S | — |
| `dashboard/professional` | ölü | `/dashboard`'a yönleniyor | Sil (yönlendirme kalabilir) | XS | — |
| `orders` | çalışıyor | 200, filtre/görünüm/CSV; arama API'si yeni siparişi buluyor | — | — | — |
| `orders/[id]` | çalışıyor | 200, durum adımları, 3D, belge | `OrderQrActionsSection` ve `OrderFinanceSection` bileşenleri yazılmış ama hiçbir sayfada kullanılmıyor (sipariş detayında tahsilat/QR bölümü yok) | M | 6 |
| `orders/[id]/invoice` | çalışıyor | Ticari döküm; worker'a "erişim yetkiniz yok" | Adı "invoice" ama resmi fatura değil, sipariş dökümü | S | 6 |
| `new-order` | kısmen | Form gerçekten sipariş yazıyor (DB +1) | Müşteri kartına bağlanmıyor (K6); `activity_logs` kaydı yok; ürün ailesine göre ölçü konfigürasyonu, fiyat matrisi, BOM ve kesim talebi üretimi yok (yalnız makaslı tente 3D) | L | 2, 3 |
| `quotations` | **bozuk** | Liste çöküyor (K1) | — | XS | — |
| `quotations/new` | çalışıyor | Form kaydı DB'ye yazıyor, detaya yönleniyor | Fiyat elle giriliyor; fiyat matrisi yok | M | 3 |
| `quotations/[id]` | kısmen | "Siparişe dönüştür" var; dönüşüm entegrasyon testinde geçiyor | Worker fiyat görüyor (K3) | S | 1 |
| `quotations/[id]/print` | kısmen | Gerçek numara ve fiyatla yazdırma | Worker erişimi (K3) | S | 1 |
| `crm` | kısmen | Liste ve boş durum çalışıyor | Yeni müşteri formu yok (K7); siparişlerle bağ yok (K6) | M | 3 |
| `crm/[id]` | kısmen | Var olmayan id → 404 ve listeye dönüş | Panelden müşteri oluşturulamadığı için dolu kartla denenemedi; API'de rol yok (K4) | M | 1, 3 |
| `production` | çalışıyor | Uzun bağlantı; reçete/kesim/çizelge/belgeden sipariş sekmeleri; entegrasyon testleri | Kesim motoru (K8); etiket/usta PDF'i yok | L | 4 |
| `production/intake/[id]` | kısmen | İnsan onaylı belge→sipariş akışı testte geçiyor | Gerçek AI çıkarımı bu ortamda denenemedi (anahtar yok); worker'da 403 doğru | M | 7 |
| `production/labels` | ölü | `/warehouse/labels`'a yönleniyor | — | XS | — |
| `factory` (usta ekranı) | çalışıyor | Uzun bağlantı; çevrim dışı kuyruk ve çakışma senaryosu mevcut tarayıcı testinde | — | — | — |
| `work-orders` | kısmen | Liste çalışıyor | Eski görev/checklist modülü; yerel üretim (production) ile paralel ikinci iş emri kavramı | M | 5 |
| `work-orders/new` | **bozuk** | Her gönderimde 500 (K2) | — | XS | — |
| `work-orders/[workOrderId]` | çalışıyor | Detay, checklist, notlar okunuyor | Paralel modül sorunu (yukarıda) | — | 5 |
| `kanban` | kısmen (tekrar) | Aynı eski `work_orders` verisi, sürükle-bırak sütunları | `work-orders` ile aynı veri; menüde "Üretim akışı" adıyla ayrıca duruyor. Birleştirme önerisi aşağıda | S | 5 |
| `shipments` | kısmen | Gerçek sevkiyat kaydı listeleniyor | Salt okunur; sevkiyat yalnız üretim merkezinden oluşuyor (tasarım gereği). Liste → sipariş/irsaliye bağlantısı yok | M | 5, 6 |
| `inventory` | kısmen | Gerçek bakiye, birim ayrımı doğru | Depo kodları ham gösteriliyor (`RAW`, `WIP`, `FINISHED`, `Rejected`); stok kalemi = profil kodu + ölçü + renk + boy modeli yok (renk lot metadata'sında, ürün ailesi/ölçü alanı yok) | L | 2 |
| `inventory/new` | kısmen | Form doğrulamalı, DB'ye yazıyor (boy ≥100 mm, ağırlık) | Renk, ölçü, işlenmiş hâl (boyalı/delikli/hazır), birim "takım/boy" yok; etiket/alan adları erişilebilir `label` değil | M | 2 |
| `inventory/[id]` | çalışıyor | Bakiye + lot geçmişi | Ham depo kodları | XS | 2 |
| `inventory/movements` | çalışıyor | Defter fişleri listeleniyor | Hareketin kaynağına (sipariş/kesim/sayım) bağlantı yok | S | 2 |
| `warehouse` | çalışıyor | `test:warehouse` PASS; yeni raf formu açılıyor | Ham depo kodları | S | 2 |
| `warehouse/scan` | çalışıyor | `test:warehouse` PASS | Hedef akış "okutmaya gerek kalmasın"; okutma bugün ana yol | — | 4 |
| `warehouse/labels` | çalışıyor | Etiket merkezi açılıyor | Paket/raf etiketi + paketin altındaki profile etiket akışı yok | M | 2 |
| `scrap` | çalışıyor | Artık lotları ve kesim hurdası | Worker'a yanlış metin: "Satın alma erişim yetkiniz yok" | XS | 8 |
| `purchases` | çalışıyor | Entegrasyon testleri; "Yeni satın alma" formu açılıyor | Eksik malzemeden otomatik taslak yok | M | 5, 7 |
| `receipts` | çalışıyor | Kısmi kabul/red/ters kayıt testte geçiyor | — | — | — |
| `suppliers` | çalışıyor | Diyalogdan oluşturma DB'ye yazıyor | Başarı mesajı yanlış: "stok ve sipariş kayıtları güncellendi" | XS | 8 |
| `finance` | çalışıyor | Gerçek tahsilat/bakiye özeti, para birimi ayrımı | Aynı sayfada iki başlık ("Finans Kontrolü" + "Finans Komuta Ekranı"); renkli tutarlar tasarım diliyle uyumsuz | S | 8 |
| `finance/invoice` | kısmen | Sipariş bazlı liste (`FAT-ORD-…`) | Gerçek fatura kaydı değil; e-Fatura/e-Arşiv yok | L | 6 |
| `finance/invoice/print` | kısmen | Parametre yoksa "Sipariş parametresi bulunamadı" | Siparişten türetilen baskı, yasal fatura değil | M | 6 |
| `finance/payments` | çalışıyor | Tahsilat formu doğruluyor ve yazıyor | Tarih alanı bugünle dolu gelmiyor | XS | 6 |
| `finance/documents` | çalışıyor | Arşiv ve boş durum | Worker'da önce 500 (server action), sonra yönlendirme | XS | 1 |
| `finance/employees` | çalışıyor | Çalışan ekleme DB'ye yazıyor | — | — | — |
| `finance/employees/[id]` | çalışıyor | Hesap hareketleri | — | — | — |
| `accounting` | kısmen | Operasyonel TRY raporları, ay seçimi | Resmi muhasebe değil (doğru biçimde belirtilmiş); worker'da 403 yerine **500** ("Muhasebe verileri alınamadı") | M | 6 |
| `reports` | çalışıyor | Gerçek sipariş/üretim değerleri, CSV | — | — | — |
| `analytics` | ölü | `/reports`'a yönleniyor | — | XS | — |
| `cutting-optimizer` | ölü | `/production?tab=cutting`'e yönleniyor | — | XS | — |
| `members` | ölü | `/team`'e yönleniyor | — | XS | — |
| `team` | kısmen | Üye listesi | Davet ayarlarda; rol değiştirme/üyelik kaldırma ekranı bu sayfada yok | M | 1 |
| `settings` | çalışıyor | Firma adı kaydı DB'ye yazıldı (test sonrası geri alındı) | Bazı alanların erişilebilir etiketi yok (renk, seçim) | S | 1, 8 |
| `notifications` | çalışıyor | Okundu/tümü okundu | — | — | — |
| `search` | kısmen | Sayfa açılıyor | Yalnız istemcide yüklü sipariş listesinde arıyor; müşteri/teklif/stok aramıyor; `RF-…` siparişleri varken "RF" için 0 sonuç verdi (kök neden araştırılacak) | M | 1 |

Ortak gözlemler (tüm sayfalar):
- Owner taramasında **hiçbir sayfada 5xx veya yakalanmamış tarayıcı hatası yok** (quotations hariç). 390 px'te yatay taşma yok.
- Çoğu sayfada **iki `h1`** var (üst bar başlığı + sayfa başlığı) ve `AppleNavbar` kullanan sayfalarda **iç içe `<main>`** var; ekran okuyucu ve Playwright `strict` seçicileri için sorun.
- Yaklaşık 2 sn ilk açılış süresi (yerel, production build); performans ölçümü (LCP/JS ağırlığı) yapılmadı.

## API uçları (öne çıkanlar)

104 route dosyası var; tamamı tek tek kullanılmadı. Tarama ve akışlarda dokunulanlar ile statik kontrolde dikkat çekenler:

| Uç | Durum | Not |
|---|---|---|
| `v1/orders`, `v1/orders/[id]`, `/transition`, `/status` | çalışıyor | Sipariş oluşturma, sürüm/tekrar korumalı geçişler test edildi |
| `v1/quotations`, `/[id]` | kısmen | Çalışıyor; worker okuma yetkisi (K3) |
| `v1/customers`, `/[id]` | kısmen (güvenlik) | K4 |
| `v1/dashboard/summary` | kısmen | İlk üyelikten firma seçiyor |
| `audit` | **bozuk** | K5 |
| `work-orders` POST | **bozuk** | K2 |
| `v1/production*`, `v1/warehouse`, `v1/procurement/*`, `v1/inventory/*` | çalışıyor | Entegrasyon testleri ve tarama |
| `v1/finance/workspace` | çalışıyor | Worker'a 403 (doğru) |
| `v1/search` | çalışıyor | Yeni siparişi buldu |
| `ai/*` | doğrulanamadı | Bu ortamda AI anahtarı yok |
| `auth/register`, `forgot/reset`, `tenant/invite*` | doğrulanamadı | Faz 1'de uçtan uca denenecek (Resend gerekli) |
| `sso/*`, `auth/sso/*` (iki ayrı SSO uç seti) | ölü aday | İstemciden hiç çağrılmıyor; Renk için SSO gerekmiyorsa kaldırma önerisi |
| `support/tickets*`, `onboarding/session`, `export*`, `internal/metrics`, `analytics/*` | ölü aday | İstemciden çağrılmıyor |
| `test-email` | ölü | Production'da 404; kaldır |
| İstemcide çağrılan ama route'u olmayan | bozuk ölü kod | `/api/orders`, `/api/orders/:id`, `/api/socket` (`useLiveOrders`), `/api/analytics/performance` (`lib/performance/monitoring.ts`); ikisi de kullanılmıyor |

## Ölü kod ve tekrar eden sayfalar

**Silme önerisi (onayın olmadan silinmeyecek):**

1. Yönlendirme sayfaları: `dashboard/professional`, `analytics`, `cutting-optimizer`, `members`, `production/labels`. Eski bağlantılar kırılmasın diye yönlendirme `next.config.js` `redirects()`'e taşınabilir, sayfa dosyaları silinir.
2. `kanban` ↔ `work-orders`: aynı eski `work_orders` verisinin iki görünümü. Ayrıca yerel üretim (`production`, `factory`) asıl iş emri sistemini taşıyor. Öneri: eski `work_orders`/checklist modülünü üretim merkezine bağlamak ya da emekliye ayırmak, `kanban`'ı `production`'ın bir görünüm sekmesine çevirmek. Karar Faz 5'te (işin gerçek akışını sana doğrulatarak).
3. Hiç import edilmeyen 103 modül (~13.800 satır). Büyük gruplar: `components/landing-new/*` (11), eski `components/layout/Sidebar.tsx`, `components/dashboard*`, `components/analytics/*`, `components/finance/*` (4), `lib/performance/*`, `lib/offline/*`, `lib/shared/*`, `lib/features/orders/services-deprecated.ts`, `useOrders.new.ts`, `lib/realtime/socket-server.ts`, `lib/features/manufacturing/pilot.service.ts`, `lib/features/ai/ai.service.ts` (K9 — Faz 7'de değerlendirilecek, silinmemeli). Tam liste denetim notlarında; yalnız ilk seviye taranmıştır (ölü dosyaların import ettiği dosyalar dahil değil, gerçek miktar daha büyük).
4. İki ayrı SSO uç seti (`api/sso/*` ve `api/auth/sso/*`), `support/tickets`, `onboarding/session`: Renk pilotu için gerekmiyorsa kaldır.

## Süreç: bugün ile hedef arası fark

```
Hedef:  Sipariş ─► kesim planı (en az fire) ─► onay teklifi ─► usta PDF'i ─► stok otomatik düşer + artık kaydı ─► üretim ─► sevkiyat ─► fatura/tahsilat
Bugün:  Sipariş (müşteri kartına bağsız, BOM yok)
          └─► üretim emri (reçete + BOM, yalnız makaslı tente reçetesi var)
                └─► toplu kesim önizlemesi (en kısa çubuk seçer) ─► yönetici onayı = rezervasyon
                      └─► usta ekranında gerçekleşen artık boyu elle girilir ─► stok defteri, artık lotu, hurda kg
                            └─► kısmi üretim/paketleme ─► sevkiyat ─► (sipariş bazlı tahsilat; gerçek fatura yok)
```

Eksik halkalar: sipariş → müşteri/cari; ürün ailesine göre ölçü→BOM→kesim talebi (pergola, alüminyum tavan, giyotin cam için reçete yok); boy karışımı optimizasyonu; usta PDF'i (raf/paket/kesim/delik/QR); onayda otomatik stok düşümü (bugün gerçekleşme ekranında girilen artıkla düşüyor); eksik malzemeden satın alma taslağı; gerçek fatura/e-belge.

## Tasarım eleştirisi (kısa)

**Genel izlenim:** Sakin, nötr, tek kobalt vurgu, Geist; "AI sitesi" görüntüsünden uzak. En büyük fırsat, sayfa başlığı ve kart kalıplarının tek bir standarda oturtulması.

| Bulgu | Önem | Öneri |
|---|---|---|
| Sayfa başlığı üç farklı kalıpta: büyük selamlama (dashboard), eyebrow + başlık + sekme (production), yapışkan küçük bar + panel içinde ikinci başlık (inventory, finance, crm) | 🟡 | Tek `PageHeader` bileşeni: eyebrow, `h1`, açıklama, sağda birincil eylem |
| Çift başlık: "Finans Kontrolü" + "Finans Komuta Ekranı", "Müşteri Yönetimi" + "Müşteri Listesi" | 🟡 | Bir başlık; ikincisi bölüm başlığı (`h2`) |
| Çok renkli vurgu: stok kartlarında mor/yeşil ikon zeminleri, finansta turuncu/yeşil tutarlar | 🟢 | Durum renkleri yalnız durum için; KPI'lar nötr, tek kobalt vurgu (`theme.css` kuralı) |
| Ham sistem kodları: `RAW`, `WIP`, `FINISHED`, `Rejected` | 🟡 | Türkçe görünen adlar: Hammadde, Yarı mamul, Mamul, Karantina |
| Menüde Teklifler ve Müşteriler en altta "Yönetim" grubunda; iş akışı müşteri → teklif → sipariş | 🟡 | "Satış" grubu: Müşteriler, Teklifler, Siparişler |
| İki `h1`, iç içe `main`, bazı form alanlarında `label` yok (`inventory/new`, `settings`) | 🟡 | Faz 8 erişilebilirlik turunda düzelt |

**İyi olanlar:** Tutarlı kart dili, sakin tipografi, iyi boş durum metinleri ("Henüz finans belgesi yok · Sipariş detayından…"), para birimlerinin karıştırılmaması, rol bazlı menü.

## Bilinmeyenler / doğrulayamadıklarım

- **Gerçek veri:** Neon `dev` dalı boş; sayım PDF'i (`malzeme_say_m_listesi.pdf`) bu oturumda yok. Stok modeli ve içe aktarma bununla tasarlanacak.
- **E-posta (Resend), AI (OpenAI), Vercel Blob:** anahtarlar bu ortamda yok; kayıt doğrulama e-postası, davet e-postası, belge çıkarımı, dosya yükleme uçtan uca denenmedi.
- **Kanban sürükle-bırak**, **teklif → sipariş dönüşümü (arayüzden)**, **sipariş silme**, **3D yapılandırıcı** arayüzden tıklanarak denenmedi; dönüşüm ve silme entegrasyon testlerinde geçiyor.
- `e2e/` altındaki 4 Playwright spec çalıştırılmadı (yapılandırma `PLAYWRIGHT_BASE_URL` / sunucu bekliyor); Faz 9'da kapıya bağlanmalı.
- Performans (LCP, JS ağırlığı) ve çok kullanıcılı yük ölçülmedi.
- Mobil uygulama (`apps/mobile`) kapsam dışı tutuldu.

## Önerilen sıra

1. **Faz 1 başında hızlı düzeltmeler (küçük, güvenli):** K1 teklif listesi çökmesi, K2 iş emri oluşturma. Her biri birkaç satır + regresyon testi.
2. **Faz 1 güvenlik:** K3 worker'ın ticari sayfa/API erişimi, K4 müşteri API rol ve firma seçimi, K5 tek denetim kaydı, worker'da 500 dönen server action'lar (accounting, finance/documents) → 403.
3. Faz 2'ye geçmeden sayım PDF'i ve Renk'ten iş kuralı değerleri (kerf, baş/son tıraş, minimum artık boyu) gerekli.
