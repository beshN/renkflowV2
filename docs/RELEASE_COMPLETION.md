# RenkFlow 1.2.1 yayın adayı

Bu belge yapılan işleri ve yayın için gerçek dış bağımlılıkları ayırır. Yayın adayı, production'a veya mobil dağıtım kanallarına taşınmış sayılmaz.

## Tamamlanan kod işleri

- Asistan snapshot, arama ve işlem uçları güncel özel rol matrisini kullanır. Yasak modül sorgulanmaz; gizli alanlar model girdisinden çıkarılır. Kullanıcı rolü işlem sırasında değişirse yeni temel rol esas alınır.
- Eksik AI şeması/ayar kaydı gerçek onay yerine geçmez. Model kapısı güncel modu yeniden okur; kullanım kaydı yoksa veya tanımlı bütçenin maliyeti hesaplanamıyorsa sağlayıcı çağrısı başlamaz.
- Web ve mobil montaj değişiklikleri ortak denetim kaydı kullanır. Mobil tamamlamada teslim önerisi hemen dosyalanır; post-commit başarısızlıkta mevcut kuyruk yenilemesi tekrar dener. Öneri onayı özel rolün sipariş düzenleme yetkisine bağlıdır.
- Geçmiş ekstre seçicisi yalnız iptal edilmiş faturası olan müşterileri de içerir. Liste alınamazsa boş müşteri listesi gibi gösterilmez. Finans join'leri iki tarafın tenant'ını eşleştirir.
- Mobil sürüm 1.2.1 / build 4; minimum desteklenen sürüm 1.2.0. Üretilen Android/iOS sözleşme sabitleri ve iOS proje dosyası güncellendi.
- Test veritabanı portu yalnız loopback için değiştirilebilir. Fixture cleanup yabancı süreçleri kapatmaz. Mobil paketleme self-hosted Mac kullanır ve yalnız doğrulanmış main commit'inde çalışır.
- pg_dump çıktısı diske yazılmadan AES-256-GCM ile şifrelenir. Migration öncesinde şifreli yedeğin etiketi ve PostgreSQL arşiv imzası doğrulanır. Şema işlemi ayrı, kilitli ve checksum kayıtlıdır; build'de çalışmaz.
- Uyumlu dependency patch'leriyle proxy-addr, source-map-js ve eski brace-expansion açıkları kapatıldı. Production bağımlılık taraması: sıfır açık. Geliştirme bağımlılıklarındaki çözümsüz braces zinciri ayrı izlenmelidir; major Tailwind değişikliği zorlanmadı.
- #66'nın ilk boyama, 404 ve arayüz iyileştirmeleri yayın adayına dahildir.

## Doğrulama kanıtı

12 Ekim 2026, Node 22 üzerinde:

| Kontrol | Sonuç |
| --- | --- |
| Jest | 125 paket, 850 test başarılı |
| TypeScript / ESLint / backend guard / tenant guard / env audit | Başarılı |
| Production build | Başarılı |
| İzole PostgreSQL | Kayıt, satış, üretim, stok, yetki, CRM–montaj, filo, finans ve AI entegrasyonları başarılı |
| Mobil API | Giriş, atama sınırı, tekrar gönderim, sürüm çakışması, parçalı fotoğraf ve cihaz oturumu testleri başarılı |
| iOS | 20 birim/API + 1 UI testi başarılı |
| Android | Debug derleme + lint + 12 birim/API + 11 cihaz testi başarılı |
| Migration | 040–048 ve mobil 001–004 yeniden uygulama başarılı |
| Şifreli yedek | Yerel test DB yedeği doğrulandı; değiştirilmiş dosya reddedildi |

Fiziksel cihaz, production veritabanı, gerçek model cevabı, gerçek FCM/APNs teslimi ve imzalı mağaza yüklemesi bu sonuçlarla doğrulanmış sayılmaz. Simulator/test HTTPS istisnası yalnız test target'ındadır.

## Main ve web yayını için kapı

1. GitHub Actions secret `PRODUCTION_DATABASE_URL_UNPOOLED` doğru production bağlantısıyla sağlanır. Secret değeri loga veya sohbet mesajına yazılmaz.
2. `PRODUCTION_DATABASE_BACKUP_KEY` yapılandırılmıştır. İstemci, bu Mac'te özel tool dizinindeki pg_dump 18.6'dır; anahtar özel yerel dizinde ve GitHub Actions secret'ında korunur.
3. Yayın adayında `Validate Web App` elle çalıştırılır: `release_database=true`, önce `apply_database_migrations=false` ile audit. Eksik şema varsa doğrulanmış yedek ardından apply seçilir. Kod ve migration checksum'ı değişirse yeniden doğrulanır.
4. GitHub web/native kontrolleri ve Vercel preview aynı commit için başarılı olmalıdır.
5. Ardından main'e birleştirilir; production Vercel deployment SHA'sı main ile eşleştirilir, web ve mobil API smoke kontrolleri yapılır.
6. Kritik dağıtım hatasında önceki doğrulanmış web deployment'ına dönülür. Veritabanı tabloları otomatik silinmez.

## Sağlayıcı ve şirket içi mobil dağıtım için eksikler

| İş | Gereken dış erişim | Mevcut durum |
| --- | --- | --- |
| Rollbar hata takibi | Marketplace sözleşmesi ve gerçek kaynak/jetonlar | Hesap sahibinin sözleşme adımı bekleniyor; entegrasyon kurulmadı |
| Statsig kullanım ölçümleri | Marketplace sözleşmesi ve gerçek kaynak/anahtarlar | Hesap sahibinin sözleşme adımı bekleniyor; entegrasyon kurulmadı |
| Android FCM | Şirket Firebase projesi, native uygulama ayarları ve gönderim erişimi | Gerçek adaptör/SDK bağlantısı ve teslim testi bekliyor |
| iOS APNs | Apple App ID push yetkisi ve sağlayıcı imzası | Gerçek adaptör/SDK bağlantısı ve teslim testi bekliyor |
| Android kapalı test | Upload keystore, Play Console erişimi ve ekip grubu | İmzalama/yükleme ve ekip dağıtımı bekliyor |
| iOS TestFlight | Distribution p12, profile, Team ID, App Store Connect yükleme erişimi ve ekip grubu | İmzalama/yükleme ve ekip dağıtımı bekliyor |

Push ve telemetri için mevcut disconnected durumları başarı olarak sunulmaz. Sağlayıcı kaynakları kurulduktan sonra gerçek SDK/adaptör bağlantıları tamamlanacak ve testler tekrarlanacaktır. Mağaza yükleme/davet işleri de bu yayın adayında tamamlanmış değildir.

## Sıradaki işler

Canlı bağlantı geldikten sonra production şema denetimi ve gerekirse yedekli migration; sağlayıcı sözleşmeleri tamamlandıktan sonra Rollbar/Statsig kurulumu; mobil hesap erişimleri sağlandıktan sonra FCM/APNs, imza ve özel ekip dağıtımı. Yeni ücretli abonelik açılmadı. Herkese açık mobil mağaza yayını kapsam dışıdır.
