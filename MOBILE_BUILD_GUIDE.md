# RenkFlow Mobil Uygulama Kurulum Rehberi

## Gereksinimler

### iOS için:
- macOS bilgisayar
- Xcode (App Store'dan ücretsiz indir)
- Apple Developer hesabı ($99/yıl)

### Android için:
- Android Studio (ücretsiz)
- Java JDK 17+

## Kurulum Adımları

### 1. Projeyi İndir ve Bağımlılıkları Yükle

\`\`\`bash
# Projeyi GitHub'dan indir veya ZIP olarak çıkar
cd renkflow

# Bağımlılıkları yükle
npm install
\`\`\`

### 2. Capacitor'ı Başlat

\`\`\`bash
# Capacitor'ı başlat (sadece ilk kez)
npm run cap:init
\`\`\`

### 3. Platform Ekle

\`\`\`bash
# iOS ekle (sadece macOS'ta)
npm run cap:add:ios

# Android ekle
npm run cap:add:android
\`\`\`

### 4. Uygulamayı Build Et

\`\`\`bash
# Web uygulamasını build et ve Capacitor'a sync et
npm run mobile:build
\`\`\`

## iOS Uygulaması Yayınlama

### 1. Xcode'da Aç
\`\`\`bash
npm run cap:open:ios
\`\`\`

### 2. Xcode'da Ayarlar
- **Signing & Capabilities** sekmesine git
- Apple Developer hesabını ekle
- Bundle Identifier'ı değiştir: `com.renk.siparis`
- Team seç

### 3. App Store'a Yükle
- Product → Archive
- Distribute App → App Store Connect
- Upload

### 4. App Store Connect'te
- https://appstoreconnect.apple.com
- Uygulama bilgilerini doldur
- Ekran görüntüleri ekle
- İncelemeye gönder

## Android Uygulaması Yayınlama

### 1. Android Studio'da Aç
\`\`\`bash
npm run cap:open:android
\`\`\`

### 2. Signing Key Oluştur
\`\`\`bash
keytool -genkey -v -keystore renkflow.keystore -alias renkflow -keyalg RSA -keysize 2048 -validity 10000
\`\`\`

### 3. Build → Generate Signed Bundle/APK
- Android App Bundle seç
- Keystore'u seç
- Release build yap

### 4. Play Console'da Yayınla
- https://play.google.com/console
- Uygulama oluştur
- AAB dosyasını yükle
- Store listing bilgilerini doldur
- İncelemeye gönder

## Güncelleme Yayınlama

\`\`\`bash
# Kod değişikliklerinden sonra
npm run mobile:build

# iOS için
npm run cap:open:ios
# Xcode'da version numarasını artır ve Archive

# Android için
npm run cap:open:android
# Android Studio'da version code artır ve Build
\`\`\`

## Test Etme

### iOS Simulator'da Test
\`\`\`bash
npm run mobile:build
npm run cap:open:ios
# Xcode'da Play butonuna bas
\`\`\`

### Android Emulator'da Test
\`\`\`bash
npm run mobile:build
npm run cap:open:android
# Android Studio'da Run butonuna bas
\`\`\`

## Sorun Giderme

### "out" klasörü bulunamıyor
\`\`\`bash
npm run build
\`\`\`

### iOS build hatası
- Xcode'u güncelle
- Pods'u temizle: `cd ios/App && pod install`

### Android build hatası
- Android Studio'yu güncelle
- Gradle sync yap: File → Sync Project with Gradle Files

## Faydalı Komutlar

\`\`\`bash
# Değişiklikleri sync et
npm run cap:sync

# Capacitor doctor (sorunları kontrol et)
npx cap doctor

# Plugin listesi
npx cap ls
\`\`\`

## Önemli Notlar

1. Her kod değişikliğinden sonra `npm run mobile:build` çalıştır
2. iOS için macOS gerekli
3. App Store ve Play Store inceleme süreci 1-7 gün sürebilir
4. İlk yayın için ekran görüntüleri ve açıklamalar hazırla
