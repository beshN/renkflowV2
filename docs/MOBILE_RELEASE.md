# RenkFlow Saha: yerel test ve yayın hazırlığı

Kod: Android Kotlin/Compose (Android 8+), iOS SwiftUI/SwiftData (iOS 17+). Sözleşme `contracts/mobile/openapi.json`; sürüm **1.2.0**, temel build **3**, minimum mobil sürüm **1.2.0**. Uygulama başlıkları aynı kaynaktan üretilir. Room şema dosyası repoda tutulur. iOS projesi deterministik Python üreticisinden gelir.

## Şu anki dağıtım durumu

Production'a dağıtım, migration veya Vercel ortam değişikliği yapılmadı. Sürüm main'e alınmadan mevcut renkflow.com adresi yeni API'yi sunmaz. Test için mobil entegrasyonun aynı commit'iyle çalışan HTTPS test sunucusu gerekir. Kullanıcı girişi bir tenant'a ve saha yetkisine bağlıdır; demo veriler gerçek müşteri hesabı değildir.

GitHub yeni işlerin başlamasını şu nedenle reddetti: **“recent account payments have failed or your spending limit needs to be increased”**. Billing & plans ayarı hesap sahibince çözülmeden son iOS/CI sonucu ve otomatik merge tamamlanamaz. Hesap ayarı değiştirilmedi.

## Yerel Android

1. Android Studio, JDK 21, Android SDK 35 kurun. `apps/native-android` projesini açın.
2. `python3 scripts/generate-mobile-contract.py` çalıştırın; Android'de `./gradlew :app:assembleDebug :app:lintDebug` çalıştırın.
3. `app/build/outputs/apk/debug/app-debug.apk` dosyasını telefona kurun veya `adb install -r app/build/outputs/apk/debug/app-debug.apk` çalıştırın.
4. API testi için `apps/web` içinde npm bağımlılıklarını kurup `bash ../../scripts/mobile/prepare-http-fixture.sh` çalıştırın. Yalnız loopback renkflow_test DB kullanır. Sonra Android `./gradlew :app:testDebugUnitTest :app:connectedDebugAndroidTest` çalıştırın. Test altyapısı geçici loopback HTTPS sertifikasını sadece test target'ında kabul eder; gerçek uygulama sertifika denetimini kapatmaz.
5. Uygulamada geçerli sertifikalı HTTPS test sunucunuzu ve saha hesabınızı girin. Bilgisayarın `localhost` adresi fiziksel telefondan bilgisayarı göstermez; test sunucusunu erişilebilir HTTPS adresiyle kullanın.

## iOS simülatör (Mac bulunan kişi için)

Xcode 16+ ve iOS simülatörü gerekir. Repo kökünde `python3 scripts/generate-native-ios-project.py` çalıştırın; `apps/native-ios/RenkflowField.xcodeproj` dosyasını açın. RenkflowField scheme ve iPhone/iPad simülatörü seçerek Run yapın. CLI derleme:

```bash
cd apps/native-ios
xcodebuild build -project RenkflowField.xcodeproj -scheme RenkflowField \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO
```

Birim/UI testler gerçek yerel web fixture sunucusuna bağlanır. Önce web fixture hazırlığını çalıştırın, bir simülatör seçip:

```bash
xcodebuild test -project RenkflowField.xcodeproj -scheme RenkflowField \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- \
  CODE_SIGN_ENTITLEMENTS="$PWD/RenkflowField/Simulator.entitlements"
```

Simülatörün adı bilgisayarınızda farklıysa `xcrun simctl list devices available` ile bulunan adı kullanın. Simulator.entitlements yalnız CI/test için ad-hoc kimliktir; gerçek cihaz/mağaza imzasında kullanılmaz. Son Keychain test imzası düzeltmesi CI ödeme engeli yüzünden henüz doğrulanmadı.

## Mac olmadan iOS

GitHub Actions **Native Field Apps** macOS runner'da simülatör derlemesi ve testleri çalıştırır. TestFlight için ayrıca ücretli Apple Developer Program üyeliği gerekir. Apple hesabı, dağıtım sertifikası ve App Store profile olmadan iPhone'a kurulabilir TestFlight paketi üretilemez. IPA oluşturulmuş olması TestFlight'a yüklenmiş olduğu anlamına gelmez.

## Yayın numarası ve Android imzası

