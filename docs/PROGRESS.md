# RenkFlow panel görevi — ilerleme

Kaynak görev: "RenkFlow paneli: her özelliği gerçekten çalışır hale getirme" (Faz 0–9). Yeni oturum bu dosyayı okuyup kaldığı yerden devam etmeli.

## Durum

| Faz | Durum | Dal / PR | Not |
|---|---|---|---|
| 0 Denetim | **tamamlandı** | `claude/wonderful-faraday-w67fb4` | Sonuç: [`docs/AUDIT.md`](AUDIT.md). Kod değişikliği yok |
| 1 Temel (kayıt, firma, rol, bildirim, arama) | sırada | — | Önce K1, K2 hızlı düzeltme; sonra K3–K5 güvenlik |
| 2 Katalog ve stok | bekliyor | — | Sayım PDF'i gerekli |
| 3 Ölçüye özel sipariş ve teklif | bekliyor | — | Fiyat matrisi değerleri gerekli |
| 4 Kesim optimizasyonu ve usta PDF'i | bekliyor | — | Kerf, tıraş, minimum artık değerleri gerekli |
| 5 Üretim, iş emri, sevkiyat, satın alma | bekliyor | — | `kanban`/`work-orders` birleştirme kararı |
| 6 Finans ve muhasebe | bekliyor | — | e-Fatura entegratörü yok |
| 7 Proaktif AI | bekliyor | — | Model anahtarları |
| 8 Görsel ve deneyim | bekliyor | — | — |
| 9 Kalite ve kapanış | bekliyor | — | — |

## Senden beklenen kararlar / girdiler

1. **Silme onayı:** AUDIT.md "Ölü kod" bölümündeki yönlendirme sayfaları, kullanılmayan 103 modül, iki SSO uç seti, `support/tickets`, `onboarding/session`, `test-email`. Onay olmadan silinmeyecek.
2. **Güvenlik düzeltmeleri (K3, K4):** yetkiyi daraltıyor (gevşetmiyor). Worker'ın teklif/müşteri/sevkiyat ekranlarına erişimini kapatmak dahil. Birleştirmeden önce onayın alınacak.
3. **Sayım PDF'i** (`malzeme_say_m_listesi.pdf`) — Faz 2.
4. **İş kuralı değerleri:** testere payı (kerf), baş/son tıraş, kullanılabilir artık için minimum boy, standart boylar (6/6,5/7/…/10 m hangileri) — Faz 4.
5. **Fiyat matrisi** (ürün ailesi × ölçü × renk × donanım) — Faz 3.

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
