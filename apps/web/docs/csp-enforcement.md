# S-08: uygulama CSP ilk dilimi

Panel, `/auth/*`, `/signup` ve `/api/*` cevaplarında tam CSP varsayılan olarak **report-only** çalışır. Tam enforcement yalnız açık `CSP_ENFORCE=1` ile etkinleşir; `CSP_REPORT_ONLY=1` her durumda öncelikli geri dönüş anahtarıdır. Proxy'nin mevcut public sayfa listesi ve statik varlıklar önceki baseline + report-only politikasını korur. Landing tasarımı/işlevi değişmez. Dosya handler'larının mevcut daha sıkı `sandbox` CSP'si korunur; bu genel politika onların yerine geçirilmez.

## Modlar ve geri dönüş

| CSP_ENFORCE | CSP_REPORT_ONLY | Tam politika |
| --- | --- | --- |
| yok / boş / 0 / true / hatalı | herhangi | report-only |
| 1 | yok / boş / 0 / true / hatalı | enforced |
| 1 | 1 | report-only (geri dönüş öncelikli) |

Eski `base-uri 'self'; object-src 'none'` baseline her modda zorunlu kalır. Bayrakları değiştirdikten sonra sunucuyu yeniden başlatın; rebuild gerekmez. Enforce'tan güvenli geri dönüş için `CSP_REPORT_ONLY=1` verin veya `CSP_ENFORCE` değişkenini kaldırın. Bu PR production/Vercel ayarı değiştirmez. Varsayılanın report-only olması, doğrulanmamış oturumlu ekranlarda politika nedeniyle kırılma riskini erteler; S-08 enforcement tamamlandı iddiası yoktur.

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

## Claude DÜZELT 1 sonrası doğrulama

- `apps/web/AGENTS.md` ve kurulu Next.js CSP/nonce, proxy/middleware, headers belgeleri tekrar okundu. Node 24.19.0: type-check başarılı; lint 0 hata / mevcut 3 uyarı. Node 22/uzak CI sonucu doğrulanmadı.
- Tam `npm test -- --runInBand`: 226 suite'in 225'i, 1699 testin 1692'si geçti. Yalnız mevcut `einvoice-xsd.test.ts` içindeki 7 test eksik `xmllint` nedeniyle ENOENT. Tam paket yeşil değil. CSP/proxy/baseline odaklı tur: 3 suite / 30 test başarılı.
- `npm run build` ve postbuild standalone PDF worker/gerçek föy Türkçe PDF extraction kontrolleri başarılı.
- Aynı build üç yerel `next start` sürecinde denendi: varsayılan, `CSP_ENFORCE=1`, iki bayrak birlikte. HTTP 200 giriş cevaplarında modlar beklenen şekilde, nonce'lar istek başına farklı ve tema scriptinin HTML nonce'ı tam politika başlığıyla aynı. Enforce modunda 6 inline scriptin tamamı nonce taşır. Default/rollback'te baseline enforced + tam politika report-only; enforce'ta yalnız tam enforced politika var. Next standalone yapılandırması için standalone server öneren uyarı verdi; bu bir deployment doğrulaması değildir.

- Normal Chromium turu: enforce giriş sayfası 200 / 0 CSP olayı. Default ve rollback giriş sayfası 200 açıldı; her birinde 5 report-only inline-script olayı var: framework scriptleri bu iki modda nonce taşımıyor, tema scripti taşıyor. Browser scriptleri engellemiyor. Bu ek gözlem tam nonce raporlarının temiz olduğu şeklinde sunulmuyor; mevcut baseline/Next başlık önceliğini düzeltmek bu küçük mod değişikliğinde genişletilmedi, enforcement öncesi listede kalır.

## Landing eval kaynağı

Yerel production build'de Chromium'un Function constructor çağrıları yalnız tanısal init script ile izlendi; ürün kodu değiştirilmedi. Yedi çağrının tamamı **Zod JIT** kaynaklı: bir `allowsEval` yetenek yoklaması ve altı object validator derlemesi. Stack'te `$ZodObjectJIT`, `Doc.compile`, `_zod.parse` var; oluşturulan validator alanları geometry, itemId, name, minWidthMm, widthMm, kerfMm. Kurulu `node_modules/zod/v4/core/util.js` (`allowsEval`), `doc.js` (`compile`, `new F`) ve `schemas.js` (`generateFastpass`) kaynaklarıyla eşleştirildi. Normal, izleme yapılmayan Chromium turunda da landing 200 ve 7 report-only eval ihlali görüldü. Zod panel kodunda da kullanılır; bu bulgu oturumlu ekranların enforcement altında güvenli olduğunun kanıtı değildir. Bu commit Zod ayarını/kodunu, landing'i veya script izinlerini değiştirmez; production'a unsafe-eval eklemez.

## Enforcement öncesi kontrol listesi

Geçerli yerel/test kullanıcı ve kayıtlar sağlanmadan hesap/seed/iş verisi üretilmedi. Aşağıdakilerin tamamı **oturumlu enforce modunda doğrulanmadı**; anonim giriş yönlendirmesi ekran doğrulaması sayılmaz:

- Dashboard, siparişler ve üretim/kesim ekranları: açılış + gerçek etkileşim; konsolda CSP ihlali yok.
- Kayıtlı kesim planı, PDF önizleme/yazdırma, intake iframe: dosya açılışı ve son cevap CSP/sandbox başlıkları.
- `/office`, ürün yapılandırıcı ve asistan: Zod doğrulama, mevcut 3D/barkod/QR akışları ve AI için insan onayı sınırı.
- CSV/DXF indirmeleri: erişim, attachment başlıkları ve dosya açılışı. Diğer PR'lara ait henüz main'de olmayan DXF yolları bu dalda test edilmiş sayılmaz.
- GA onayı, Sentry ve yapılandırılmış socket bağlantıları: gerçek test yapılandırmasında izinler ve konsol.
- Zod JIT fallback/ihlal davranışını her ilgili akışta değerlendirme; ayrı bir düzeltme gerekirse incelemeden sonra uygulama.

Bu liste tamamlanıp insan incelemesi yapılmadan production enforcement'a geçildiği varsayılmamalıdır. `/api/storage/content` gibi başarılı dosya cevaplarında route sandbox CSP'si ile proxy politikasının gerçek son yanıt önceliği **doğrulanmadı**: geçerli aktör/dosya olmadan sahte başarılı yanıt kurulmadı. Bu küçük düzeltme header birleştirmesini veya dosya rotalarını değiştirmez; gerçek HTTP testi sonraki doğrulama listesinde kalır. Merkezi rapor toplayıcı yoktur; report-only gözlemi yalnız browser konsolundadır.
