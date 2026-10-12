# RenkFlow V2

Renk Alüminyum için sipariş, üretim, depo ve finans yönetim platformu.

## Yapı

```
apps/
├── web/      # Next.js 16 web uygulaması (ana ürün, Vercel'de yayınlanır)
├── native-ios/      # SwiftUI saha uygulaması
├── native-android/  # Kotlin / Jetpack Compose saha uygulaması
└── mobile/          # Eski Expo prototipi (yeni native uygulamalarda kullanılmaz)
docs/         # Geliştirici devir notları
```

## Web uygulaması

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, PostgreSQL (`postgres` + Drizzle), NextAuth v5, Vercel Blob.

```bash
cd apps/web
npm ci --workspaces=false --legacy-peer-deps
cp .env.example .env.local   # değerleri doldurun
npm run db:migrate           # şemayı uygular (rate_limit_buckets dahil)
npm run dev
```

### Doğrulama

CI ve yerel kontrol aynı komutu kullanır:

```bash
npm run validate   # guardrail'ler + type-check + lint + jest + build
```

### Yayınlama

Yalnızca Vercel kullanılır. `main` dalına yapılan push'lar Vercel Git entegrasyonu ile yayınlanır; veritabanı migration'ları `npm run db:deploy` ile ayrı bir sürüm adımı olarak çalıştırılır. Ayrıntılar: [`apps/web/docs/vercel-deployment.md`](apps/web/docs/vercel-deployment.md).

## Mobil uygulama

Yeni iOS ve Android saha uygulamaları sıfırdan native olarak geliştirilir.
Kurulum, API sözleşmesi ve test yönergeleri: [Native saha uygulamaları](docs/native-field-apps.md).

### Eski Expo prototipi

```bash
cd apps/mobile
npm install
npm start
```
