# Firma oyun ve sürpriz ayarı: ilk dilim

`tenants.fun_features_enabled` tek boolean ayardır. Varsayılan `true`: mevcut firmalarda ve yeni firmalarda bugünkü davranış korunur. 082 migration additive/idempotent; standart `ensure-backend-schema` listesinde kayıtlıdır. Bu çalışma kapsamında yalnız geçici yerel `renkflow_test` üzerinde uygulanmıştır. Production migration veya dağıtım yapılmadı.

## İncelenen altyapı

Firma kimliği/marka ayarları `tenants` tablosunda, `components/settings/TenantSettings.tsx` ve `app/api/tenant/update/route.ts` üzerinden yönetiliyor. `app/(dashboard)/settings/page.tsx` firma sekmesinde bu bileşeni gösteriyor; sayfa owner/admin dışındakilere düzenleme sunmuyor. `lib/features/auth/context/SettingsContext.tsx` içindeki localStorage ayarları firma çapında yetkili kaynak olmadığı için kullanılmadı. Yeni anahtar aynı firma bölümünde, mevcut MFA ayarındaki checkbox/switch düzenini kullanıyor.

`GET/POST /api/tenant/fun-features` tenant'ı yalnız doğrulanmış oturumdan alır. POST strict boolean gövdesi dışında alan kabul etmez; istemci tenant seçemez. Servis her okumada aktif üyelik arar; yazma işlemi canlı üyeliği kilitleyerek owner/admin kontrolünü, firma güncellemesini ve mevcut activity audit kaydını aynı transaction'da yapar. Worker/office ve artık aktif olmayan yönetici yazamaz. GET `private, no-store` döner. Sürüm notlarına dokunulmadı.

## Kodda bulunan envanter

Aşağıdaki yollar `apps/web/` altındadır. Arama `spells` klasörü, import/kullanım yerleri, oyun/easter-egg/Konami/sürpriz/celebrate/paintStroke anahtarları ve ofis sahnesi/simülasyonunu kapsadı; bunun dışında keşfedilmemiş bir özelliğin varlığı iddia edilmiyor.

| Özellik | Dosya ve tetikleme |
| --- | --- |
| RenkFlow Ralli | `components/features/office/OfficeWorkspace.tsx`, `RallyGame.tsx`; `/office` 3D oyun ekranına tıklama. `lib/features/office/scene.ts` oyun köşesini çizer; `simulation.ts` personeli konsolda oynamaya gönderebilir. Rekor sonrası `lib/features/office/cheer.ts` üzerinden personel tepkisi gelir. Kapalıyken oyun köşesi oluşturulmaz, oyun molası seçilmez, devam eden oyun molası sonlandırılır, tıklama/tebrik/kahve/personel esprisi tetiklenmez. İş görevleri ve insan onayı akışı korunur. |
| Konami “usta modu” | `components/spells/KonamiCode.tsx`; dashboard layout içinde ↑ ↑ ↓ ↓ ← → ← → B A; metin alanlarında çalışmaz. Toast ve `celebrate.ts` parçacıkları. Kapamada listener ve bekleyen zamanlayıcılar kaldırılır. |
| 404 kesim oyunu | `app/not-found.tsx` → `components/spells/CutGame.tsx`; Başlat/Kes düğmesi veya Space. |
| Hata ekranı boru bulmacası | `app/error.tsx`, `app/(dashboard)/error.tsx` → `components/spells/WhileYouWait.tsx` → `PipePuzzle.tsx`; “Beklerken: hattı birleştirin”, ardından hücreleri çevirme. |
| Forklift/palet istifleme | `components/shared/views/RFListView.tsx` boş liste → `components/spells/ForkliftEmpty.tsx` → `PalletGame.tsx`; forklift düğmesine tıklama, palet bırakma. |
| Fire avı | `components/features/manufacturing/ProductionWorkspace.tsx` → `components/spells/ScrapHuntButton.tsx` → `ScrapHunt.tsx`; kesim listesindeki Fire avı düğmesi; planın kopyası üzerinde oynanır. |
| Logo boya izi | `components/spells/BrushLogo.tsx`, `paint-stroke.ts`; sidebar/header logosuna 3 saniyede 7 hızlı tıklama (aradaki boşluk en çok 700 ms). Kapalıyken normal logo bağlantısı kalır. |
| Gece çayı | `components/spells/TeaBreak.tsx`; İstanbul saati 00:00–05:00 header'da görünür; tıklama çay toast'ı açar. |
| Koparılan takvim | `components/spells/TearCalendar.tsx`; dashboard takvimine tıklama, yaprak animasyonu. |
| Özel gün rozeti | `components/spells/OccasionBadge.tsx`; dashboard'da İstanbul tarihine göre ulusal/özel gün rozeti. |
| Sipariş kilometre taşı | `components/spells/OrderMilestone.tsx`, `lib/spells/milestones.ts`; dashboard sipariş adedi 10/100/1000/10000 sınırlarına ulaşınca tarayıcı/firma bazında hatırlanan kutlama ve paylaşım kartı. |
| Sipariş oluşturma kutlaması | `app/(dashboard)/new-order/page.tsx` → `components/spells/celebrate.ts`; başarılı kayıt sonrası parçacıklar. |

