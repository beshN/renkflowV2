# RenkFlow yol haritası: Odoo seviyesi eksiklerin kapatılması

Başlangıç: 14 Ekim 2026 · Taban: `main` @ `84cf0b36` (PR #76 sonrası)

Bu belge programın durum tablosudur. Her iş kendi dalında ve PR'ında yapılır; bir oturum kesilirse iş buradan devam eder. Ayrıntılı iş geçmişi `docs/PROGRESS.md`'dedir.

## Kararlar

- **Strateji:** RenkFlow, Renk Alüminyum'un kendi aracı olarak kalıyor. Genel API, self-servis kayıt ve abonelik ödemesi öncelik dışı. Firma ayrımı (RLS) yine sertleştirilecek.
- **e-Fatura:** Önce sağlayıcıdan bağımsız bir `EInvoiceProvider` arayüzü, UBL-TR üretimi ve sahte (mock) sağlayıcı yazılacak. Entegratör seçilince tek bir adaptör eklenecek.
- **Bordro:** SGK ve vergi hesaplayan bir motor yazılmayacak. Personel kartına yasal alanlar eklenecek ve muhasebeci için dışa aktarım hazırlanacak.
- **Dış hesaplar** (entegratör, SMS, Sentry DSN, banka API, mağaza imza anahtarları) kullanıcıdan gelecek. Kod, sandbox ya da sahte sağlayıcıyla hazırlanacak.

## Temel ölçüm (14 Ekim 2026)

- Jest: 135 suite, **970 test**, hepsi geçiyor (Node 24, `npm --prefix apps/web ci`).
- Entegrasyon betikleri: 27 adet `npm run test:*`. Henüz CI'da çalışmıyorlar.
- Kod doğrulamasıyla düzelen tespitler:
  - Fatura modeli 047'de var (taslak, kesme, iptal, kısmi faturalama, tahsilat). Eksik olan e-Belge tarafı: yasal kimlik, GİB numarası, tevkifat ve istisna, UBL-TR, gönderim.
  - Yevmiye ve mizan kodu var, ama hiçbir işlem otomatik kayıt atmıyor ve arayüzde görünmüyorlar.
  - K8 (çubuk boyu karışımı) yapılmış. Bu konuda `AUDIT.md` eski.
  - Repoda konum verisi yok. KVKK açığı, veri sahibi talepleri (DSR) ile saklama ve imha işlerinde.
  - Parola alt sınırı 6 karakter. CSP yok. SSO `client_secret` düz metin. RLS fiilen etkisiz.

## Production'da bulunan açıklar (14 Ekim, salt okunur sorgu)

- `audit_logs` tablosu yok (`002_audit_logs.sql` hiç uygulanmamış). Denetim kayıtları bundan etkilenmiyor: `AuditLogService` dahil tüm yazıcılar K5'ten beri `activity_logs`'a yazıyor. Bu tabloyu yalnızca hiçbir yerden çağrılmayan `/api/tenant/activity` rotası okuyordu.
- `automation_rules` ve `time_entries` yok (`003_enterprise_features.sql`). Otomasyon kuralları canlıda çalışamaz.
- `sso_states` yok (`004_add_enterprise_features.sql`). SSO girişi canlıda çalışamaz.
- `001_add_indexes.sql`'deki sipariş ve kullanıcı indeksleri yok. Performans işinde ele alınacak.
- Mobil migration'lar (`lib/features/mobile/migrations`) hiçbir deploy betiğinde değildi; production'a elle uygulanmışlar. Migration defteri PR'ı ile deploy yoluna alındı.
- PITR penceresi 6 saat. Ayrıntı: `docs/runbooks/backup-restore.md`.

## Durum

Durum değerleri: ⬜ başlamadı · 🔄 sürüyor · ✅ birleşti · ⏸ dış bağımlılık bekliyor

### Faz 0: Zemin

| İş | Durum | Not |
|---|---|---|
| Yerel değişikliklerin ayıklanması | ✅ | Hepsi `backup/local-2026-10-14` ve `backup/stash-2026-10-06` dallarında. Çoğu #69 ve ölü kod temizliğiyle aşıldı; taşınacak bir şey çıkmadı. |
| PR #76 (Claude Sonnet 5.5) | ✅ | CI ve Vercel yeşil, birleşti. |
| Temel test ölçümü | ✅ | Yukarıda. |
| Yol haritası ve AUDIT notu | ✅ | #77 |

### Faz 1: Güvenilirlik ve güvenlik

| İş | Durum | Not |
|---|---|---|
| Hata izleme (Sentry, `instrumentation.ts`), gerçek `/api/ready` | 🔄 | #80. Canlı için Sentry DSN gerekiyor. |
| 26 entegrasyon betiğinin sıfır veritabanında CI kapısına alınması | 🔄 | #79. GitHub-hosted runner hesapta kullanılamadığı için self-hosted Mac'te. Playwright smoke testi sonra. |
| Yedekleme ve geri yükleme runbook'u, prova; migration defteri ve kapsama testi | 🔄 | `docs/runbooks/backup-restore.md`, `schema_migrations`, `npm run db:status` |
| Düz reset token eşleşmesinin kaldırılması, CSP, SSO sırlarının şifrelenmesi | 🔄 | #78. Parola politikası zaten 10 karakter ve tek doğrulayıcıydı; mobil JWT fallback'i production'da zaten hata veriyor. |
| İki adımlı doğrulama (TOTP) ve kurtarma kodları | 🔄 | Web girişi ve Hesabım ekranı. Saha uygulaması kod soramadığı için 2FA açık hesapları reddediyor; uygulamaya kod adımı eklemek ayrı bir iş. Rol bazında zorunlu tutma sonra. |
| Denetim kaydı: değiştirilemezlik, giriş ve dönem kapama olayları | 🔄 | Tek servis (`activity_logs`) zaten K5'te kurulmuştu. Bu iş: 051 migration'ı ile kayıtlar yalnız eklenebilir; web ve mobil girişler, dönem kapama kaydediliyor; yetim `/api/tenant/activity` silindi. |
| Postgres RLS ve firma izolasyonu testi | ⬜ | |
| Yük testi ve Web Vitals | ⬜ | |

### Faz 2: Türkiye yasal uyumu

| İş | Durum | Not |
|---|---|---|
| Fatura alan modeli (seri, numara, satır KDV'si, tevkifat) ve firmanın yasal kimliği | 🔄 | Fatura modeli 047'de zaten vardı (keşif raporu yanılmıştı). Bu iş: yasal kimlik (Ayarlar → Fatura), GİB numara serisi, tevkifat ve istisna, UBL-TR üretici. Tasarım: `docs/superpowers/specs/2026-10-14-e-belge-design.md` |
| `EInvoiceProvider`, sahte sağlayıcı, gönderim kuyruğu, ekran durumları | 🔄 | Kesmede e-Fatura/e-Arşiv ayrımı, RNK/RNA serileri, kuyruk (gönder → sorgula → kabul/ret, hata ve yeniden deneme), iptal kuralları, XML indirme, müşteri fatura bilgileri. Gerçek entegratör seçilince yalnızca bir adaptör yazılacak. |
| Gerçek entegratör adaptörü | ⏸ | |
| Tekdüzen hesap planı, otomatik yevmiye, defter bazlı bilanço; hesap, yevmiye ve mizan ekranları | 🔄 | Satış (120/600/601/391, tevkifatlı), tahsilat (100/101/102/108), iptal ve silinen tahsilat ters kaydı, KDV kayıtları, mizan ve yevmiye ekranı. Defter bazlı bilanço ve gider kayıtları sonraki adım. |
| KDV dönem özeti (beyanname için) | ⬜ | **Ba/Bs kaldırıldı:** 565 Sıra No'lu VUK Genel Tebliği (RG 25.09.2024) ile Eylül 2024'ten itibaren Ba/Bs bildirimi yok; bu madde rapordan çıkarıldı. Kalan iş: muhasebeciye oran bazında satış matrahı/KDV, tevkifat ve indirilecek KDV özeti. |
| Banka ekstresi ayrıştırıcıları (CSV, MT940, OFX) | 🔄 | Dosya yükleme, önizleme, tekrar yüklemede mükerrersiz ve eşleşmeyi koruyan içe aktarma. Bankadan otomatik çekme (açık bankacılık) banka sözleşmesi gerektirir. |
| TCMB kur servisi ve tarihli kur tablosu | 🔄 | `exchange_rates`, günlük cron (Hobby'de çalışır), teklifte "TCMB'den al". Faturaya kur, e-Belge gönderimi birleşince eklenecek. |
| Bordro köprüsü (yasal alanlar ve dışa aktarım) | ⬜ | |
| KVKK: veri sahibi talepleri, saklama ve imha, silme akışı, rıza defteri | 🔄 | Başvuru defteri (30 gün), veri dökümü, anonimleştirme (faturalar korunur), saklama belgesi `docs/kvkk.md`; günlük temizlik cron'u canlıda ilk kez çalışacak. Otomatik imha kuralı firma kararı bekliyor. |

### Faz 3: ERP derinliği

| İş | Durum | Not |
|---|---|---|
| Toplu içe aktarma sihirbazı (müşteri, tedarikçi, ürün, stok) | 🔄 | Müşteri listesi: CSV, otomatik sütun eşleme, kuru çalıştırma önizlemesi, VKN/e-posta/telefonla mükerrersiz, boş alan tamamlama. Tedarikçi ve ürün sonraki adım. |
| Teklif isteği (RFQ) e-postası; SMS kanalı | ⬜ | |
| Müşteri portalı (sihirli bağlantıyla giriş) | ⬜ | |
| Ekipman bakımı ve fason üretim | ⬜ | |
| Stok maliyet yöntemi (ağırlıklı ortalama, FIFO) | ⬜ | |
| Özel alanlar ve pivot rapor | ⬜ | |
| `time_entries` tablosunun montaj ve servis işlerine bağlanması | ⬜ | |
| Genel API ve imzalı webhook'lar (öncelik dışı) | ⬜ | |

### Faz 4: Kullanım kalitesi

| İş | Durum |
|---|---|
| Sayfa başlığı standardı (`PageHeader`); iç içe `<main>` ve çift `<h1>` düzeltmesi | ⬜ |
| Etiketsiz alanlar; CI'da axe testi | ⬜ |
| Dokunmatik montaj takvimi | ⬜ |
| Mağaza yayını | ⏸ |
