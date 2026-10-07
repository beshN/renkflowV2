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
| #15 (K2) | Yeni iş emri her zaman 500: `loadWorkOrderById` transaction içinde global `sql` ile okuyordu (commit edilmemiş satır görünmüyor → hata → rollback). Okuma `tx` ile yapılıyor, istemci zorunlu parametre. Aynı hata güncellemede eski kaydı döndürüyordu. Ayrıca checklist ekleme konum hatası (`max_position || -1`) | birleşti | 3 regresyon testi eski kodda düşüyor; yerel DB'de formdan oluşturma + PATCH yeni başlığı döndürüyor; `validate` yeşil | Checklist kalemleri satır satır ekleniyor (performans, kapsam dışı) |
| #16 (K4) | Müşteri API'si ve panel özeti firmayı oturumdan, rolü güncel üyelikten okuyor (ilk üyelik değil). Müşteri uçlarında `customers.*` izni, aynı-köken kontrolü, Zod doğrulaması; kısmi güncelleme yalnız gönderilen alanları yazar; geçersiz id 404 | birleşti (7 Ekim, onaylı) | 9 test eski kodda düşüyor; yerel DB'de iki firmalı kullanıcı (eski üyelik usta, oturum firması sahip): kayıt oturum firmasına yazıldı, usta 403, cross-site 403, kısmi PUT diğer alanları korudu; `validate` yeşil | Firma değiştirme arayüzü yok: oturum firması girişte en yüksek rollü üyelikten seçiliyor |
| #17 (K3) | Usta ticari sınırı: teklifler (fiyat/müşteri) usta için API'de 403; sipariş, arama, üretim işleri yanıtlarında müşteri adı yok; sevkiyat, `analytics/*`, dışa aktarma usta için 403. Ekran sınırı `proxy.ts`'de sunucu tarafında (`ROUTE_ROLES` + izinler; menü aynı listeden okuyor): gezinti panele döner, server action POST'u 403. `RouteGuard` yetkisiz ekranı hiç bağlamıyor | birleşti (7 Ekim, onaylı) | 40+ test; gerçek tarayıcıda usta API taraması (fiyat/müşteri alanı yok), mevcut üretim tarayıcı testi tam geçti (usta 5 operasyonu mamule kadar, çevrim dışı, barkod), usta server action POST 403, sahip ekranları sorunsuz; `validate` yeşil | `member` rolü teklif API'sini hâlâ okuyabiliyor (ekranı kapalı) — karar gerekli; ekran sınırı JWT rolünü kullanıyor (≤60 sn gecikme), veri API'leri güncel üyeliği okur |
| #18 (K5) | Tek denetim kaydı `activity_logs` (ADR 0001): `recordAudit` (işlem içindeyse aynı transaction), `AuditLogService` artık gerçekten yazıyor (önce var olmayan tabloya yazıp hatayı yutuyordu), `/api/audit` yalnız sahip/yönetici. Kayda düşenler: sipariş oluştur/güncelle/sil, teklif oluştur/güncelle/durum/dönüştür/sil, müşteri, firma ayarları, davet/iptal, tahsilat/personel/bordro komutları, tahsilat silme | birleşti (7 Ekim, onaylı) | 9 birim test; gerçek DB'de formdan sipariş, PATCH farkı, ayar, tahsilat, silme kaydı (sipariş silinse de kalıyor), tekrar komutlarında çift kayıt yok; usta `/api/audit` 403; `validate` yeşil | `activity_logs` UPDATE/DELETE'e karşı korumalı değil (ADR'de sonraki adım); ayar kaydı fark etmeden şablon/sektörü değiştiriyor (ayrı hata) |
| #19 (ayarlar) | Firma ayarlarında yalnız adı kaydetmek şablonu/sektörü değiştiriyordu: form artık kayıtlı değerlerden başlıyor ve yalnız değişen alanları gönderiyor; sunucu Zod ile doğrulayıp yalnız gönderilen alanları yazıyor (önceki değer kilitli alt sorgudan, denetim kaydı için) | birleşti | Rota testi (4) ve form testi (2); eski kodda ad-yalnız/şablon testleri düşüyor; yerel DB'de `mobilya` firmasında yalnız ad değişti, şablon/sektör/renk korundu, denetim kaydı yalnız adı gösteriyor | Birim testleri SQL sözdizimini doğrulamıyor; ilk sürümdeki hata yalnız gerçek DB'de görüldü |
| #20 (member-teklif) | `member` (Ekip üyesi) teklif API'sini de okuyamıyor (ekranı K3'te kapanmıştı). Teklif API rolleri = `/quotations` ekran rolleri; test bu eşitliği koruyor | birleşti | 2 test eski kodda düşüyor; `validate` yeşil | — |
| #21 (K6) | Sipariş–müşteri bağı: her sipariş bir müşteri kartına bağlanıyor (sipariş transaction'ı içinde). Formda öneri listesinden kart seçilebilir (`customerId`, firma ve aktiflik kontrolü); seçilmezse aynı e-posta → aynı telefon (son 10 hane) → aynı ad veya firma adı (Türkçe büyük/küçük harf ve boşluk farkı yok sayılır) eşleşir; e-posta/telefonu çelişen aynı adlı kart bağlanmaz; aynı adlı birden çok kart varsa sunucu tahmin etmez, 409 ile listeden seçim ister; hiçbiri yoksa yeni kart açılır (firma kilidi altında tekrar kontrol, denetim kaydı). Tekliften dönüşen sipariş de karta bağlanıyor (ad belirsizse bağsız kalır). Yerel DB artık production gibi UTF8 | — | 11 birim + form testi; yerel DB'de (UTF8) tarayıcıdan: yeni ad kart açtı, "  K6 YAPI " aynı karta bağlandı, öneriden seçim aynı kart, CRM'de 3 sipariş; firma adı yazılınca firma kartı; aynı adlı iki kartta 409 + mesaj, sipariş yazılmadı; teklif dönüşümü tekil adda bağlı, belirsiz adda bağsız; ad katlama SQL'i Neon dev dalında JS ile aynı sonucu verdi (salt okuma); `test:production`/`test:warehouse` geçti; `validate` yeşil | Mevcut, karta bağlı olmayan eski siparişler geriye dönük bağlanmadı (veri değişikliği, onay gerekir); kart birleştirme arayüzü yok; eşleştirme sorgusu indekssiz (firma başına müşteri sayısı küçükken sorun değil); müşteri sayfasından elle açılan kart sipariş kilidine girmez (elle açılışta tekrar kontrolü yok, bilinçli) |

