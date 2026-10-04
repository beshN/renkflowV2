# RenkFlow — Mac üzerinde devam notu

Son çalışma: 2 Ekim 2026. Hedef tek şirket, **Renk Alüminyum**; web uygulaması öncelikli. ERPNext runtime bağımlılığı yok; mevcut native stok/üretim altyapısı korunuyor. Kullanıcı isteğiyle geliştirme burada durduruldu.

## Tamamlanan değişiklikler

- Sidebar geçişi 150 ms; hover sayfa içeriğini kaydırmıyor. Sabitleme tercihi tarayıcıda saklanıyor. Çıkış düğmesi gerçek oturum kapatmayı kullanıyor.
- Daha sade kartlar, üst menü, sayfa geçişleri ve mobil alt menü. Mobil AI düğmesi alt menüyü kapatmıyor; sohbet penceresi ekran genişliğine sığıyor.
- Mobilya şablonları yerine alüminyum iş akışı; sipariş formunda mm ölçüleri, RAL/yüzey, profil/seri notları ve çoklu kalemler. Fiyatı henüz belli olmayan siparişler sıfır tutarla kaydedilebiliyor; negatif miktar/fiyat/ölçüler kabul edilmiyor.
- Gerçek sipariş araması, yerel liste araması/sayfalama, görünür yenileme düğmesi. İş emirleri listesi/detayı, firma ayarları, ekip ve bildirim sayfaları mevcut API'lerle bağlandı.
- Raporlarda uydurma fire/kapasite değerleri kaldırıldı; gerçek sipariş özeti ve CSV ihracı eklendi. Hurda/profil artıkları gerçek depo bakiyelerini bekliyor.
- Stokta metre/kg/adet birlikte toplanmıyor. Yükleme hatası sıfır stok veya “stok normal” olarak sunulmuyor. Stok sorgusu başarısız olsa da sipariş dashboard özeti alınabiliyor; eski açık siparişler 90 günlük filtreyle gizlenmiyor.
- PostgreSQL tagged-query istemcisi düzeltildi: iç içe SQL parçaları Promise'e dönüşmeden korunuyor.
- Yerel geliştirmede JS/CSS için bir yıllık immutable önbellek kaldırıldı. Eksik `critters` nedeniyle hata ekranını da bozan deneysel CSS optimizasyonu kapatıldı.

## Doğrulama

- Typecheck ve ESLint başarılı.
- Jest: **22 suite / 190 test başarılı**.
- Son production build başarılı (Next.js 16.1.6).
- Demo girişi; dashboard, sipariş listesi, arama, iş emirleri listesi, ayarlar, ekip, bildirimler, raporlar ve stok hata görünümü tarayıcıda kontrol edildi.
- 1440 px masaüstü / 390 px mobil yeni sipariş ekranları kontrol edildi; yatay taşma yok. Menü sabitleme kalıcı, üst menü araması `/search?q=...` sayfasına ulaşıyor.
- Bu oturumda test amacıyla yeni sipariş veya stok hareketi oluşturulmadı. Stok/üretim uçtan uca pilotu tamamlandı olarak kabul edilmemeli.

## Mac'te açılış

GitHub'dan `main` dalını alın (mevcut checkout varsa önce yerel değişikliklerini koruyun):

```sh
git clone https://github.com/beshN/renkflowV2.git
cd renkflowV2/apps/web
npm ci --workspaces=false
```

Node.js'in desteklenen güncel LTS sürümünü kullanın (bu bilgisayarda Node 24 ile doğrulandı). `apps/web/.env.example` sözleşmesine göre `apps/web/.env.local` dosyasını güvenli biçimde yapılandırın. Windows'taki `.env.local`, kimlik bilgileri ve veri yedekleri GitHub'a gönderilmedi. Veritabanı ve storage kimlik bilgilerini mevcut platformun güvenli ortam değişkenlerinden temin edin; Git'e eklemeyin.

Yerel URL'leri ayarlayın ve landing yerine paneli açın:

```sh
AUTH_URL=http://localhost:3000 NEXTAUTH_URL=http://localhost:3000 PUBLIC_SITE_MODE=off npm run dev -- --hostname 127.0.0.1 --port 3000
```

Panel: `http://localhost:3000/new-order`. Aynı veritabanı kullanılırsa mevcut demo hesabı orada kalır. Tarayıcı eski görünümü gösterirse sert yenileme yapın.

## Kalan işler ve güvenlik sınırları

