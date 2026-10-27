# Fuar konfigüratörü

Fuar ziyaretçisi QR kodu okutur → ürünü seçer → ölçü ve rengi 3D olarak ayarlar (Renkflow'daki `ProductConfigurator`) → iletişim bilgisini ve KVKK onayını bırakır. Her gönderim:

- kaynağı **Fuar** olan bir potansiyel müşteri (`leads`, `POT-…`) açar; sorumlusu boştur,
- seçilen ürünleri, önizleme görsellerini ve onay kaydını `fair_requests` tablosuna yazar (migration `079_fair_requests.sql`).

Satış ekibi talepleri **Potansiyel müşteriler → Fuar talepleri** (`/leads/fuar`) ekranında görür, 3D görünümü inceler ve fiyatı ilgili kayıttan teklife geçerek verir. Aynı ekranda stand için QR kodu PNG olarak indirilebilir.

## Kurulum

1. Veritabanı: `npm run db:deploy` (079 migration'ı uygulanır).
2. Ortam değişkenleri (Vercel → Project → Environment Variables):
   - `FAIR_TENANT_ID`: taleplerin düşeceği firmanın `tenants.id` değeri. Boşsa fuar sitesi kapalıdır (404).
   - `FAIR_HOSTS`: yalnızca fuar sitesini sunan alan adları, virgülle (ör. `fuar.renkaluminyum.com`).
   - `FAIR_EVENT_NAME` (isteğe bağlı): her talebe yazılan etkinlik adı (ör. `Yapı Fuarı 2026`).
3. Alan adı: Vercel projesine `FAIR_HOSTS` içindeki alan adını ekleyin, DNS'te CNAME kaydını Vercel'e yönlendirin.

Fuar alan adında yalnızca `/` (fuar sayfası), `/api/v1/public/fair` ve statik dosyalar sunulur; giriş, panel ve diğer API'ler 404/yönlendirme verir. `FAIR_TENANT_ID` tanımlıyken sayfa ana alan adında `/fuar` adresinden de açılır (deneme için).

## QR bağlantı parametreleri

- `?urun=pergola`: doğrudan o ürünün tasarım ekranını açar (ürün kodları: `lib/features/product-3d/catalog.ts`).
- `?e=salon-3`: stand/salon gibi bir kaynak etiketi; `FAIR_EVENT_NAME` yoksa talebe yazılır.

## Sınırlar

- Talep başına en fazla 8 ürün; önizleme görselleri 480 px JPEG'e küçültülür.
- IP başına 10 dakikada 60 gönderim (fuar salonunda ortak Wi-Fi düşünülerek gevşek tutuldu) ve gizli bir bot tuzağı alanı.
- Aynı telefonla gelen tekrarlar engellenmez; satış ekibi kayıtları panelde birleştirir.
