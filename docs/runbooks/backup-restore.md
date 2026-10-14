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

**Risk:** PITR penceresi yalnızca 6 saat. Fark edilmesi 6 saatten uzun süren bir veri hatası, PITR ile geri alınamaz. O durumda yalnızca elle açılmış yedek dallar işe yarar. Gerçek veri girişi başlamadan önce aşağıdaki "Açık işler" bölümüne bakın.

## Yedekler

0. **`db:deploy` yalnızca güncel `main` checkout'undan çalıştırılır.** 14 Ekim'de bir kez özellik dalından çalıştırıldı ve henüz birleşmemiş 054 production'a gitti. Zararsızdı (yalnız boş sütun ekliyordu), ama sıra bozuldu. Önce `git switch main && git pull` ve `npm run db:status`.
1. **Migration öncesi dal (zorunlu).** `npm run db:deploy` çalıştırmadan önce production'dan bir dal açılır. Ad biçimi: `backup-before-<iş>-<YYYY-MM-DD>`. 13 Ekim itibarıyla bu dallar var: `backup-before-kanban-050-20261013`, `backup-before-049-2026-10-13`, `backup-before-mobile-2026-10-13`, `yedek-production-2026-10-11-goc-040-048-oncesi`, `backup-before-029-036-2026-10-08`.
2. **PITR.** Son 6 saat içindeki herhangi bir ana dönülebilir.
3. **Mantıksal döküm.** Henüz yok; aşağıdaki "Açık işler" bölümünde.

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

- **Mantıksal döküm.** Günlük `pg_dump --format=custom` alınıp Neon dışında saklanmalı (örneğin şifreli bir Vercel Blob ya da S3 kovası). Bunun için `DATABASE_URL_UNPOOLED`'ın bir CI sırrı olması gerekiyor; karar kullanıcıda.
- **PITR penceresi.** Neon'un ücretli planlarında 7 gün ve üzeri. Gerçek müşteri verisi girilmeden önce plan yükseltmesi değerlendirilmeli.
- **Yedek dalı sınırı.** Ücretsiz plan, proje başına dal sayısını sınırlıyor (şu an 9 dal). Eski yedek dalları, yeni yedek doğrulandıktan sonra elle silinmeli.