1. Bağlı veritabanında `stock_balances` tablosu yok. Yeni native stok şeması güvenli yedek ve migration incelemesi yapılmadan uygulanmadı. Önce ayrı geliştirme/test veritabanında migration ve 40×40 profil pilotunu doğrulayın; canlı veritabanında doğrudan seed/migration çalıştırmayın.
2. PDF/AI servisinin beklediği `ZAI_API_KEY` yerel ortamda yok. Gerçek belge çıkarımı doğrulanmadı; insan onayı zorunlu kalmalı.
3. İş emri ekranları mevcut görev/checklist API'sini kullanıyor. BOM bağlantısı, rezervasyon, WIP transferi ve gerçek üretim tüketimi ekranlarının uçtan uca bağlantısı ayrıca tamamlanmalı. Kesim optimizer sonraki ayrı modül; tamamlandı diye sunulmamalı.
4. Bu frontend çalışması tüm modüllerin üretime hazır olduğu anlamına gelmiyor. Satın alma/mal kabul ve stok hareketleri kurulmuş şema üzerinde ayrıca test edilmeli. Multi-tenant, mobil uygulama ve muhasebe kapsamı büyütülmemeli.
5. Yerel `.env.local` canlı veritabanına bağlıydı. Yalnız eski demo şirketi ve RF-001/002/003 mobilya örnekleri, kesin eşleşme koşullarıyla alüminyum örneklerine çevrildi; diğer kayıtlar korunuyor. Değişim öncesi JSON yedeği Windows çalışma alanının `outputs/renkflow-demo-before-*.json` dosyasında kaldı. Bu yedek ve ekran görüntüleri hassas veri ihtimalinden dolayı repoya eklenmedi.

Yeni değişikliklerden sonra web klasöründe `npm run type-check`, `npm run lint`, `npm test -- --runInBand` ve `npm run build` çalıştırın. Build ile dev sunucusunu aynı `.next` üzerinde aynı anda çalıştırmayın.

## Mac devamı — 2 Ekim 2026

- `main`, GitHub'daki `ba786a7` commit'ine güncellendi. Önceki `revamp/supabase-core`
  dalının kaydedilmemiş değişiklikleri untracked dosyalarla birlikte Git stash'te;
  ortam dosyaları ve eski üretilmiş dosyalar çalışma alanının yanındaki yerel yedekte korundu.
- Windows kilit dosyasında eksik olan 57 platform/yardımcı paket kaydı tamamlandı.
  Mevcut paket sürümleri değiştirilmedi; Mac'te `npm ci --workspaces=false` başarılı.
- Migration yürütücüsü SQL dosyalarını `;` karakterinde parçalamıyor; PostgreSQL'e
  tam dosya gönderiliyor. Böylece `DO $$ ... $$` ve trigger fonksiyonları korunuyor.
  Regresyon testleri ve gerçek PostgreSQL'de salt okunur anonim blok kontrolü başarılı.
- `npm run db:check-manufacturing` eklendi. Salt okunur şema kontrolü, mevcut bağlı
  veritabanında native stok tablolarının ve üretim alanlarının eksik olduğunu doğruladı.
  Canlı migration, seed, yeni sipariş veya stok hareketi çalıştırılmadı.
- Typecheck, ESLint, **23 suite / 192 test** ve production build başarılı.
  Demo girişi, yeni sipariş ekranı ve mevcut üç alüminyum siparişinin listesi tarayıcıda
  doğrulandı. Kontrol edilen yeni sipariş ekranında yatay taşma veya hata overlay'i yok.
- `ZAI_API_KEY` ve ayrı stok/üretim test veritabanı hâlâ gerekli. Yukarıdaki kalan
  işler tamamlanmış sayılmamalı; 40×40 profil pilotu henüz çalıştırılmadı.

## Kurumsal frontend devamı — 3 Ekim 2026

- Ortak çalışma alanı yeniden tasarlandı: grafit menü, sabit üst bar, sayfa konumu,
  daraltılabilir menü, mobil tüm-modül çekmecesi, tema ve erişilebilir odak stilleri.
  Panel, giriş, sipariş listesi ve yeni sipariş ekranları aynı renk ve tipografi sistemini kullanıyor.
- Cmd/Ctrl+K komut araması, yetkili modüllere ve mevcut siparişlere erişiyor.
- Dashboard gerçek sipariş dağılımı, geciken işler, bugünkü terminler ve teslimat
  gündemini gösteriyor; kartlar ilgili sipariş filtrelerine açılıyor.
- Sipariş çalışma alanına URL'de saklanan arama/durum/aşama/görünüm filtreleri,
  termin ve müşteri sıralaması, seçim ve UTF-8 CSV indirme eklendi. CSV hücreleri
  formül çalıştırmayı önleyecek şekilde yazılıyor; farklı para birimleri toplanmıyor.
- Sipariş detayı, olmayan `/api/orders/:id` yerine `/api/v1/orders/:id` adresini ve
  gerçek `{ data }` yanıtını kullanıyor. Ağ hatası ile bulunamayan kayıt ayrıldı.
  Fatura placeholder'ı yerine yazdırılabilir operasyon sipariş dökümü eklendi.
