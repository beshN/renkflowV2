# Ürün konfigüratörü (fuar kiosku · telefon · web)

Hedef adres: `https://configurator.renkaluminyum.com` · Fuar kiosku: `https://configurator.renkaluminyum.com/fair/<kod>` (ör. `/fair/rt2027`).

Konfigüratör RenkFlow'un içinde çalışır ve aynı veritabanını kullanır. Ayrı alan adında yalnızca konfigüratör sunulur; giriş, panel ve diğer API'ler bu alan adından erişilemez.

## Modlar ve akış

| Mod | Adres | Ne yapar |
| --- | --- | --- |
| Kiosk | `/fair/<kod>` | Dokunmatik büyük ekran. Karşılama → ürün → 3D yapılandırma → liste → "Telefonumda devam et" → QR. Kişisel bilgi istenmez. Hareketsizlikte sıfırlanır. |
| Telefon | `/c/<token>` | QR veya e-postadaki bağlantı. Tasarım yüklenir; "Fiyat teklifi al" ve "Düzenlemeye devam et" seçenekleri. |
| Web | `/` | Fuar dışı ziyaretçi. İlk ürün eklenince tasarım kalıcı bir `/c/<token>` bağlantısına kaydedilir. |

Üç mod aynı ürün listesini (`lib/features/fair/products.ts`), aynı tasarım modelini (`lib/features/fair/design.ts`) ve RenkFlow'daki aynı 3D bileşenleri (`ProductConfigurator`, `AwningConfigurator`) kullanır. Diller: İngilizce, Almanca, Türkçe (`lib/features/fair/i18n.ts`).

## Veri

Migration `079_product_configurator.sql`:

- `fairs`: fuar adı, kodu, tarihleri, varsayılan dili, aktif/pasif durumu, kampanya metni, kaynak bilgisi. Fuarlar koddan değil panelden yönetilir.
- `fair_designs`: kalıcı tasarım bağlantıları. 128 bit rastgele token, kişisel veri yok. Fuar kiosktan geldiyse fuar bilgisi otomatik eklenir.
- `fair_quotes`: teklif talepleri (`TT-YYYY-000001`). Müşteri bilgisi, tasarımın gönderildiği andaki kopyası, durum (Yeni → İnceleniyor → Teklif hazırlandı → Gönderildi → Kabul edildi / Reddedildi), KVKK onay sürümü, pazarlama izni (varsayılan kapalı), e-posta gönderim sonucu.

Her teklif talebi RenkFlow'da kaynağı **Fuar** ya da **Web** olan bir potansiyel müşteri kaydı da açar (`renkflow-lead.server.ts`). Konfigüratör RenkFlow'un içinde olduğu için bu bir API çağrısı değil, aynı veritabanında aynı işlemde yapılan bir kayıttır. Başka bir sisteme aktarım gerekirse aynı imzayla yeni bir fonksiyon eklenir.

## Satış ekibi

RenkFlow → Potansiyel müşteriler → **Konfigüratör talepleri** (`/leads/fuar`), `crm` yetkisiyle:

- Teklif talepleri: numara, müşteri, firma, iletişim, fuar kaynağı, ürünler, ölçüler, renkler, motor/LED ve diğer özellikler, tarih, durum, e-posta sonucu, 3D inceleme, tasarım bağlantısı, potansiyel müşteri kaydı. Duruma ve fuara göre filtre.
- Fuarlar: oluşturma/düzenleme, aktif/pasif, her fuarın getirdiği tasarım ve teklif sayısı, kiosk adresi ve QR'ı.

## Çevrimdışı çalışma

Kiosk sayfası bir service worker (`public/configurator-sw.js`) kaydeder. İlk açılışta uygulama kodu, sayfa ve tüm 3D modülleri cihazda önbelleğe alınır. İnternet yokken ürün seçimi, 3D modeller, animasyonlar, ölçü/renk değişikliği, tasarım oluşturma, QR üretimi ve ekran sıfırlama çalışır. Kiosk ekranı **en az bir kez internetle açılmış olmalıdır.**

Kioskta oluşturulan tasarımlar önce IndexedDB'deki kuyruğa yazılır. Ekranı sıfırlamak, sayfayı yenilemek veya elektrik kesintisi kuyruğu silmez; bağlantı gelince kuyruk sunucuya gönderilir. Gönderim tekrarlansa da kayıt çoğalmaz (token bazlı, ilk gelen kaydeder).

