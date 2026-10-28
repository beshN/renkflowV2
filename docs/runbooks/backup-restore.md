# Yedekleme ve geri yükleme

Son doğrulama: 14 Ekim 2026. Production sayılarını ve politikayı değiştiren her işten sonra bu belge güncellenmeli.

## Ortam

| | Değer |
|---|---|
| Neon projesi | `renkflow-production` (`little-rice-27655234`), AWS eu-central-1, PostgreSQL 17 |
| Production dalı | `production` (`br-broad-mouse-b2cu9m95`) |
| Anlık geri dönüş (PITR) penceresi | **6 saat** (`history_retention_seconds = 21600`) |
| Boyut | 16 MB, 155 tablo (1 firma, 3 kullanıcı, 1 sipariş; 14 Ekim) |
| Uygulama | Vercel `renkflowv2`, `DATABASE_URL` ve `DATABASE_URL_UNPOOLED` |

**Risk:** PITR penceresi yalnızca 6 saat. Fark edilmesi 6 saatten uzun süren bir veri hatası, PITR ile geri alınamaz. O durumda elle açılmış yedek dallar ve son 14 günün günlük mantıksal dökümü (Yedekler 3, Geri yükleme C) işe yarar. Gerçek veri girişi başlamadan önce aşağıdaki "Açık işler" bölümüne bakın.

## Yedekler