`info.version` ve `x-build-number` OpenAPI'dedir. Android Gradle aynı dosyayı okur; iOS üreticisi aynı değerleri projeye yazar. Yayın workflow'u `100000 + GitHub run_number` build numarası kullanır. Daha önce mağazada daha yüksek bir build varsa bu tabanı yükseltin; bir build numarası tekrar kullanılmaz.

Yalnız **Mobile Release Packages** elle çalıştırılır. Seçilen commit'te Native Field Apps başarılı değilse imza adımı açılmaz. Üretim sunucusuna ve mağazalara otomatik yükleme yapmaz.

GitHub repository secrets:

| Android secret | İçerik |
|---|---|
| ANDROID_KEYSTORE_BASE64 | Play upload keystore dosyasının base64 değeri |
| ANDROID_KEYSTORE_PASSWORD | Keystore şifresi |
| ANDROID_KEY_ALIAS | Upload key alias |
| ANDROID_KEY_PASSWORD | Anahtar şifresi |

Bu değerler sağlanmadı; imzalı AAB **doğrulanmadı**. Yerelde `ANDROID_KEYSTORE_PATH` ve diğer üç değişkeni ayarlayıp `./gradlew :app:bundleRelease` kullanılabilir. Anahtarsız release çıktısı varsa imzasızdır, Play'e yüklenebilir diye sunulmaz. Keystore/şifre/provisioning dosyalarını repoya veya loga koymayın.

Play Console'da `com.renkflow.field` uygulamasını oluşturun; Internal testing kanalına imzalı AAB yükleyin, test kullanıcı listesini ekleyip opt-in bağlantısını paylaşın. İç test de Play geliştirici hesabı gerektirir.

## iOS imza ve TestFlight

Apple Developer ve App Store Connect'te `com.renkflow.field` App ID / uygulama kaydını oluşturun. Apple Distribution sertifikasını private key içeren `.p12` olarak ve App Store provisioning profile'ını hazırlayın.

| iOS secret | İçerik |
|---|---|
| IOS_CERTIFICATE_BASE64 | Distribution p12 base64 |
| IOS_CERTIFICATE_PASSWORD | p12 şifresi |
| IOS_PROFILE_BASE64 | App Store mobileprovision base64 |
| IOS_TEAM_ID | Apple Team ID |

Workflow geçici keychain'e imza malzemesini yükler, archive/export yapar, IPA artifact'ı üretir ve imza dosyalarını temizler. Anahtar/profil olmadığı için archive/export **doğrulanmadı**. Simulator test entitlement'ı release archive'a verilmez.

TestFlight'a yükleme sonraki açık yayın işlemi olacaktır. Mac kullanan kişi Transporter ile IPA yükleyebilir. Mac olmadan bir macOS CI işinde App Store Connect API key (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_BASE64`) ile Transporter kullanılabilir; bu anahtarlar şu an sağlanmadı ve yükleme workflow'u etkin değil. App Store Connect işleme tamamlanınca TestFlight bölümünde export compliance bilgilerini doldurun; önce internal tester ekleyin. External test Apple beta review gerektirebilir. iPhone'da TestFlight uygulamasından daveti açın.

## Sunucu migration'ları

Mobil migration 001–004 yalnız test DB'ye uygulandı. Canlıya geçiş, şema incelemesi/yedekleme ve ayrı migration işlemi gerektirir; bu çalışmada yapılmadı. 004 mevcut night-2 `user_sessions` yapısıyla uyumludur. Şema yoksa API 503 verir, uzak DDL otomatik çalıştırmaz. Dağıtımda kalıcı dosya depolaması mevcut web sağlayıcısı üzerinden ayarlanmalıdır; local storage yalnız test içindir.

## Bağlanmamış sağlayıcılar ve sınırlar

FCM/APNs ve analitik/hata sağlayıcıları **bağlanmadı**. Push cihaz kaydı ve gönderici soyutlaması var; uzaktan bildirim teslimi yok. Yerel bildirim test düğmesi OS izinlerini kullanır. Analitik/hata sınırı yalnız adsız enum olayları kabul eder; kullanıcı/tenant/job kimliği, not, fotoğraf, adres veya jeton kabul etmez.

Montaj adres/harita/müşteri onay bağlantısı mevcut çalışan yetki sınırı nedeniyle kapalıdır. Çevrimdışı start/pause olayları sunucunun mevcut süre kurallarına göre teslim zamanında uygulanır; gerçek çevrimdışı çalışma süresinin bordro/performans kaydı olarak doğruluğu garanti edilmez. Fiziksel saha bağlantısı ve OS arka plan zamanlaması doğrulanmadı.
