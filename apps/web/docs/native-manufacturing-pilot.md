# RenkFlow native stok ve üretim pilotu

> Bu dosya arşivlenmiş ilk 012 migration pilotunu açıklar. `pilot:manufacturing` fiziksel lotları temsil etmediği için yazmadan durur; güncel doğrulama komutu `npm run test:production` olarak değişmiştir. Aşağıdaki komutlar tarihsel kayıttır. 014 ile eklenen makaslı tente, fiziksel toplu kesim/artık, usta, rework ve iletişim akışı için [güncel üretim platformu rehberini](production-platform.md) kullanın.

Bu modül ERPNext/Frappe çalıştırmaz ve ERPNext kaynak kodu içermez. Belge yaşam döngüsü,
değiştirilemeyen stok defteri, rezervasyon ve WIP yaklaşımı bağımsız RenkFlow koduyla
uygulanmıştır. İlk sürüm tek şirket ve web uygulaması içindir.

## Veri otoritesi

- Yeni stok gerçeği `stock_entries`, `stock_entry_lines` ve `stock_balances` tablolarıdır.
- `stock_movements` pilot boyunca yalnız karşılaştırma/uyumluluk amacıyla okunur; yeni akış
  bu tabloya yazmaz.
- Onaylanmış stok kayıtları düzenlenemez veya silinemez. Düzeltme, ters kayıt API'siyle
  yeni bir `REVERSAL` kaydı oluşturarak yapılır.
- Stok mutation komutları idempotency anahtarı taşır. Bakiye ve rezervasyon satırları
  `SERIALIZABLE` transaction ve satır kilitleriyle korunur.

## Pilot akışı

Önce bağlı veritabanını yazma yapmadan kontrol edin:

```sh
npm run db:check-manufacturing
```

Komut `.env.local` dosyasını okur, salt okunur transaction içinde eksik tabloları ve
stok/iş emri alanlarını listeler. Eksik şemada çıkış kodu 1 döner. Tabloların mevcut
olması pilotun tamamlandığı veya veri bütünlüğünün doğrulandığı anlamına gelmez.
Migration ve aşağıdaki yazma yapan pilotu **ayrı geliştirme/test veritabanında**
çalıştırın; yerel ortamın canlı veritabanına bağlı olabileceğini kontrol edin.

1. `012_native_manufacturing.sql` göçünü çalıştırın.
2. Mevcut bir RenkFlow siparişinin, tenant'ın ve işlemi yapacak kullanıcının UUID'sini seçin.
3. Ortam değişkenlerini tanımlayıp pilotu çalıştırın:

```powershell
$env:PILOT_TENANT_ID = '<tenant uuid>'
$env:PILOT_USER_ID = '<user uuid>'
$env:PILOT_ORDER_ID = '<order uuid>'
$env:NATIVE_INVENTORY_ENABLED = '1'
npm run db:migrate
npm run pilot:manufacturing
```

Komut idempotent anahtarlar kullanır. Şunları oluşturur:

- `PROF-AL-4040`: 40×40 mm, 6 m ticari boy, `0.85 kg/m` pilot değeri.
- `FG-DEMO`: bir adet mamul.
- `SCRAP-AL`: kg UOM'lu alüminyum hurda.
- `BOM-FG-DEMO` v1: bir mamul için 4 m profil.
- RAW, WIP, FINISHED, REUSABLE_REMNANTS, SCRAP ve REJECTED depoları.

Akış RAW'a 12 m mal kabul eder, 4 m rezerve eder, bu miktarı WIP'e taşır ve bir mamul
üretir. Tamamlamada WIP'ten gerçek 4 m tüketilir, FINISHED'a 1 adet mamul girer ve
0.05 m hurda için `0.0425 kg` hesaplanır. Üretimden önce kontrollü bir hata, stok
defterine yazıldıktan sonra tetiklenir; transaction geri alındığında hem bakiyenin değişmediği
hem de deneme defter kaydının kalmadığı doğrulanır. Sonuçta `rollbackAtomicityVerified: true`
dönmelidir.

Beklenen son bakiyeler:

| Kalem | Depo | Eldeki | Rezerve | Kullanılabilir |
|---|---|---:|---:|---:|
| PROF-AL-4040 | RAW | 8 m | 0 m | 8 m |
| PROF-AL-4040 | WIP | 0 m | 0 m | 0 m |
| FG-DEMO | FINISHED | 1 adet | 0 | 1 adet |
| SCRAP-AL | SCRAP | 0.0425 kg | 0 | 0.0425 kg |

## API özeti

- `POST /api/v1/inventory/stock-entries`
- `POST /api/v1/inventory/stock-entries/:id/reverse`
- `GET /api/v1/inventory/balances`
- `POST /api/v1/boms`
- `POST /api/v1/procurement/goods-receipts`
- `POST /api/v1/manufacturing/work-orders`
- `POST /api/v1/manufacturing/work-orders/:id/reserve`
- `POST /api/v1/manufacturing/work-orders/:id/transfer`
- `POST /api/v1/manufacturing/work-orders/:id/complete`
- `POST /api/v1/manufacturing/work-orders/:id/release`

Mevcut `POST /api/work-orders` yolu da isteğe bağlı `manufacturing` alanını kabul eder;
bakım/operasyon iş emirlerinin mevcut payload ve ekran sözleşmeleri değişmemiştir.

`NATIVE_INVENTORY_ENABLED=1` iken eski stok hareketi server action'ı yazmaya kapatılır.
Böylece eski ve yeni stok tabloları aynı anda otorite olamaz. Bayrak kapalıyken mevcut stok
ekranı çalışmaya devam eder; native mutation servisleri stok yazmayı reddeder.

## Pilot sonrası sınır

Satın alma talebi ve siparişi tabloları hazırlanmıştır; pilot yalnız doğrudan mal kabulü
çalıştırır. PDF AI çıktısı `document_extractions` içinde insan onaylı taslak olarak kalır
ve kendi başına stok hareketi oluşturamaz. Fiziksel artık lotları için `stock_lots`
hazırdır; kesim optimizasyonu ve yeniden kullanılabilir parça işleme pilot sonrası açılır.
