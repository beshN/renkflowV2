# RenkFlow panel görevi — ilerleme

Kaynak görev: "RenkFlow paneli: her özelliği gerçekten çalışır hale getirme" (Faz 0–9). Yeni oturum bu dosyayı okuyup kaldığı yerden devam etmeli.

## Durum

| Faz | Durum | Dal / PR | Not |
|---|---|---|---|
| 0 Denetim | **tamamlandı** | `claude/wonderful-faraday-w67fb4` | Sonuç: [`docs/AUDIT.md`](AUDIT.md). Kod değişikliği yok |
| 1 Temel (kayıt, firma, rol, bildirim, arama) | **devam ediyor** | PR'lar aşağıda | K1, K2 → K4, K3, K5 (birleştirmeden önce onay) → arama → K6, K7 |
| 2 Katalog ve stok | bekliyor | — | Sayım PDF'i gerekli |
| 3 Ölçüye özel sipariş ve teklif | bekliyor | — | Fiyat matrisi değerleri gerekli |
| 4 Kesim optimizasyonu ve usta PDF'i | bekliyor | — | Kerf, tıraş, minimum artık değerleri gerekli |
| 5 Üretim, iş emri, sevkiyat, satın alma | bekliyor | — | `kanban`/`work-orders` birleştirme kararı |
| 6 Finans ve muhasebe | bekliyor | — | e-Fatura entegratörü yok |
| 7 Proaktif AI | bekliyor | — | Model anahtarları |
| 8 Görsel ve deneyim | bekliyor | — | — |
| 9 Kalite ve kapanış | bekliyor | — | — |

## Kararlar (6 Ekim 2026, onaylandı)

1. Sıra: docs PR → K1 → K2 → K4, K3, K5 → K6, K7 (Faz 3'ü beklemeden). Arama hatası ve müşteri/teklif/stok araması Faz 1 kapsamında.
2. Güvenlik (K3, K4) onaylı. Şartlar: usta için fiyat ve müşteri alanları **API yanıtında** rol bazlı çıkarılır; usta iş emri, kesim listesi, usta PDF'i ve üretim ekranlarını kullanmaya devam eder (testle); aktif firma oturumdan okunur (çok firmalı test); worker'da 500 dönen server action'lar 403 döner. **K3, K4, K5 birleştirilmeden önce durulup onay alınır.**
3. Silme onaylı, ayrı PR: yönlendirme sayfaları `next.config` redirects'e; yalnız bağlı olmayan SSO seti; `test-email` ve route'u olmayan istemci kodu; 103 modül build/test/grep doğrulamasıyla gruplar hâlinde. `lib/features/ai/ai.service.ts` (Faz 7) ve kanban/work-orders kararı (Faz 5) dokunulmaz.
4. Pazarlama metinleri denetimle uyumlu hâle getirilir (ayrı PR); "sonra güçlendir" listesi buraya eklenir.
5. Her PR: `npm run validate` yeşil + `/code-review`; açıklamada ne değişti / nasıl doğrulandı / bilinmeyenler; bu dosya güncellenir.

## Beklenen girdiler

- **Faz 4 değerleri** (ustadan gelecek): testere kalınlığı, baş/son tıraş, kullanılabilir en kısa artık, kullanılan çubuk boyları. **Faz 2'ye geçmeden hatırlat.**
- Sayım PDF'i (`malzeme_say_m_listesi.pdf`) bu oturuma yüklendi; Faz 2'de ayrıştırılacak. Gerçek veri olduğu için repoya eklenmeyecek. Kullanıcı ayrıca güncel sürümünü verecek.
- Fiyat matrisi (Faz 3), e-Fatura entegratörü (Faz 6), AI anahtarları (Faz 7).

## PR günlüğü

| PR | Konu | Durum | Doğrulama | Bilinmeyenler |
|---|---|---|---|---|
| #13 | Faz 0 denetimi (AUDIT/PROGRESS) | birleşti | CI `validate` yeşil | — |
| #14 (K1) | Teklif listesi çökmesi: sütun `render(value,row)` imzası; liste `useApiCollection`'a taşındı (iptal, dizi kontrolü, ham sunucu hatası gizli, tekrar dene) | birleşti | Regresyon testi düzeltmeden önce aynı `TypeError`'ı üretti, sonra geçti; `validate` yeşil | `RFColumn.render` ilk argümanı `any`; diğer listelerde aynı yanlış kullanım yok (grep), tip daraltma ayrı iş |
| K2 | Yeni iş emri her zaman 500: `loadWorkOrderById` transaction içinde global `sql` ile okuyordu (commit edilmemiş satır görünmüyor → hata → rollback). Okuma `tx` ile yapılıyor, istemci zorunlu parametre. Aynı hata güncellemede eski kaydı döndürüyordu. Ayrıca checklist ekleme konum hatası (`max_position || -1`) | açık | 3 regresyon testi eski kodda düşüyor; yerel DB'de formdan oluşturma + PATCH yeni başlığı döndürüyor; `validate` yeşil | Checklist kalemleri satır satır ekleniyor (performans, kapsam dışı) |

## Bu ortamda yerel çalıştırma (bulut konteyner notu)

```sh
cd apps/web
npm ci --workspaces=false --legacy-peer-deps
mkdir -p .data && chown postgres .data   # yalnız root olarak çalışan konteynerde gerekli
npm run db:local                          # 127.0.0.1:55432 · renkflow_dev / renkflow_test (arka planda açık kalır)
npm run test:production && npm run test:warehouse   # test firması + .data/production-test-fixture.json
npm run build
DATABASE_URL=postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test \
AUTH_SECRET=integration-test-secret-local-only-1234567890 NEXTAUTH_SECRET=integration-test-secret-local-only-1234567890 \
AUTH_URL=http://127.0.0.1:3001 NEXTAUTH_URL=http://127.0.0.1:3001 AUTH_TRUST_HOST=true \
ALLOW_INSECURE_HTTP=1 ALLOW_LOCAL_DATABASE=1 NATIVE_INVENTORY_ENABLED=1 PUBLIC_SITE_MODE=off \
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001
```

- `AUTH_TRUST_HOST=true` yerelde gerekli: Auth.js isteği `localhost` olarak görüyor, `127.0.0.1` ile eşleşmeyince `UntrustedHost` / `?error=Configuration` veriyor. Bu yalnız yerel test sunucusu içindir.
- Playwright: `executablePath: '/opt/pw-browsers/chromium'`. `scripts/verify-production-browser.cjs` Mac Chrome yolunu varsayıyor; `CHROME_EXECUTABLE=/opt/pw-browsers/chromium` ile çalıştırılabilir.
- Sunucuyu durdururken `pkill -f "next start"` kendi kabuğunu da öldürebilir; PID ile durdur.
- Neon `dev` dalı (`br-muddy-shape-b2meo8ce`) şu an **boş** (şema var, veri yok). Production dalına bağlanılmadı.

## Sonraya (kapsam dışı bulunanlar)

- `e2e/*.spec.ts` (4 spec) CI kapısına bağlı değil; Faz 9.
- `scripts/verify-production-browser.cjs` Chrome yolu platforma bağımlı.
- `next start` uyarısı: `output: standalone` ile `next start` önerilmiyor; yerel test için çalışıyor.
