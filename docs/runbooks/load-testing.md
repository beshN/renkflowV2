# Yük ve dayanıklılık testleri

Bu testler **yalnız yerelde**, sentetik veriyle çalışır. Betikler uzak bir sunucuya ya da adı
`_migration_test` ile bitmeyen bir veritabanına bağlanmayı reddeder. Production'a asla yük testi
yapılmaz.

## Otomatik senaryolar (her PR'da CI'da)

`npm run test:integration` sıfırdan kurulan bir PostgreSQL üzerinde bütün `scripts/test-*.ts`
betiklerini çalıştırır. Gerçek fabrika yükünü taklit eden betikler:

| Betik | Ne sınar |
|---|---|
| `test-factory-stress.ts` | 24 sipariş aynı anda; siparişe çevirmede çift tıklama; yenileme sonrası tekrar gönderilen iş emri; aynı çubukların iki kesim planına girmemesi; kesim planı iptali; eksik motor yüzünden bekleyen kesim; 4 ustanın aynı anda kesim, montaj, kalite ve paketleme yürütmesi; kalite reddi ve yeniden işleme; atanmamış işçinin reddedilmesi; işlem ortasında veritabanı bağlantısının kopması; aynı ürünün iki masadan aynı anda sevki. Sonunda stok defteri, bakiyeler, partiler ve üretim kayıtları birbirini tutmalı. |
| `test-concurrency-isolation.ts` | Paralel tahsilatlar, aynı faturanın paralel kesilmesi, paralel stok çıkışı ve transferleri, firma izolasyonu. |
| `test-api-token.ts` | API token'ı, iki adımlı doğrulama ve oturum iptali. |

## Yük testi (elle, yerelde)

```bash
# 1. Yerel PostgreSQL (55452) ve izole yük veritabanı
RENKFLOW_TEST_DB_PORT=55452 npx tsx scripts/dev-database.ts &
# veritabanını oluşturun: CREATE DATABASE renkflow_load_migration_test;
L=postgres://postgres:renkflow-local-only@127.0.0.1:55452/renkflow_load_migration_test
printf "DATABASE_URL_UNPOOLED=$L\nDATABASE_URL=$L\n" > /tmp/load.env
ALLOW_LOCAL_DATABASE=1 npx tsx scripts/deploy-database.ts --env-file=/tmp/load.env

# 2. Sentetik veri: 1 yoğun fabrika (3 000 müşteri, 8 000 sipariş, 100 kullanıcı) + 40 arka plan firması
LOAD_DATABASE_URL=$L LOAD_USERS_FILE=/tmp/load-users.json npm run load:seed

# 3. Production build, yük veritabanına bağlı
npm run build
DATABASE_URL=$L ALLOW_LOCAL_DATABASE=1 AUTH_TRUST_HOST=true AUTH_URL=http://127.0.0.1:3230 \
  AUTH_SECRET=<yerel-rastgele> ALLOW_INSECURE_HTTP=1 PORT=3230 npx next start -H 127.0.0.1 &

# 4. 10 / 50 / 100 eş zamanlı kullanıcı, her seviye 30 sn
LOAD_BASE_URL=http://127.0.0.1:3230 LOAD_DATABASE_URL=$L LOAD_USERS_FILE=/tmp/load-users.json \
  LOAD_LEVELS=10,50,100 LOAD_SECONDS=30 npm run load:run
```

Her sanal kullanıcı gerçek giriş akışıyla (CSRF + credentials) oturum açar ve kendi rolünün
açabildiği ekranları kullanır: sipariş listesi ve detayı, müşteriler, arama, ana sayfa, üretim,
depo. Ofis ve sahip rolleri ayrıca kayıt da oluşturur. Tıklamalar arasında 0,2–0,8 sn düşünme
süresi var. Rapor, her uç nokta için p50/p95/p99 gecikmeyi, hata oranını, saniyedeki istek
sayısını ve veritabanı etkinliğini (aktif bağlantı, commit, büyük tablolarda tam tarama) verir.
Sorgu bazında maliyet için yerel kümede `pg_stat_statements` açılabilir
(`ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'`, ardından yeniden başlatma).

## Sonuçlar (2026-10-19, MacBook Air M-serisi, tek `next start` süreci, havuz 10 bağlantı)

Veri: 41 firma, 128 000 sipariş, 264 000 kalem, 43 000 müşteri. Ölçülen fabrikada 8 000 sipariş var.

| Eş zamanlı kullanıcı | İstek/sn | Hata | p95 (tümü) |
|---|---|---|---|
| 10 | 18 | %0 | 140 ms |
| 50 | 48 | %0 | 1,2 sn |
| 100 | 42 | %0 | 4,0 sn |

- 10 kullanıcıda her ekran p95 200 ms'nin altında.
- Doyum noktası tek Node süreci ve 10 bağlantılık havuz. Vercel'de istekler yatay ölçeklenen
  örneklere dağılır (örnek başına 3 bağlantı); bu yerel ölçüm tek örneğin üst sınırını gösterir.
- **En büyük maliyet sipariş listesi.** `getOrders`, firmanın tüm siparişlerini döndürüyor:
  8 000 siparişte 3,27 MB. Sorgu tek başına ~15 ms; asıl yük, Node'un bu veriyi ayrıştırıp JSON'a
  çevirmesi. Bu uç çıkarılınca 100 kullanıcıda istek/sn 34'ten 64'e çıktı, p95 5,2 sn'den
  2,6 sn'ye indi.
- **Üretim panosu** istek başına 30 sorgu çalıştırıyor (21'i paralel). Yük altında en yavaş ekran
  bu (100 kullanıcıda p50 3,8 sn).
