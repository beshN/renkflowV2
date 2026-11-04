# S-08: uygulama CSP ilk dilimi

Panel, `/auth/*`, `/signup` ve `/api/*` cevaplarında tam CSP varsayılan olarak zorunludur. Proxy'nin mevcut public sayfa listesi ve statik varlıklar önceki baseline + report-only politikasını korur. Landing tasarımı/işlevi değişmez. Dosya handler'larının mevcut daha sıkı `sandbox` CSP'si korunur; bu genel politika onların yerine geçirilmez.

## Geri dönüş

Uygulama sunucusunda **yalnız `CSP_REPORT_ONLY=1`** tam politikayı report-only'ye taşır. Değişken yoksa, boşsa, `0`, `true` veya başka bir değerse enforcement sürer. Eski `base-uri 'self'; object-src 'none'` baseline zorunlu kalır; dosya sandbox'ları gevşemez. Runtime değişkeni olduğu için sunucuyu yeniden başlatın; bu değişken için yeniden build gerekmez. Tekrar enforcement için değişkeni kaldırıp sunucuyu yeniden başlatın. Bu PR production/Vercel ayarı değiştirmez.

## İnceleme ve izinler

- Başlangıç: `lib/security/security-headers.ts` iki direktiflik zorunlu CSP ve tam report-only politika üretir. `proxy.ts` tüm yolları eşler ve erken dönüşlere de güvenlik başlıklarını ekler. `next.config.js` CSP üretmez; diğer güvenlik/cache başlıklarını üretir. Ayrı middleware yoktur.
- Kurulu Next.js 16.4.3 belgelerindeki CSP, nonce, proxy/middleware ve headers rehberleri okundu. Nonce için root layout `headers()` kullanır: istek başına render gerekir; daha önce statik üretilebilen sayfalar artık dinamiktir, CDN/ISR önbellek avantajı kaybolabilir. Landing zaten auth okur; tasarım değişmez.
- 32 rastgele baytlık nonce istek başınadır; gelen nonce/CSP başlığı uygulama yollarında üzerine yazılır. Next framework/bootstrap scriptleri request CSP'den nonce alır. `next-themes` ve Google Analytics'e aynı nonce prop'u gider; analitik çerez onayı akışı değişmez.
- Production `script-src` içinde `unsafe-inline`/`unsafe-eval` yoktur. Next.js geliştirme debugging'i için yalnız development'ta `unsafe-eval` vardır. `strict-dynamic` bu dilimde eklenmez: self-hosted script ve mevcut GA host izinleri açıkça korunur.
- `style-src 'unsafe-inline'`: mevcut React style prop'ları, Framer Motion, Radix, grafikler ve yazdırma stilleri nedeniyle gerekir. Stil kodu/tasarımı yeniden yazılmaz. Statik fontlar `next/font/google` ile build sırasında indirilip uygulamadan sunulur; browser font host izni gerekmez.
- `img-src https: data: blob:` mevcut politikayla aynıdır: uzak firma/avatar görselleri, AWS/CloudFront/CDN kaynakları, özel yüklemeler, OpenStreetMap ve yapılandırılabilir tile görselleri. Bu geniş görsel iznini daraltmak ayrı dilimdir.
- Script: self + nonce + `www.googletagmanager.com`. Connect: self + mevcut GA endpoint wildcard'ları. Yapılandırılmış `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_SUPPORT_SOCKET_URL` yalnız origin olarak eklenir (Socket.IO polling HTTP ve websocket eşleri); DSN anahtarı/path'i başlığa girmez. Kullanılmayan sağlayıcı hostlarına genel izin verilmez.
- AI sağlayıcıları, Vercel Blob ve backend servisleri sunucu tarafında çağrılır; browser aynı-origin API kullanır, AI sağlayıcı anahtarları/hostları browser'a açılmaz. Vercel toolbar/analytics script import'u bulunmadı; production Vercel ayarları incelenmedi/değiştirilmedi.
- `frame-src 'self' blob:` mevcut iframe/PDF önizlemeleri ve yazdırma içindir. `frame-ancestors 'none'` varsayılandır. Yalnız proxy'nin mevcut SAMEORIGIN dosya yollarında `self`: station/file, storage/content, production/files, knowledge/:id/content, orders/documents/:id/content. Route handler'larının daha sıkı sandbox politikaları ayrıca korunur. `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` zorunludur.
- CSP raporu alan uç, `report-uri`, `report-to` veya `Reporting-Endpoints` bulunmadı. Report-only bugün tarayıcı konsolu gözlemidir; merkezi ihlal toplama/temizlenmiş rapor havuzu iddiası yoktur. Bu dilim yeni collector eklemez.

## Sınırlar

Migration, seed veya yeni iş verisi yok. #133–#146 dosya listeleri incelendi; bu dilimin değiştirdiği dosyalarla ortak dosya yok. #116 eski audit dalının proxy değişiklikleriyle gelecekte birleştirme incelemesi gerekebilir; o dal değiştirilmez. Production, Neon, Vercel veya canlı DB işlemi yok. AI çıktısı insan onayı gerektirir; inceleme ve merge Berat'a aittir.

## Bu dilimde yerel doğrulama

- Node 24.19.0 ortamında `apps/web` içinde type-check başarılı; lint 0 hata / kapsam dışı mevcut 3 uyarı. Repo/CI Node 22 ister; Node 22 sonucu doğrulanmadı.
- Tam `npm test -- --runInBand`: 226 suite'in 225'i, 1692 testin 1685'i geçti. Yalnız mevcut `einvoice-xsd.test.ts` içindeki 7 test, ortamda `xmllint` bulunmadığından `ENOENT`. Tam test paketi yeşil değil. CSP/proxy/baseline odaklı son tur: 3 suite / 23 test başarılı.
- `npm run build` başarılı; postbuild standalone PDF worker paketleme ve gerçek föy Türkçe metin çıkarma kontrolü dahil.
- Build sonrası doğrudan `next start` ile localhost:3027, aynı build + `CSP_REPORT_ONLY=1` ile localhost:3028 çalıştırıldı. Next, `output: standalone` için standalone server kullanımını öneren uyarı verdi; buna rağmen gerçek yerel HTTP cevapları alındı. Bu, deploy/production doğrulaması değildir.
- İki GET /auth/login: nonce farklı; HTML nonce başlıkla aynı; enforcement altında report-only başlığı yok. Aynı build'in geri dönüş sürecinde baseline enforced ve tam nonce politikası report-only olarak doğrulandı. /api/auth/session 200 ve /dashboard anonim 302 cevapları zorunlu CSP taşıdı.
- Gerçek Chromium: /auth/login 200, 0 CSP olayı/mesajı; 6 inline scriptin nonce'ı CSP ile eşleşti. / 200 açıldı fakat korunan mevcut report-only politika altında 7 `script-src` / `eval` ihlal kaydı görüldü; ana sayfa için “konsol ihlalsiz” kriteri sağlandı denmiyor. Kaynak/kod değiştirilmedi ve `unsafe-eval` production'a eklenmedi.
- /dashboard, /quotations, /orders, /work-orders, /production?tab=cutting, /assistant anonim ziyaretleri girişe yönlendi. Girişte CSP ihlali olmaması bu oturumlu sayfaların doğrulandığı anlamına gelmez. Geçerli yerel oturum/veri sağlanmadığından panel ekranları, kayıtlı kesim planı, PDF/CSV indirme/önizleme, oturumlu AI asistanı ve gerçek GA/Sentry/Socket bağlantıları doğrulanmadı. Hesap/iş kaydı/seed üretilmedi; canlı sistem kullanılmadı.
