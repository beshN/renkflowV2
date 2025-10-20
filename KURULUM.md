# RenkFlow Mobil Uygulama - Hızlı Kurulum

## Tek Komutla Kurulum

\`\`\`bash
npm run mobile:setup
\`\`\`

Bu komut otomatik olarak:
- Tüm bağımlılıkları yükler
- Web uygulamasını build eder
- İstediğiniz platformu (iOS/Android) ekler
- Gerekli konfigürasyonları yapar

## Manuel Kurulum

### 1. Bağımlılıkları Yükle
\`\`\`bash
npm install
\`\`\`

### 2. Web Uygulamasını Build Et
\`\`\`bash
npm run build
\`\`\`

### 3. Platform Ekle

**iOS için (sadece macOS):**
\`\`\`bash
npx cap add ios
npx cap sync ios
npm run cap:open:ios
\`\`\`

**Android için:**
\`\`\`bash
npx cap add android
npx cap sync android
npm run cap:open:android
\`\`\`

## Güncelleme Yaparken

Kod değişikliklerinden sonra:
\`\`\`bash
npm run mobile:update
\`\`\`

## Gerekli Yazılımlar

### iOS için:
- macOS bilgisayar
- Xcode (App Store'dan ücretsiz)
- Apple Developer hesabı ($99/yıl - yayınlamak için)

### Android için:
- Android Studio (ücretsiz)
- Java JDK 17+

## İlk Kez Yayınlama

### iOS App Store:
1. Xcode'u aç: `npm run cap:open:ios`
2. Signing & Capabilities → Team seç
3. Product → Archive
4. Distribute App → App Store Connect
5. https://appstoreconnect.apple.com adresinden yayınla

### Google Play Store:
1. Android Studio'yu aç: `npm run cap:open:android`
2. Build → Generate Signed Bundle/APK
3. Release build yap
4. https://play.google.com/console adresinden yayınla

## Sorun mu Yaşıyorsun?

Detaylı rehber için `MOBILE_BUILD_GUIDE.md` dosyasını oku.

## Hızlı Komutlar

\`\`\`bash
# Kurulum
npm run mobile:setup

# Güncelleme
npm run mobile:update

# iOS'u aç
npm run cap:open:ios

# Android'i aç
npm run cap:open:android

# Sync (değişiklikleri uygula)
npm run cap:sync
\`\`\`

## Önemli Notlar

1. **İlk kurulum:** `npm run mobile:setup` komutunu çalıştır
2. **Her kod değişikliğinde:** `npm run mobile:update` çalıştır
3. **iOS için macOS gerekli**
4. **App Store/Play Store incelemesi 1-7 gün sürer**

## Yardım

Sorun yaşarsan:
1. `npx cap doctor` komutunu çalıştır
2. MOBILE_BUILD_GUIDE.md dosyasını oku
3. Hata mesajını Google'da ara