- Paylaşılan tabloya gerçek sıralama, klavye ile satır açma, kontrollü seçim ve
  başarısız veri isteği / boş sonuç ayrımı eklendi. Sevkiyat, satın alma, mal kabul
  ve tedarikçi listeleri veri hatasını sessizce boş liste olarak göstermiyor.
  Bu üç operasyon listesindeki henüz bağlanmamış oluşturma düğmeleri kaldırıldı;
  oluşturma akışları tamamlandı diye sunulmamalı.
- Sipariş formunda çoklu kalem hesabı, dosya hataları, gönderim hatasında veri
  koruma, klavyeyle belge seçme ve mobil kayıt araçları iyileştirildi. AI belge
  analizi yapılandırılmadığında kullanılabilirlik durumu gösteriliyor.
- `useOrders` fetch ve hata callback'leri sabitlendi; gereksiz sürekli yenileme
  döngüsü giderildi. Paylaşılan input etiket/uyarı ID'leri ve durum rozetlerindeki
  dinamik Tailwind sınıf hatası düzeltildi.
- Typecheck, ESLint, **28 suite / 211 test** ve production build başarılı.
  Tarayıcıda demo girişi, komut aramasıyla detay açma, eski `pending` durumunun
  `Yeni` filtresinde bulunması, CSV indirme, mobil menü ve sipariş dökümünün PDF
  çıktısı doğrulandı. 390 px mobil genişlikte sayfa yatay taşmıyor; tablo kendi
  içinde kayıyor. Kontrol edilen sipariş dökümünde ve dashboard'un açık/koyu
  temalarında axe ihlali yok; bu otomatik
  kontrol tüm uygulama için erişilebilirlik sertifikası değildir.
- Canlı kayıt oluşturma/silme, durum değişimi, storage yükleme ve stok hareketi
  yapılmadı. Form gönderimi component testlerinde mock callback ile doğrulandı.
  Mevcut legacy `order_items` tablosunda teknik ölçü kolonları ve `activity_logs`
  eksik; yeni kalem kaydı ve durum geçişleri ayrı test veritabanında migration
  sonrası doğrulanmalı. Native stok `503`, ERP listeleri eksik şemada `500`
  döndürüyor. AI key, storage ve backend şema gereksinimleri hâlâ kalan işlerdir.


## Üretim platformu ve WINMAX 3D — 3 Ekim 2026

- Üretim merkezi, atanmış usta ekranı, kullanıcı kapsamlı çevrim dışı kuyruk, operasyon sürümleri ve kalıcı SSE olayları eklendi. Reçete sürümü ve deterministik BOM iş emrinde korunuyor. Gerçek mühendislik reçetesi uygulamadan doğrulanıp yayınlanmalı; test reçetesi ticari veri değildir.
- Orijinal ZIP modelinden lazy React 3D bileşeni: bağımsız en/açılım/montaj yüksekliği, motor/LED, kamera/gece/animasyon, mobile tam ekran, kaynak temizliği, WebGL fallback. Teklif/sipariş kalemleri ve dönüşüm tam yapılandırmayı taşıyor. Elle girilen fiyat/adet/indirim ve eski `heightMm` korunuyor. Teklif PDF'si gerçek numara ve kayıtlı temsili görselle doğrulandı.
- Fiziksel lot/renk bazlı çoklu sipariş kesimi, rezerve etme, gerçek artık ölçüsü, tekrar kullanılabilir lot, hurda kg/maliyet ve ayrı rework profil kesimi uygulandı. Onaylı stok defterinde düzeltme ters kayıtla; kısmi üretim, mamul etiketi, kısmi sevkiyat ve teslimat korunuyor.
- Belge çok kalemli AI taslağı kaynak/kanıt/belirsizlikle inceleniyor; insan onayı idempotent. Aktif AI sunucuda `gpt-6-luna` Responses API kullanıyor. Gerçek model/görsel analizi test edildi. Anahtar `.env.local` içinde Git dışında; sohbet geçmişi kullanıcı/firma kapsamında.
- İptal edilebilir müşteri takibi, Resend/WhatsApp kalıcı gönderim kuyruğu, teslimat/deneme geçmişi, imzalı gelen mesaj webhookları ve ortak taslak incelemesi eklendi. Gerçek gönderim için sağlayıcı/domain/onaylı WhatsApp şablonu ve ayrı worker gerekli; kanallar varsayılan kapalı.
- Kalıcı loopback PostgreSQL `npm run db:local` ile dev/test veritabanlarını açıyor. Yerel `.env.local` `renkflow_dev` veritabanına bağlandı; eski uzak canlı veritabanına yazılmadı. Demo `demo@renkflow.com` / `demo123456`.
- Doğrulama: 29 suite / 224 test, typecheck, ESLint ve production build; ayrı gerçek PostgreSQL'de üretim/stok/teklif/iletişim invariantları; gerçek çalışan/yönetici oturumuyla mobile offline eşitleme ve çatışma sonrası tüm üretim rotası. Test komutları ve canlı pilot hazırlığı: `apps/web/docs/production-platform.md`.
- Canlı deployment yapılmadı. Gerçek mühendislik reçeteleri, kapasiteler, fiziksel başlangıç stoğu, staging migration ve e-posta/WhatsApp sağlayıcı aktivasyonu fabrika pilotuna geçmeden doğrulanmalı.

