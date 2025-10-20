# Capacitor Mobil Build İçin Yapılandırma

Mobil uygulama build ederken `next.config.mjs` dosyasına aşağıdaki satırları eklemeniz gerekiyor:

## next.config.mjs'e Eklenecek

\`\`\`javascript
const nextConfig = {
  output: 'export',  // Static export için
  trailingSlash: true,  // Capacitor için gerekli
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}
\`\`\`

## Mobil Build Adımları

1. `next.config.mjs` dosyasını yukarıdaki gibi düzenle
2. `npm run build` komutuyla static export yap
3. `npx cap sync` ile platformlara kopyala
4. Android Studio veya Xcode'da aç ve çalıştır

## Web Deployment İçin

Web deployment (Vercel) için `output: 'export'` ve `trailingSlash: true` satırlarını KALDIRIN.
Sadece mobil build yaparken bu ayarlar gerekli.