0. **`db:deploy` yalnızca güncel `main` checkout'undan çalıştırılır.** 14 Ekim'de bir kez özellik dalından çalıştırıldı ve henüz birleşmemiş 054 production'a gitti. Zararsızdı (yalnız boş sütun ekliyordu), ama sıra bozuldu. Önce `git switch main && git pull` ve `npm run db:status`.
1. **Migration öncesi dal (zorunlu).** `npm run db:deploy` çalıştırmadan önce production'dan bir dal açılır. Ad biçimi: `backup-before-<iş>-<YYYY-MM-DD>`. 13 Ekim itibarıyla bu dallar var: `backup-before-kanban-050-20261013`, `backup-before-049-2026-10-13`, `backup-before-mobile-2026-10-13`, `yedek-production-2026-10-11-goc-040-048-oncesi`, `backup-before-029-036-2026-10-08`.
2. **PITR.** Son 6 saat içindeki herhangi bir ana dönülebilir.
3. **Günlük mantıksal döküm (`/api/cron/backup`).** Vercel Cron her gün 01:30 UTC'de (04:30 İstanbul; Hobby'de o saat içinde herhangi bir an) yalnız Production deploy'unda çalışır. `public` şemasındaki her tablo (görünümler hariç, `schema_migrations` dahil) tek bir `REPEATABLE READ READ ONLY` işlemde, yani aynı anlık görüntüden, `COPY (SELECT … ) TO STDOUT WITH (FORMAT csv, HEADER true)` ile akıtılır, gzip'lenir, `BACKUP_ENCRYPTION_KEY` tanımlıysa AES-256-GCM ile şifrelenir ve uygulamanın **özel Vercel Blob** deposuna `backups/<YYYY-MM-DD>/<tablo>.csv.gz.enc` (anahtarsız: `.csv.gz`) olarak yazılır. En son `backups/<YYYY-MM-DD>/manifest.json` yazılır (sürüm 2): tablolar, sütunlar, satır sayıları, bayt boyutları, `schema_migrations` listesi, bağımsız sekansların değerleri, başlangıç/bitiş zamanı, `commitSha` (`VERCEL_GIT_COMMIT_SHA`), `complete` ve `encryption` (`{ alg: "aes-256-gcm", keyId, format: "RFBK1" }` ya da `null`). Manifest şifrelenmez, satır verisi içermez.
   - 8 MB'a kadar olan dosya tek Blob `put` ile, daha büyüğü COPY → gzip → şifreleme akarken çok parçalı (multipart) yükleme ile gönderilir; hiçbir tablo belleğe bütün olarak alınmaz.
   - Boş tablolar için dosya yüklenmez (manifest'te `rows: 0`, `key: null`); Blob işlem kotası Hobby'de sınırlı.
   - Zaman bütçesi: fonksiyon sınırı 300 sn. 240. saniyeden sonra yeni tabloya başlanmaz, 270. saniyede süren tablo kesilir; manifest `complete: false`, `stoppedReason`, `missingTables` ile yazılır ve uç 500 döner (zamanlayıcının hata bildirimi için).
   - Aynı gün ikinci çalıştırma, tam bir yedek varsa hiçbir şey yapmaz; yarım kalmış bir yedeği silip yeniden alır. Eş zamanlı çalıştırmalar advisory lock ile engellenir.
   - Saklama: tam bir yedekten sonra 14 günden eski `backups/<tarih>/` klasörleri silinir. Eksik yedekler eski yedekleri silmez.
   - Depo herkese açık olduğu için döküm GitHub'a (Actions artifact dahil) **hiç** gitmez; yalnız Blob'da, `access: "private"` ile durur ve `/api/storage/content` üzerinden de okunamaz (o uç kiracı belgelerine göre yetki denetler).
   - **Şifreleme.** Döküm parola özetleri, oturum/bağlantı anahtarı özetleri ve mühürlü MFA sırları dahil her tabloyu içerir; gzip şifreleme değildir. Bu yüzden her dosya uygulamada, Blob'un kendi disk şifrelemesinden ve `BLOB_READ_WRITE_TOKEN`'dan bağımsız bir anahtarla şifrelenir (`apps/web/lib/db/backup-crypto.ts`): dosya başına rastgele 12 baytlık IV, dosya düzeni `RFBK` · sürüm · anahtar kimliği · IV · şifreli veri · 16 baytlık doğrulama etiketi. Başlık ve dosyanın depolama yolu doğrulanır; bir dosya başka bir tablonun/günün dosyasıyla değiştirilemez. Anahtar kimliği = `sha256(anahtar)`'ın ilk 8 hex karakteri.
     - **Anahtar üretimi:** `openssl rand -base64 32`. Vercel'de yalnız Production ortamına `BACKUP_ENCRYPTION_KEY` (sensitive) olarak girin; `npm run env:check` biçimi bozuk bir anahtarı hata, eksik anahtarı uyarı sayar. Anahtar yoksa yedek eskisi gibi yalnız gzip'li yazılır, cron uyarı loglar ve manifest `encryption: null` der.
     - **İkinci kopya çevrimdışı:** Vercel/GitHub hesaplarına bağlı olmayan şirket parola kasası **ve** (tercihen) ofis kasasında mühürlü zarfta basılı kopya; üzerine anahtar kimliği yazılır. Vercel hesabı kaybedilse de yedek açılabilmeli.
     - **Anahtar kaybolursa** o anahtarla şifrelenmiş hiçbir yedek açılamaz (kimse çözemez). Hemen yeni anahtar üretip Vercel'e girin ki bir sonraki gece yedeği yeniden kullanılabilir olsun; arada Neon PITR ve yedek dallarına güvenin. Olayı `docs/PROGRESS.md`'ye yazın.
     - **Döndürme:** yeni anahtarı girin; yeni yedekler yeni kimliği taşır. Eski anahtarı, yazdığı son yedek 14 gün sonra silinene kadar çevrimdışı saklayın.
   - Erişim yine Blob deposunun özel olmasına ve `BLOB_READ_WRITE_TOKEN`'ın gizliliğine dayanır; token'ı yalnız geri yükleme yapan kişi, yerel env dosyasında tutar. Şifreleme anahtarı token ile aynı yerde (aynı env dosyasında) kalıcı tutulmaz.

Yedek dallarına compute bağlı değildir; doğrudan sorgulanamazlar. Geri yüklemenin ilk adımı bu yüzden compute bağlamaktır.

## Geri yükleme

### A. Yanlış bir migration veya toplu veri hatası (son 6 saat içinde)

1. Yazmaları durdurun. Vercel Production'da `PUBLIC_SITE_MODE=coming-soon` yapıp yeniden deploy edin: çalışma alanı kapanır, yalnız tanıtım sayfası ve giriş açık kalır (`apps/web/docs/LAUNCH-RUNBOOK.md`). Hata koddan geliyorsa ek olarak son çalışan deploy'a **Instant Rollback** yapın.
2. Neon konsolunda `production` → **Restore** → hatadan önceki zaman. Neon, geri yüklemeden önce mevcut durumu `production_old_<zaman>` adıyla saklar; bu adım geri alınabilir.
3. Doğrulayın:
   - `npm run db:status -- --env-file=<production env dosyası>`: tüm migration dosyaları kayıtlı olmalı.
   - Aşağıdaki sayım sorgusu beklenen sayıları vermeli.
   - `/api/health/ready` 200 dönmeli.
4. Uygulamayı açın. Ne olduğunu `docs/PROGRESS.md`'ye yazın.

### B. 6 saatten eski bir hata

1. Hatadan önceki en yakın yedek dalı seçin.
2. O dala compute bağlayın: Neon konsolu → dal → **Add compute**.
3. Dalı doğrulayın: sayım sorgusu ve `db:status`.
4. İki seçenek var:
   - **Production'ı yedeğe döndürmek:** `production` → **Restore** → kaynak olarak yedek dal. Yedekten sonraki tüm yazmalar kaybolur.
   - **Yalnız kayıp tabloları almak:** yedek daldan `pg_dump --table=...` ile alıp production'a yükleyin. Ayrıntılı ve dikkat isteyen bir iştir.
5. A'daki 3. ve 4. adımlar.

### C. Günlük mantıksal dökümden geri yükleme

PITR penceresi dışındaysa ve uygun bir yedek dal yoksa. Döküm production'a doğrudan değil, **yeni bir Neon dalına** yüklenir; doğrulandıktan sonra A/B'deki gibi karar verilir. Betik: `apps/web/scripts/restore-backup.ts` (`npm run db:restore-backup`).

1. Uygun günü seçin. Production env'ini yerel bir dosyaya çekin (`BLOB_READ_WRITE_TOKEN` için; `apps/web/docs/vercel-deployment.md`), ör. `.env.vercel.production.local`. Manifest'e bakın: `complete: true` olmalı, `commitSha` hangi koddan alındığını söyler.
2. Hedef dal açın: Neon konsolu → `renkflow-production` → **Branches → Create branch**, ad `restore-<YYYY-MM-DD>`, kaynak `production` (şema hazır gelir; içindeki veri 4. adımda yedekle değiştirilir). Alternatif: aynı projede yeni, boş bir veritabanı; `db:deploy` onu sıfırdan kurar. Dala compute bağlayın ve **direct (pooler olmayan)** bağlantı dizesini alın; aşağıda `RESTORE_URL`. Ücretsiz plandaki dal sınırına dikkat (aşağıda).
3. Şemayı kurun (betik şema oluşturmaz, yalnız veri yükler). Güncel `main` checkout'undan, en az yedeğin `commitSha`'sı kadar yeni:
   ```sh
   cd apps/web
   DATABASE_URL_UNPOOLED="$RESTORE_URL" npm run db:deploy
   ```
4. Yükleyin:
   ```sh
   npm run db:restore-backup -- --date <YYYY-MM-DD> --target "$RESTORE_URL" --env-file=.env.vercel.production.local
   ```
   - Betik önce hedef şemayı denetler: yedekteki her tablo ve sütun hedefte olmalı, yedeğin `schema_migrations` listesindeki her dosya hedefte uygulanmış olmalı. Değilse hiçbir şeye dokunmadan durur.
   - Hedef, `--env-file`'daki veya kabuktaki `DATABASE_URL`, `DATABASE_URL_UNPOOLED` ya da `PRODUCTION_DATABASE_URL` ile aynı veritabanıysa (pooler/direct farkı yok sayılır) reddedilir; bilinçli olarak production'a yazmak için `--force-production` gerekir. Bunu A/B yolu yerine kullanmayın.
   - Eksik (`complete: false`) bir yedek yalnız `--allow-incomplete` ile yüklenir.
   - Şifreli yedek (`encryption` dolu) anahtar ister: kabukta / `--env-file`'da `BACKUP_ENCRYPTION_KEY` ya da `--key-file=<dosya>` (çevrimdışı kopya, aynı base64 metin; dosyayı iş bitince silin). Anahtarın kimliği manifest'teki `keyId` ile tutmazsa betik hedefe dokunmadan "Anahtar uyuşmuyor" diyerek durur. Bir dosyanın doğrulama etiketi tutmazsa (bozuk/değiştirilmiş) tüm yükleme geri alınır.
   - Plan yazdırıldıktan sonra `evet` yazmanız istenir; `--yes` bu soruyu atlar.
   - Tek işlemde: `SET LOCAL session_replication_role = replica` (tetikleyiciler ve FK denetimi kapalı), yedekteki tabloları tek `TRUNCATE … CASCADE` ile boşaltma, her tabloyu (gerekirse şifresi çözülmüş ve) gunzip edilmiş akıştan `COPY … FROM STDIN WITH (FORMAT csv, HEADER true)` ile açık sütun listesiyle yükleme, sütuna bağlı sekansları (serial/identity) `max(sütun)`'a, bağımsız sekansları manifest değerine ayarlama, son olarak her tablonun satır sayısını manifest ile karşılaştırma. Bir sayı tutmazsa işlem geri alınır. Hedefin kendi `schema_migrations` kaydı korunur (o dalın şemasını `db:deploy` kurdu).
   - `session_replication_role` ayarlanamazsa betik durur: hedef rolün `neon_superuser` (Neon'da dalı açan varsayılan `neondb_owner`) üyesi olması gerekir.
5. Doğrulayın: betiğin tablo/satır çıktısı, sayım sorgusu, `npm run db:status -- --env-file=<restore dalı env dosyası>`.
6. Karar: production'ı bu dala döndürmek için Neon'da `production` → **Restore** → kaynak `restore-<tarih>`; yalnız tablo almak için B.4'teki yol. Ardından A'daki 3. ve 4. adımlar.
7. Yerel env dosyasını silin; Blob'daki döküm 14 gün sonra kendiliğinden silinir.

Geri yükleme `npm run test:integration -- backup-restore` ile her CI çalışmasında prova edilir: iki firmalı tohum veri, cron ucu ile yedek (yerel depolama), `db:deploy` ile hazırlanmış ikinci veritabanına geri yükleme, tüm tabloların satır sayıları ve CSV'de zor değerler (tırnak, virgül, satır sonu, Türkçe harf, NULL / boş metin), firma ayrımı ve sekanslar; ayrıca şifreli yedek (akışla yükleme yolu dahil) `--key-file` ile geri yükleme, anahtarsız / yanlış anahtarla ve değiştirilmiş dosyayla denemelerin hedefi değiştirmeden reddi.

### Sayım sorgusu

```sql
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS tables,
       (SELECT count(*) FROM tenants) AS tenants, (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM customers) AS customers,
       (SELECT max(created_at) FROM orders) AS last_order,
       pg_size_pretty(pg_database_size(current_database())) AS size;
```

## Prova kaydı

| Tarih | Ne yapıldı | Sonuç |
|---|---|---|
| 14 Ekim 2026 | 13 Ekim 11:28'de production'dan açılan `verify-kanban-050-20261013` dalı salt okunur sorgulandı ve production ile karşılaştırıldı. | Birebir aynı: 155 tablo, 1 / 3 / 1 / 0, son sipariş 6 Ekim 19:30, 16 MB. |
| 14 Ekim 2026 | `backup-before-kanban-050-20261013` dalı sorgulanmak istendi. | Compute bağlı olmadığı için 404 döndü. Geri yüklemede compute bağlama adımı bu yüzden zorunlu. |
| 14 Ekim 2026 | `db:deploy`, yerel boş bir veritabanında iki kez çalıştırıldı. | Sıfırdan kurulum ve ikinci çalıştırma (idempotent) geçti; `db:status` 56/56. |

Prova her çeyrekte ve her büyük migration'dan önce tekrarlanmalı.

## Açık işler

- **Mantıksal dökümün production provası.** Mekanizma kuruldu (Yedekler 3, C). İlk production yedeği alındıktan sonra C adımlarıyla bir Neon dalına geri yüklenip "Prova kaydı"na yazılmalı; özellikle Neon'da `session_replication_role` yetkisi ve sürenin 300 sn bütçeye sığdığı doğrulanmalı. Veri büyüdükçe (manifest'teki `bytes`, cron yanıtındaki `seconds`) izlenmeli: bellek artık sınır değil (8 MB üstü dosyalar akışla yüklenir), toplam süre 240 sn'ye yaklaşırsa Pro planı veya tablo başına bölünmüş çalıştırma gerekir. Çok parçalı yüklemenin gerçek Vercel Blob üzerinde ilk büyük tabloyla çalıştığı production provasında doğrulanmalı.
- **Yedek şifreleme anahtarı.** `BACKUP_ENCRYPTION_KEY` üretilip Production'a girilmeli ve çevrimdışı kopyası saklanmalı (Yedekler 3); girilene kadar yedekler şifresiz.
- **PITR penceresi.** Neon'un ücretli planlarında 7 gün ve üzeri. Gerçek müşteri verisi girilmeden önce plan yükseltmesi değerlendirilmeli.
- **Yedek dalı sınırı.** Ücretsiz plan, proje başına dal sayısını sınırlıyor (şu an 9 dal). Eski yedek dalları, yeni yedek doğrulandıktan sonra elle silinmeli.