## Tedarik, kalite, finans ve SaaS akışlarının tamamlanması — 3 Ekim 2026

- MRPeasy, Odoo, Katana ve Linear'ın resmi ürün akışları incelendi. Mevcut RenkFlow koduna fiziksel mal kabulü, kontrol kapıları, gerçek üretim süreleri ve yetkili çalışma alanları eklendi; kişisel kayıtlı görünümler henüz uygulanmadı.
- Tedarikçi oluştur/düzenle, çok kalemli satın alma taslağı/onayı/iptali, kısmi kabul/red ve kullanılmamış kabulün gerekçeli ters kaydı artık ekranlardan yürür. Profil sayısı/boyu/rengi TL/metre maliyetiyle ayrı fiziksel lotlara yazılır. REJECTED karantina stoğu kabul miktarını artırmaz. Reservation veya tüketim varsa geri alma engellenir.
- Operasyon reçetesinde geçer/kalır, ölçüm toleransı ve fotoğraf kontrolü tanımlanır. Kalite sonucu deneme/miktar/çalışan/fotoğraflarla korunur; başarısız kontrol sonraki aşamayı engeller. Kısmi üretim ve rework kalan süre hesabı geçmiş çalışmayı ikinci kez düşmez.
- Hurda ekranı gerçek artıkları ve kesim kayıplarını gösterir. Native malzeme oluşturma ve detay ekranları fiziksel stok/lot geçmişine bağlıdır. Yönetilen profil/üretim hareketleri genel API'den uydurulamaz; manuel genel düzeltme yönetici ve gerekçe ister.
- Finans tahsilat/personel/kişi hareketi/belge sayfaları aktif. Çek/kredi kartı migration uyumsuzluğu düzeltildi. Para birimi, fazla tahsilat, kayıt tekrarları, eski personel sürümü ve kapalı döneme yazma korunur. Personel silme kısayolu mali geçmişi koruyarak pasife alır.
- Muhasebede ay seçimi ve altı operasyonel görünüm bağlı. TRY kapsamı açık; dövizli tutarlar karıştırılmaz. Eski sabit vergi oranı/beyan günü varsayımları kaldırıldı; maaş tahakkuku nakit ödemesi sayılmaz. Native stok bakiyesi son kayıtlı birim maliyetle değerlenir, resmi maliyet muhasebesi değildir. Yasal rapor/gerçek muhasebe onayı olarak sunulmamalı. Dönemi açma/kapama yöneticiyle sınırlı.
- Bildirim şeması ve merkez tamamlandı: aynı kullanıcı/farklı firma izolasyonu, okunmamış filtresi, tek/toplu okuma ve sayfalama. Sunucu action'ları güncel üyelik rolünü okur. Ekip daveti kopyalama/gönderim hataları doğru gösterilir. Mobil ikincil düğmeler ortak stile bağlandı, responsive sidebar geçişi düzeltildi.
- Eski `/cutting-optimizer`, `/analytics`, `/members`, `/dashboard/professional` çalışan ekranlara yönlenir. Eski metraj temelli 012 CLI pilotu yazmadan durur; güncel pilot testi `npm run test:production`.
- Ek migration'lar: 015 tedarik, 016 kalite, 017 finans, 018 bildirim. Yerel dev/test ortamında uygulandı; uzak canlı veritabanına yazılmadı.
- Doğrulama: **34 suite / 238 test**, typecheck, ESLint, production build; ayrı PostgreSQL invariantları ve production tarayıcı testi. Gerçek çalışan/yöneticiyle offline çakışma, kalite fail/pass, beş operasyon, satın alma/onay/kısmi kabul/lot/ters kayıt, personel hesabı, çek tahsilatı, bildirim izolasyonu ve stok atlama reddi doğrulandı. **31 yetkili ekran/eski adres ve altı muhasebe görünümü**, sunucu 5xx/yakalanmamış tarayıcı hatası olmadan tarandı. Mobil viewport ayrıca incelendi.
- Sağlayıcı teslimatı, gerçek fabrika reçete/ölçü/kapasite doğrulaması ve çok kullanıcılı yük testi bu yerel doğrulamanın kapsamında değildir. API anahtarı Git dışında `.env.local`, izin 0600; kaynakta secret taraması temiz. Detaylar: `apps/web/docs/production-platform.md`.

## Kişisel görünümler ve sipariş güvenliği — 3 Ekim 2026, devam