## Bilinen sınırlar

- **Denetim kaydı yazılamazsa yalnız loga düşer.** İşlem içinde yazılan kayıtlar (sipariş oluşturma/silme, teklif oluşturma/durum/dönüşüm, `finance.*` komutları) değişiklikle birlikte geri alınır. Commit sonrası yazılanlar (sipariş/teklif güncelleme, teklif silme, firma ayarları, davet iptali, tahsilat silme, `AuditLogService` çağrıları) başarısız olursa değişiklik geçerli kalır, kayıt yalnız sunucu loguna `[Audit] Kayıt yazılamadı` olarak düşer; uyarı/yeniden deneme yok.
- `activity_logs` henüz UPDATE/DELETE'e karşı korumalı değil (onaylandı; K6/K7'den sonra öneri + migration).

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
- Yerel veritabanları UTF8 açılıyor (production gibi). Eski bir `.data` SQL_ASCII ise `npm run db:local` uyarır: `renkflow_dev`/`renkflow_test` silinip yeniden çalıştırılmalı.
- Neon `dev` dalı (`br-muddy-shape-b2meo8ce`) şu an **boş** (şema var, veri yok). Production dalına bağlanılmadı.

## Sonraya (kapsam dışı bulunanlar)

- `e2e/*.spec.ts` (4 spec) CI kapısına bağlı değil; Faz 9.
- `scripts/verify-production-browser.cjs` Chrome yolu platforma bağımlı.
- `next start` uyarısı: `output: standalone` ile `next start` önerilmiyor; yerel test için çalışıyor.
