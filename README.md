# RenkFlow V2

Sipariş, teklif, profil stokları, kesim, üretim, depo ve finans iş akışlarını bir araya getiren web uygulaması. Kodun mevcut olması fabrika pilotunun veya üretim ortamının doğrulandığı anlamına gelmez. AI çıktıları taslaktır; kayıt değişiklikleri için insan incelemesi ve onayı gerekir.

## Teknoloji ve yapı

Ana ürün `apps/web`: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 3; PostgreSQL (`postgres` + Drizzle), Auth.js / NextAuth v5, özel dosyalar için Vercel Blob ve yerelde dosya depolama. Jest / Testing Library, Playwright ve ayrı PostgreSQL entegrasyon betikleri kullanılır. Paket sürümleri ve komutların kaynağı [web package.json](apps/web/package.json) dosyasıdır.

```text
apps/web/             # Web uygulaması, API, lib/features, testler ve scripts
apps/native-ios/      # Mevcut SwiftUI saha istemcisi
apps/native-android/  # Mevcut Kotlin / Jetpack Compose saha istemcisi
apps/mobile/          # Arşiv niteliğinde eski Expo prototipi (aşağıdaki not)
docs/                 # Devir, geçmiş ilerleme ve yol haritası
apps/web/docs/        # Web operasyon ve özellik belgeleri
scripts/mobile/       # Native saha sözleşmesi / yerel test yardımcıları
```

## Yerel web kurulumu

Node.js **22.x** kullanın (`engines` ve CI sözleşmesi). Repo kökünden:

```bash
cd apps/web
npm ci --workspaces=false --legacy-peer-deps
cp .env.example .env.local
npm run db:local
```

`db:local` terminalde açık kalır; yalnız loopback üzerinde yerel PostgreSQL başlatır, `renkflow_dev` ve `renkflow_test` veritabanlarını hazırlar, gerekli yerel şemayı kurar. Uzak `DATABASE_URL` kullanmaz. Uygulama için ayrı terminalde yine `apps/web` dizinini kullanın.

[.env.example](apps/web/.env.example) sözleşmesine göre `.env.local` dosyasını **yalnız yerel geliştirme DB'si** için yapılandırın: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `STORAGE_BACKEND` ve `PUBLIC_SITE_MODE`. Yerel DB adresi/portu için [db:local uygulamasına](apps/web/scripts/dev-database.ts) bakın. Anahtarları, bağlantı dizelerini ve `.env.local` dosyasını Git'e eklemeyin; gerçek sağlayıcı değerleri olmadan sağlayıcı entegrasyonu doğrulanmış sayılmaz.

```bash
npm run dev
```

Web: `http://localhost:3000`; panel başlangıcı: `http://localhost:3000/new-order`. Mevcut bir hesaba/yerel test fixture'ına ihtiyaç vardır; kurulum gerçek iş verisi veya üretim hesabı sağlamaz. Yerel geliştirme için uzak migration, seed veya deployment çalıştırmayın.

## Doğrulama (apps/web)

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
```

`build`, PDF worker hazırlığını ve sunucu PDF paketi kontrolünü de çalıştırır. Dev sunucusu ve build aynı `.next` üzerinde eşzamanlı çalıştırılmamalı.

```bash
npm run validate
npm run test:integration
```

`validate`: backend/tenant/env guardrail'leri + type-check + lint + Jest + build. **DB entegrasyon testlerini içermez**; [CI](.github/workflows/validate.yml) bunları sonraki adımda ayrıca çalıştırır.

`test:integration`, [runner](apps/web/scripts/run-integration-tests.ts) ile geçici dizinde boş bir PostgreSQL kümesi ve boş bir loopback portu açar; uzak bağlantı kabul etmez, dev DB'sini yeniden kullanmaz. Yerel şema ve native saha şemasını hazırlar; `scripts/test-*.ts` betiklerini (`test-db.ts` hariç) sırayla çalıştırır. Her betiğin zaman sınırı vardır; sonuçları raporlar ve normal kapanışta kümeyi temizler. Örneğin dar bir doğrulama:

```bash
npm run test:integration -- sales chain
```

Jest bu gerçek DB provasının yerine geçmez. Embedded PostgreSQL'in ortamda çalışabilmesi gerekir; PDF fixture'ları için Playwright uyumlu Chromium, XML doğrulaması için `xmllint` gerekir. Ortama bağlı fixture ayarları [.env.example](apps/web/.env.example) içindedir. Tarayıcı E2E paketi ayrıca `npm run test:e2e` ile çalışır; oturum/DB fixture'ı isteyen özel senaryoların çalıştırıldığı ayrıca doğrulanmalıdır.

## Devir ve sınırlar

Güncel kod durumu ile birleşmemiş PR ayrımı: [DEV_HANDOFF](docs/DEV_HANDOFF.md). [ROADMAP](docs/ROADMAP.md) ve [PROGRESS](docs/PROGRESS.md) tarihsel plan/günlük içerir; eski test sayıları veya canlı ortam notları güncel doğrulama değildir. Yayınlama bilgisi: [Vercel runbook](apps/web/docs/vercel-deployment.md); bu yerel kurulum üretime işlem yapmaz.

### Eski Expo prototipi

`apps/mobile` arşiv/kullanım dışı prototip olarak tutulur; mevcut [native saha istemcileri](docs/native-field-apps.md) onu kullanmaz. Ancak kök [package.json](package.json) içindeki `dev:mobile` hâlâ Expo'yu başlatır ve `apps/*` workspace kapsamı prototipi içerir. İncelenen CI dosyalarında Expo build/yayın adımı bulunmadı; harici kullanım **doğrulanmadı**. Dosyalar silinmedi veya taşınmadı; yeni geliştirme başlangıcı olarak önerilmez.