- Kişisel sipariş görünümleri artık uygulandı. Arama/durum/aşama/çalışma görünümü/sıralama sunucuda kullanıcı ve firma kapsamında saklanır; kaydet, uygula, favori, güncelle, kaydedilene dön, yeniden adlandır, paylaşılabilir filtre URL'si ve sil işlemleri var. Sürüm, işlem UUID'si, payload hash, isim benzersizliği ve 50 kayıt sınırı korunur.
- Kritik JWT açığı kapatıldı: `trigger:update` artık istemcinin `session.user` kimliğini/firmasını/rolünü token'a kopyalamaz. İmzalı kimliğin güncel veritabanı üyeliği her oturum okumasında doğrulanır. Rol değişikliği görünür; üyelik kaldırılırsa oturum iptal olur. Çevrim içi odakta ve 60 saniyelik aralıkta yenileme var; çevrim dışı odak/poll yenilemesi yapılmaz.
- Eski sipariş server action'larında eksik create/edit/delete yetkileri eklendi. Usta sipariş/API/arama sonuçları atanmış üretim işleriyle sınırlı teknik allowlist kullanır. Fiyat, e-posta/telefon, mali özel alan ve ticari belgeler dönmez. Ticari CSV/sipariş PDF/aktivite içeriği ve eski durum değiştirme yolları korunur. Usta genel ticari WebSocket kanalına bağlanmaz; üretim ekranının yetkili SSE akışı kullanılır.
- Siparişler üretim/teklif/tahsilat/belge/stok/sevkiyat/takip veya durum geçmişine bağlıysa silinemez. Kontrol, firma kilidi ve silme atomik; DB işlemi başarısızken fiziksel dosya silinmez. GCS temizliği kalıcı kuyruk/lease/backoff ile worker'a bırakılır, 10 başarısız denemeden sonra inceleme için `failed` saklanır. Gerçek GCS yetkileri ayrıca gerekir. Toplu silme başarısız kayıtları seçili tutar ve iş kuralı nedenlerini HTTP yanıtından gösterir.
- Eski `/orders/:id/transition` ilk firma üyeliğini seçen/yetkisiz yol yerine mevcut oturum firmasını ve rolünü kullanır. İşlem anahtarı/sipariş sürümü ve atomik aktivite kaydı eklenir. Native üretim durumu elle atlanmaz; ilgili operasyon ekranına yönlendirilir. Aktivite API'si yalnız yetkili mevcut sipariş/müşteriye not ekler, istemciden onay/durum geçmişi veya değişiklik nesnesi kabul etmez. Yeni sipariş API kaydı sonraki liste okumasında hemen görünür; eski firma TTL önbelleği kaldırıldı.
- Migration: `019_workspace_views_cleanup.sql` — kişisel görünümler, tekrar komutları, dosya temizliği ve sipariş durum komutları. Yerel dev/test ortamına uygulandı, uzak canlı veritabanına yazılmadı. Worker akışları hata izolasyonu ile bağımsız sürer.
- Son birim doğrulaması **39 suite / 252 test**; typecheck, ESLint ve production build başarılı. Ayrı PostgreSQL'de kişisel görünüm izolasyonu/eşzamanlı sürüm/tekrar, bağlı kayıtları koruma, temizleme kuyruğu/retry ve tahsilat/silme yarışı, durum audit/tekrar/native atlama testleri geçti. Ayrıntılı production tarayıcı kontrolü ve son sonuçlar `apps/web/docs/production-platform.md` ve yerel `.data/browser-verification.log` içindedir.
- Gerçek sağlayıcı teslimatı, gerçek reçete/ölçü/kapasite doğrulaması ve çok kullanıcılı yük testi bu yerel kontrollerle tamamlanmış sayılmaz. Canlı deployment yapılmadı. Anahtar kaynaklara yazılmadı; `.env.local` Git dışında ve izin 0600.
- Nihai production tarayıcı kontrolü de geçti: karışık toplu silme ve iş kuralı mesajı, anlık liste tazeliği, çevrim dışı odak koruması ve üyelik iptali dahil bütün testin sonunda 5xx/yakalanmamış tarayıcı hatası yok. Yerel dev sunucusu 3000'de yeniden açıldı; `/api/health` healthy.

## Vercel transition — 2026-10-03

Deployment now targets Vercel project `renkflowv2`, with Root Directory `apps/web`. See `apps/web/docs/vercel-deployment.md`. Production and Preview use separate Marketplace PostgreSQL and private Blob stores. Old GCP deploy scripts/workflow and runtime Google Storage dependency removed. Backend schema adds 020 without discarding existing bytea files. Background work is split across authenticated, bounded Vercel Cron routes; no daemon is started by the web deploy. Never upload `.env*` or `.data` as a build context. Local private env files are ignored and 0600. Cloud env writes/provisioning are pending valid Vercel CLI authentication; the existing local token was invalid. Existing remote data and storage were not migrated by this transition.

### Vercel Hobby Preview follow-up — 2026-10-03