**QR kod internetsiz senaryoda:** Tasarımın kendisi QR'daki bağlantının `#d=` kısmına sıkıştırılmış olarak gömülür. Bu kısım tarayıcıdan sunucuya hiç gönderilmez. Böylece kiosk henüz eşitlememiş olsa bile telefon tasarımı QR'dan okuyup açar ve sunucuya kendisi kaydeder. Fuar bilgisi de bu kayda eklenir. Bunun için **telefonun kendi internet bağlantısı (mobil veri) gerekir.** Telefon da internetsizse sayfa açılmaz; bu durum desteklenmez. Önizleme görselleri QR'a sığmadığı için telefon 3D görünümü kendisi oluşturur.

Service worker yalnızca HTTPS'te (veya `localhost`'ta) çalışır.

## Kurulum

1. Veritabanı: `npm run db:deploy` (079 uygulanır).
2. Vercel ortam değişkenleri:
   - `FAIR_TENANT_ID`: Renk Alüminyum'un `tenants.id` değeri. Boşsa konfigüratör kapalıdır.
   - `FAIR_HOSTS=configurator.renkaluminyum.com`
   - `FAIR_PUBLIC_URL=https://configurator.renkaluminyum.com` (e-postadaki bağlantılar)
   - `RESEND_API_KEY` ve `FAIR_EMAIL_FROM` (ör. `Renk Alüminyum <teklif@renkaluminyum.com>`). Gönderen alan adı Resend'de doğrulanmış olmalı. Anahtar yoksa talep yine kaydedilir; müşteriye e-postanın gönderilemediği açıkça gösterilir, panelde "E-posta servisi yapılandırılmamış" yazar.
3. Alan adı: `configurator.renkaluminyum.com` Vercel projesine eklenir, DNS'te CNAME kaydı Vercel'e yönlendirilir.
4. Panelden fuarı oluşturun (ör. kod `rt2027`, varsayılan dil `en`).
5. Kiosk cihazı: Chrome'u kiosk modunda açın (`chrome --kiosk https://configurator.renkaluminyum.com/fair/rt2027`). İlk açılışı internetle yapın ve 1–2 dakika bekleyin. Ekrandaki tam ekran düğmesi de kullanılabilir.

## Yapılandırılabilir kurallar

`lib/features/fair/products.ts`:

- **Ölçü sınırları:** WINMAX kendi modelindeki sınırları kullanır (2500–15000 × 1500–5000 × 2200–4500 mm). Diğer ürünlerde 3D modelin görsel aralığı geçerlidir. Renk'in onayladığı üretim sınırları `limits` alanına yazılınca hem cihazda hem sunucuda uygulanır.
- **Tahrik/kontrol:** WINMAX'ta UBESER kumandalı / kumanda + duvar butonu seçenekleri vardır. Diğer ürünlerin ticari kontrol seçenekleri kaynaklarda belgelenmediği için uydurulmamıştır. `controls` listesine eklenince ilgili ekranda sorulur.

Kiosk süreleri `KIOSK_TIMING` içindedir: 90 sn hareketsizlik → "Hâlâ orada mısınız?", 20 sn sonra sıfırlama; QR ekranı 180 sn.

## Testler

### Tarayıcıda kiosk simülatörü

Konfigüratör alan adında `/simulator?fair=rt2027`, RenkFlow içinde `/configurator/simulator?fair=rt2027` adresi aktif fuarı bir kiosk kasasının ekranında açar. `fair` verilmezse `rt2027` kullanılır. Yatay (1920 × 1080) ve dikey (1080 × 1920) görünüm, tam ekran ve yeni ziyaretçi için başa dönme kontrolleri vardır. Yön değiştirmek mevcut tasarımı korur; başa dönmek ekranı yeniden açar.

Ekran aynı kaynaktan açılan gerçek fuar sayfasıdır: ürünler, 3D, QR bağlantıları ve teklif kayıtları aynı ortamda çalışır. Ayrı bir örnek veri veya sahte işlem katmanı yoktur. Fareyle ya da dokunarak kullanılabilir; fiziksel cihazın performansını veya dokunma donanımını taklit etmez.

- `__tests__/lib/fair-site.test.ts`: alan adı yönlendirmesi, tasarım modeli, QR aktarımı (çok ürünlü bağlantı < 900 karakter), teklif girdisi, e-posta şablonu.
- Uçtan uca kabul senaryosu (üretim derlemesi + yerel PostgreSQL + Playwright): kiosk → WINMAX ölçü/renk/motor/LED/animasyon → ikinci ürün → QR (görüntüden çözülerek) → telefon → düzenleme → teklif → veritabanı → panel → durum değişikliği; hareketsizlikte sıfırlama; çevrimdışı kiosk (yenileme, 3D, QR, sıfırlama, kuyruk), internetsiz kiosk tasarımının telefondan açılması ve geri gelen bağlantıda eşitleme.