`CopyChip.tsx` (kopyalama ve başarı geri bildirimi) ve `Magnifier.tsx` (giriş ekranı teknik çizim büyüteci) de aynı klasörde bulundu; işlevsel yardımcı araçlar olarak korundu. Landing'deki ürün demosu ve AI ofisi tanıtımı değiştirilmedi. Yeni oyun, tasarım veya AI davranışı eklenmedi.

## Yayılım ve test kapsamı

İstemcide mevcut SWR ile kullanıcı/firma kimliğine göre ayrılan, sunucuya kimlik göndermeyen cache kullanılır. AuthProvider dışındaki public hata/404 bileşenleri mount başına ayrı anahtar kullanır; önceki oturumun public cache sonucu yeni ekrana taşınmaz. İlk okuma, okuma hatası veya oturum yüklenirken özellikler kapalıdır. Aynı sayfadaki anahtar güncellemesi cache'i hemen değiştirir; diğer açık sekmeler/oturumlar odaklanınca veya görünür/çevrimiçi durumda 15 saniyelik sorguda güncellenir. Bu gerçek zamanlı anlık iptal sistemi değildir. Aktif oyun ayar güncellemesi alındığında unmount olur. Oturumsuz ziyaretçi için firma ayarı yoktur; public hata/404 oyunları başarılı anonim okumada eski davranışını korur. Mevcut private-pilot güvenlik kapısı API okumasını reddederse sürprizler kapalı kalır.

`test-fun-features.ts` dosyası mevcut `run-integration-tests.ts` tarafından otomatik keşfedilir; `.github/workflows/validate.yml` içindeki `test:integration` adımında çalışır. Ortak CI/package/runner dosyaları değiştirilmedi. #133–#147 dosya listeleriyle kesişen dosya yoktur.

Birim testleri kapalı/yükleniyor halinde oyun girişlerinin render edilmemesini, Konami ve logo tıklamalarının etkisizliğini, tenant değişiminde cache ayrımını, okuma hatasında kapanmayı, ofis tıklama ve simülasyon oyun molası engelini, ayar anahtarını ve API gövde sınırını kapsar. Gerçek PostgreSQL testi migration'ı iki kez uygular, varsayılanı ve iki firma izolasyonunu, owner/admin kabulünü, office/worker reddini, sonradan rol düşürme/pasifleştirmeyi ve transaction audit kayıtlarını sınar. Gerçek tarayıcı/çok kullanıcılı fabrika pilotu yerine geçmez.