CLI authentication is now valid. The user chose Hobby testing. Preview is ready at https://renkflowv2-lsm1k0ti0-beshnovski-projects.vercel.app; protected Vercel access is retained. Separate Neon Free (`store_XcwfmhjJtgfld0Sp`) and private Frankfurt Blob (`store_c5qDokOXKdpa7IIG`) are connected to Preview only. Core/additive migrations were run on the new Preview DB, Preview environment values were synced, obsolete Preview provider keys were removed, and a Preview-only owner was created. Production environment values/resources are untouched.

Default Vercel config has no cron schedule for Hobby; minute schedules are retained in `apps/web/vercel.pro.json` for a future Pro production release. Deploy from repository root using `npx vercel@62.2.0 deploy --local-config apps/web/vercel.json`, not from `apps/web` (Root Directory is already `apps/web`). 47 suites / 291 tests, typecheck, lint and cloud build passed. Real cloud sign-in, mobile pages, 6 MB private upload/order attachment/download and anonymous rejection passed. Credentials stay ignored in `apps/web/.data/preview-test-account.json`. No Git commit/push was made as part of this preview deployment.

## Fabrika QR/barkod ve raf operasyonları — 3 Ekim 2026

- Yeni Hobby Preview dağıtımı READY: https://renkflowv2-l6pw9ouvz-beshnovski-projects.vercel.app. Vercel erişim koruması açık; Production ortamına geçilmedi, plan yükseltilmedi. Migration 021 mevcut kayıtları silmeden yerel dev/test ve ayrı Preview Neon veritabanına uygulandı. Yerel geliştirme veritabanı ve env ayrı kalıyor.
- `/warehouse`, `/warehouse/scan`, `/warehouse/labels`: raf yönetimi, telefon kamerası/USB/Bluetooth okuyucu, tek kalıcı kimliği taşıyan QR + Code 128, A4/termal toplu etiketler, malzeme/lot/artık/iş emri/kesim paketi/mamul sorgulama. GS1 ve Zebra resmi fabrika izlenebilirlik kaynakları incelendi. Etiketler dahili kimliktir; GS1-128/GTIN/SSCC sertifikası iddiası yok.
- Raf transferi miktar/sürüm/kaynak/hedef doğrular; lot yalnız kalan tam boyuyla, rezervasyonsuz taşınır. Üretim/mamul/karantina sınırları ilgili belge akışını gerektirir. Sayım önce incelemeye gider; yönetici onayı ve eski sürüm kontrolüyle stok defterine yazılır. Fiziksel lot ve mamul tutarsızlıkları genel toplam düzeltmesiyle silinemez. Raf hareketleri değişmez audit, işlem UUID/payload hash ve firma kilidi taşır. Çevrim dışı depo yazımı engellenir.
- PostgreSQL tetikleyicisi eski mal kabul/kesim/tüketim/rework/sevkiyat defterini raf bakiyelerine bağlar; eski bakiyeler yalnız ilk migration'da yerleştirme bekleyen konuma alınır. Usta yalnız teknik/atanmış üretim kayıtlarını görür; özel mali ve sayım bilgileri korunur. Eski basılı QR/UUID kimlikleri uyumlu ve firma kapsamında çözümlenir.
- Arayüz: lacivert operasyon menüsü, yenilenen dashboard hızlı işlemleri, depo kartları, tarama adımları, stok kapsamı açıklamaları ve mobil düzen. Kameranın kaynakları kapanışta temizlenir; yazdırma yalnız görseller hazırken açılır. Baskı isteği audit'i fiziksel yazıcı teslimatı sayılmaz.
- Doğrulama: **50 suite / 300 test**, typecheck, lint ve yerel/bulut production build başarılı. Ayrı gerçek PostgreSQL'de tekrar/eşzamanlılık/malzeme dengesi/sayım/rol/firma/rezervasyon testleri ve mevcut üretim regresyonu geçti. Tarayıcıda gerçek raf/transfer/sayım/yönetici onayı, 390 px mobil, izin verilmeyen kamera ve çevrim dışı yazım koruması doğrulandı. QR ve Code 128 203 DPI baskı PDF'sinden aynı kimliğe çözüldü; termal 100×70/80×50 mm, tek/iki sayfa ve A4 iki etiket sayfa sayıları doğrulandı. Mevcut 31 ekran ve usta çevrim dışı üretim akışı da geçti. Ayrıntılar: `apps/web/docs/warehouse-barcodes.md`.
- Son Preview'da readiness `ready`, gerçek yönetici girişi ve `/api/v1/warehouse` başarılı. Depo/tarama/etiket/stok/dashboard ekranları 390 px mobilde ve depo ekranı masaüstünde kontrol edildi; yatay taşma, 5xx veya yakalanmamış tarayıcı hatası yok. Oturumsuz depo API erişimi 401. Buluta yapay stok veya test transferi eklenmedi.
- Gerçek fabrika yazıcısı/okuyucusu, etiket yapışkanı ve yüzeyiyle pilot kalibrasyon hâlâ fiziksel cihaz gerektirir. Kalıcı etiket basılmadan önce sabit üretim alan adı belirlenmeli. Git commit/push yapılmadı; önceki yerel değişiklikler korundu. Test hesapları ve bypass cookie'leri yalnız ignored `.data` içinde; anahtarlar kaynaklara yazılmadı.

