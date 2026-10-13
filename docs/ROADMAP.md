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
  - "Fatura" ayrı bir kayıt değil: sipariş ve tahsilattan türetilen bir görünüm. KDV toplamı 0, satıcı bilgisi sabit.
  - Yevmiye ve mizan kodu var, ama hiçbir işlem otomatik kayıt atmıyor ve arayüzde görünmüyorlar.
  - K8 (çubuk boyu karışımı) yapılmış. Bu konuda `AUDIT.md` eski.
  - Repoda konum verisi yok. KVKK açığı, veri sahibi talepleri (DSR) ile saklama ve imha işlerinde.
  - Parola alt sınırı 6 karakter. CSP yok. SSO `client_secret` düz metin. RLS fiilen etkisiz.

## Production'da bulunan açıklar (14 Ekim, salt okunur sorgu)

- `audit_logs` tablosu yok (`002_audit_logs.sql` hiç uygulanmamış). `AuditLogService` bu tabloya yazıyor; finans toplu işlemleri ve QR denetim kayıtları canlıda kayboluyor. Faz 1'deki denetim kaydı işinde ele alınacak.
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
| İki adımlı doğrulama (TOTP) ve kurtarma kodları | ⬜ | |
| Denetim kaydının tek servise indirilmesi; eksik olayların eklenmesi | ⬜ | |
| Postgres RLS ve firma izolasyonu testi | ⬜ | |
| Yük testi ve Web Vitals | ⬜ | |

### Faz 2: Türkiye yasal uyumu

| İş | Durum |
|---|---|
| Fatura alan modeli (seri, numara, satır KDV'si, tevkifat) ve firmanın yasal kimliği | ⬜ |
| `EInvoiceProvider`, UBL-TR üretimi, sahte sağlayıcı, gönderim kuyruğu | ⬜ |
| Gerçek entegratör adaptörü | ⏸ |
| Tekdüzen hesap planı, otomatik yevmiye, defter bazlı bilanço; hesap, yevmiye ve mizan ekranları | ⬜ |
| KDV beyanname taslağı ve Ba/Bs raporu | ⬜ |
| Banka ekstresi ayrıştırıcıları (CSV, MT940, OFX) | ⬜ |
| TCMB kur servisi ve tarihli kur tablosu | ⬜ |
| Bordro köprüsü (yasal alanlar ve dışa aktarım) | ⬜ |
| KVKK: veri sahibi talepleri, saklama ve imha, silme akışı, rıza defteri | ⬜ |

### Faz 3: ERP derinliği

| İş | Durum |
|---|---|
| Toplu içe aktarma sihirbazı (müşteri, tedarikçi, ürün, stok) | ⬜ |
| Teklif isteği (RFQ) e-postası; SMS kanalı | ⬜ |
| Müşteri portalı (sihirli bağlantıyla giriş) | ⬜ |
| Ekipman bakımı ve fason üretim | ⬜ |
| Stok maliyet yöntemi (ağırlıklı ortalama, FIFO) | ⬜ |
| Özel alanlar ve pivot rapor | ⬜ |
| `time_entries` tablosunun montaj ve servis işlerine bağlanması | ⬜ |
| Genel API ve imzalı webhook'lar (öncelik dışı) | ⬜ |

### Faz 4: Kullanım kalitesi

| İş | Durum |
|---|---|
| Sayfa başlığı standardı (`PageHeader`); iç içe `<main>` ve çift `<h1>` düzeltmesi | ⬜ |
| Etiketsiz alanlar; CI'da axe testi | ⬜ |
| Dokunmatik montaj takvimi | ⬜ |
| Mağaza yayını | ⏸ |