## Dosya açılışı, proaktif asistan ve özel alan adı — 4 Ekim 2026

- Kullanıcı landing page ve diğer UI tasarımlarını bu işten çıkardı; bunları başka modele yaptıracak. Landing sayfaları değiştirilmedi. Bu turda başlatılan loading/error/toast tasarımları geri alındı. Mevcut tasarımda yalnız yeni asistan işlevlerini açan kontroller eklendi.
- PDF %0 takılması çözüldü: renderer artık yükleme sırasında monte ediliyor, iptal/timeout/retry bağlı. React-pdf 4.8.69 ile eski public worker 5.4.394 uyumsuzdu; `prebuild`/`predev` PDF worker'ı react-pdf'in gerçek bağımlılığından kopyalıyor. File/options nesneleri sabit. HTTP Permissions-Policy kamera için `self` olarak düzeltildi.
- AI artık sunucudan gerçek firma/rol/sayfa bağlamı alıyor. Sipariş, üretim, stok, tedarik ve yetkili mali özetler ayrı para birimleriyle sunuluyor. Atanmış usta işleri teknik kapsamda. Veri boşluğu yetki hatası gibi açıklanmıyor. Responses `search_workspace` aracı ilk 40 kaydın dışındaki isim/kodları arıyor; SDK'nın `parsed_arguments` alanı API'ye geri gönderilmiyor. Stateles tool döngüsü encrypted reasoning taşıyor.
- Soru beklemeden operasyon uyarıları ve model özeti: görünür/online ekranda 90 saniyelik veri yenileme; otomatik model özeti kullanıcı/rol kapsamında tarayıcı oturumunda en fazla üç dakikada bir. Model kapalıyken gerçek operasyon kontrolleri çalışır. Not/taslak aksiyonları mevcut onay diyaloğuyla uygulanır; UUID/hash ve tenant transaction kilidi tekrar yazmayı önler. Taslak üretim reçetesi veya kesin sipariş yerine geçmez, inceleme/onay ekranına girer. Migration 022 Preview ve yerel test DB'de uygulandı; yerel geliştirme dev DB'ye sonraki `db:ensure-backend` ile uygulanabilir.
- READY dağıtımı: `renkflowv2-9ysmwyuhs-beshnovski-projects.vercel.app`. `renkflow.com` ve `www.renkflow.com` bu **Hobby Preview pilotuna manuel alias** edildi; ücretli plan/Production environment migration yapılmadı. Alan adı Vercel girişine takılmıyor; deployment URL'leri Vercel Authentication altında kalıyor. Sonraki Preview deploy kendi kendine custom alias'ları güncellemez; aynı kontrol/alias adımları tekrarlanmalı.
- `panel.renkflow.com` alias denemesi sertifika üretiminde Vercel API hatasıyla tamamlanmadı; panel hostname'i için başarılı SSL doğrulaması iddia edilmemeli. Kullanıcının istediği ana alan adı ve www alias'ı başarılı; gerçek test renkflow.com üzerinde yapıldı.
- Preview'da `PRIVATE_ACCESS_EMAIL` tek demo hesabına sınırlar; credentials/ticket/OAuth ve canlı session refresh bunu doğrular. Yeni kayıt kapalı, oturumsuz API/belge/takip erişimi engelli. Şifre kısaltıldı; kaynaklarda veya giriş ekranında yayımlanmadı. Güncel hesap bilgisi ignored 0600 `.data/preview-test-account.json` içinde. Bu kısıtlama normal çok kullanıcılı dağıtımlarda env kaldırılarak kapanır.
- Doğrulama: **55 suite / 309 test**, typecheck, lint ve Vercel build başarılı. Gerçek PostgreSQL tarayıcı testi taslak inceleme/onayı, tek not kaydı/replay/değişen payload reddi, masaüstü/mobil gerçek PDF canvas, gerçek GPT-6 Luna yanıtı ve oturumsuz red testlerini geçti. Ayrı gerçek model tool arama döngüsü de geçti. Bulutta renkflow.com gerçek kısa demo girişi, otomatik öneriler, gerçek model yanıtı ve eski private Blob PDF'nin mobilde görünür açılışı doğrulandı. Register 403, belge/AI/depo anonim erişimi 401; yakalanmamış tarayıcı hatası yok. Açıklama: `apps/web/docs/assistant-and-private-pilot.md`.
- Git commit/push yapılmadı; önceki yerel değişiklikler korundu. AI tüm üretim/stok/mali kuralları atlayan sınırsız SQL ajanına dönüştürülmedi; owner kapsamındaki yardımlar artırıldı, kritik kayıt değişiklikleri doğrulanmış mevcut akışlardan yürür.

## 4 Ekim 2026 — beş üretim çekirdeği yeteneği

- Kullanıcının eklediği `Yapıştırılan metin.txt` içindeki beşli plan mevcut servisler/tablolarda uygulandı. Landing/UI yeniden tasarımına girilmedi; mevcut ekranlara gerekli işlevsel kontroller eklendi. Doküman: `apps/web/docs/manufacturing-core.md`.
- Belge extraction: GPT-6 Luna Responses strict schema; alan kanıtı/güven/sayfa/metin, çok kalem, birim/custom parametreler; özgün extraction korunur, insan incelemesi ayrı saklanır. AI hatasında belge elle incelenebilir. Onay alan kontrolü, sürüm, firma ve canonical JSON işlem tekrarı taşır.
- Reçete: güvenli parser, parametre tür/sınır/default, opsiyon koşulları, koşullu malzeme/rota, setup ve kalite; iki örnek doğrulanmadan yayın yok. Yayınlanmış tanım DB trigger ile değişmez. İş emri girdi/BOM/rota/kalite/reçete sürümünü sabitler; 3D'siz doğrulanmış ölçü de desteklenir.
- Sonlu kapasite: merkez/makine/ekip/çalışan takvimleri ve bakımlar, yetkinlik/ekip üyeliği, malzeme tarihi, kalan süre, setup, öncelik/termin/dependency. Çalışanlar merkezler arasında çift planlanmaz. Yönetici öneri/yayın; canlı kaynak/operasyon/termin parmak izi değişmişse yayın reddedilir. Algoritma deterministik geçerli öneri üretir; global optimum iddiası yok.
- WIP/ETA: iş başına tek mevcut aşama; olaylardan gerçek çalışma/bekleme/çevrim/throughput/rework; en az beş tamamlanmış denemeyle 30 günlük baseline. Yük/anormal kuyruk darboğazı, gerekçe/aksiyon/etkilenen sipariş. ETA deterministik kapasiteden; eksik kalem veya engelde tarih uydurulmaz. AI yalnız açıklar.
- Kalite: değişmez kontrol kanıtı ve sipariş/iş/deneme/reçete/çalışan/makine/ekip/lot/kesim bağlamı. Yeni sarf girişleri lotludur; FIFO tüketim/raf defteri atomik, rezerve lot tüketilmez, eski toplu stok kaynak raf miktarıyla açıkça izsizdir. Sarf kısmi transferi kaynak partiyle alt lot oluşturur; profiller kesimden parçalanır. Rework kategori/kök neden/ek malzeme/hurda/işçilik/çözüm; rota bitmeden kapanış yok, usta kapanışı offline kuyrukta sunucu kabulünü bekler. COPQ para birimleri ayrı, eksikler bilinmiyor; vaka açılışındaki işçilik oranı korunur. Lot/reçete korelasyonu otomatik kök neden sayılmaz.
- Migration 023–027 additive olarak ayrı `renkflow_test` üzerinde doğrulandı, tekrarında stok/kalite kanıtı korundu; sonra yerel `renkflow_dev` ve mevcut **Preview** Neon'a uygulandı. Production DB kullanılmadı. Gerçek reçete/tolerans/kapasite pilot işletmece girilip doğrulanmalıdır.
- Her ana faz typecheck/lint/unit/integration/build kapısından geçti. Son durum **60 suite / 326 test**; PostgreSQL üretim+depo, 31 yetkili ekran/eski adres, reçete/yayın/kaynak/plan UI, kalite-rework offline kapanışı, QR+Code128 baskı decode, masaüstü/mobil PDF, gerçek GPT-6 Luna extraction/asistan geçti. Asistan otomatik kartının satın alma düğmesini kapatması yakalanıp kartın sayfa akışına alınmasıyla düzeltildi. Son browser audit 5xx veya yakalanmamış hata göstermedi.
- Yeni Preview **READY**: `https://renkflowv2-ou85qkjjy-beshnovski-projects.vercel.app`; id `dpl_7fumKxaaErWCUHigYTwsdVd4WTe5`. `renkflow.com` + `www.renkflow.com` buna manuel alias edildi. Hobby özel pilot; Production ortamı/Pro/cron değişmedi. Bulutta demo oturumu, readiness, kaynak/WIP/ETA/kalite ekran/API, otomatik öneri, gerçek model, mevcut özel PDF doğrulandı. Kayıt 403, anonim AI/depo/belge 401. Sonraki deploy'da alias'ları yeniden doğrulayarak güncelleyin.
- Özel hesap/env bilgileri yalnız ignored 0600 `.env*.local` ve `.data/preview-test-account.json` içinde. Git commit/push yapılmadı; önceden kalan çalışma korundu. Tüm sonuçlar ignored `apps/web/.data/phase1-*` … `phase5-*` raporlarında.
