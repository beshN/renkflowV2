# ADR 0003 — Araç filosu ve konum takibi

- Durum: kabul edildi (gece 2, Tur 3). Faz A yapıldı; Faz B'nin yalnız altyapısı yapıldı.
- Kapsam sahibi: firma sahibi ve yöneticiler. Başka hiçbir rol menüde, ekranda ya da API'de filoyu görmez.

## Bağlam

Renk Alüminyum montaj ve sevkiyat için kendi araçlarını kullanıyor. Bugün araç belgeleri (muayene, trafik sigortası, kasko, ruhsat), bakım ve yakıt kâğıtta ya da tabloda tutuluyor. Süresi geçen belge ceza ve sigortasız kaza riski taşıyor. Montaja hangi aracın gideceği takvimde görünmüyor.

Konum takibi isteniyor, ama henüz bir takip cihazı ya da sağlayıcı seçilmedi. Uydurma bir entegrasyon kurulmayacak.

## Karar

### Faz A — cihazsız filo yönetimi

| Tablo | İçerik |
|---|---|
| `vehicles` | plaka (firmada tekil, boşluksuz büyük harf), marka/model/yıl, tür, durum, sürücü (üye), km |
| `vehicle_documents` | muayene / trafik sigortası / kasko / ruhsat / diğer; numara, başlangıç, bitiş, tutar, isteğe bağlı dosya (kayıt platformu eki) |
| `vehicle_maintenance` | tarih, km, tutar, açıklama, sonraki bakım (tarih ve/veya km) |
| `vehicle_fuel` | tarih, litre, tutar, km, depo doldu mu |
| `vehicle_assignments` | araç ↔ montaj / sevkiyat / diğer; başlangıç–bitiş; aynı araç aynı anda iki işte ise çakışma uyarısı (engellemez) |

- **Uyarılar:** belge bitişine 30 / 15 / 7 gün kala ve süresi geçmişse uyarı verilir. Bakım için hem gün hem km eşiği kullanılır.
- **Motor:** bu hesapları `lib/features/fleet/engine.ts` (saf) yapar:
  - araç sağlığı (iyi / dikkat / kritik)
  - aylık yakıt + bakım maliyeti
  - km başına maliyet
- **Yetki:** Tur 1 matrisindeki `fleet` modülü kullanılır. Temel rollerde bu modül yalnız sahip ve yöneticide vardır. Bunun üstüne:
  - `ROUTE_ROLES['/vehicles']` sayfayı yalnız sahip ve yöneticiye açar.
  - Servis katmanı da her çağrıda aynı kontrolü yeniden yapar.

### Faz B — cihaz altyapısı (cihaz bağlanmadı)

| Tablo | İçerik |
|---|---|
| `vehicle_devices` | araca bağlı cihaz; jetonun yalnız SHA-256 özeti saklanır, jeton bir kez gösterilir; son görülme |
| `vehicle_positions` | zaman, enlem/boylam, hız, yön, kontak, km |
| `fleet_settings` | konum geçmişi saklama süresi; varsayılan 365 gün, "süresiz" seçilebilir |

`vehicle_positions` tablosunda (cihaz, zaman) tekildir; aynı nokta ikinci kez gelirse yok sayılır. Araç ve zamana göre index vardır.

**`POST /api/telemetry/ingest`** iki kontrolden geçer:
- Kimlik: cihaz başına imzalı jeton (`Authorization: Bearer …`). Oturum açmak gerekmez.
- Hız sınırı: cihaz başına dakikada 120 istek.

Gövdesi en çok 500 noktalık bir paket olur. Her nokta tek tek doğrulanır:
- koordinat aralığı;
- hız ≤ 300 km/s;
- en çok 5 dakika ileri tarihli;
- en çok 30 gün eski.

Geçersiz noktalar sayılıp reddedilir, geçerliler yazılır.

Güzergâh geçmişi, duraklar (≥ 5 dk) ve günlük km motorda hesaplanır ve birim testlidir:
- haversine mesafe;
- İstanbul gününe göre gruplama;
- 2 dakikadan uzun ya da 150 km/s'nin üzerinde mantıksız sıçramalar km'ye katılmaz.

**Harita:**
- Yeni bağımlılık eklenmedi; projede harita kütüphanesi yoktu.
- Küçük bir bileşen OpenStreetMap karolarını (Web Mercator karo hesabı) `<img>` olarak dizer, noktaları ve rotayı SVG ile çizer. Yakınlaştırma düğmesi ve "hepsini sığdır" vardır.
- Gerekçe: 3–10 araçlık bir filo için tam bir harita kütüphanesine (ör. Leaflet, ~40 KB) gerek yok. İhtiyaç büyürse Leaflet (BSD-2) eklenir.
- Lisans ve kullanım: [OSM karo kullanım politikası](https://operations.osmfoundation.org/policies/tiles/)
  - Atıf ("© OpenStreetMap katkıda bulunanlar") haritanın üzerinde, her zaman görünür.
  - Yalnız görünen karolar istenir: önden indirme yok, çevrimdışı yok.
  - Tarayıcının önbelleği ve Referer'ı korunur; uygulama `strict-origin-when-cross-origin` kullanıyor.
  - Politika ticari kullanımın her an kesilebileceğini söylüyor. Bu yüzden karo adresi `NEXT_PUBLIC_MAP_TILE_URL` ile değiştirilebilir. Üretimde ücretli ya da kendi barındırılan bir karo sunucusu önerilir.
- Cihaz yoksa harita sekmesi "Cihaz bağla" boş durumunu gösterir.
- KVKK: kişi takibi akışı kurulmadı (istenmedi). Yalnız konum geçmişi saklama süresi var. Süresi dolan noktalar zamanlanmış temizlikte silinir.

## Cihaz entegrasyonu: iki yol

### 1. Türk filo takip sağlayıcılarının API'si

İnceleme, 2026-10-09 tarihli web aramasıyla yapıldı.

- **Arvento:** herkese açık API dokümantasyonu bulunamadı.
  - Packagist'te üçüncü bir geliştiriciye ait, resmi olmayan bir PHP paketi var (`secgin/arvento-api-library`).
  - Ford Trucks ConnecTruck gibi kurumsal entegrasyonlar duyurulmuş; genel API'nin varlığı açık değil.
  - Erişim büyük olasılıkla sözleşmeyle ve talep üzerine veriliyor.
- **Mobiliz:** herkese açık API ya da geliştirici dokümantasyonu bulunamadı.
- **Diğerleri** (ör. sektördeki küçük sağlayıcılar): araştırılmadı, iddia edilmiyor.

Sonuç: hangi sağlayıcının API verdiği, ancak sağlayıcıya yazılı olarak sorularak öğrenilebilir. Sorulacaklar:
- kimlik doğrulama;
- konum uç noktası ya da webhook;
- hız sınırı;
- test ortamı;
- veri sahipliği ve dışa aktarım.

Bu yolun artısı: cihaz, montaj ve garanti sağlayıcıda. Eksisi: aylık abonelik, sağlayıcıya bağımlılık, belirsiz API.

### 2. Kendi cihazımız + küçük TCP→HTTP ağ geçidi

- Teltonika FMB serisi gibi yaygın cihazlar açık belgelenmiş bir protokol kullanır (Codec 8 / 8E). Kaynak: [Teltonika wiki](https://wiki.teltonika-gps.com/view/Codec).
- Akış:
  1. Cihaz IMEI'sini gönderir.
  2. Sunucu 0x01 ile kabul eder.
  3. Cihaz CRC-16'lı AVL paketleri gönderir.
  4. Sunucu her paketten sonra kayıt sayısıyla onay verir.
- Vercel uzun ömürlü TCP bağlantısı tutamaz. Bu yüzden küçük bir ağ geçidi gerekir, örneğin bir VPS'te ~200 satır Node/Go:
  - paketi çözer;
  - IMEI'yi cihaz jetonuna eşler;
  - `POST /api/telemetry/ingest` çağırır.
- Artı: abonelik yok, veri bizde, protokol açık.
- Eksi:
  - ağ geçidi işletimi (izleme, güncelleme);
  - cihazların montajı ve SIM'leri bizde.

### Öneri

**2. yol (kendi cihaz + ağ geçidi).** Gerekçeleri:
- Uygulamadaki uç nokta zaten sağlayıcıdan bağımsız.
- Belgelenmiş açık protokol var.
- Küçük bir filo için abonelik maliyeti olmaz.

Sağlayıcı yolu ancak bir sağlayıcı yazılı API sözleşmesi verirse değerlendirilmeli. O durumda sağlayıcının webhook'u aynı uç noktaya bir çeviriciyle bağlanır.

**Bu turda ağ geçidi yazılmadı.**

## Cihaz kimin adına kayıtlı?

- **Cihaz ve SIM:** firma (Renk Alüminyum) adına kayıtlı olmalı. Konum verisinin sahibi ve veri sorumlusu firmadır.
- **Sürücüler:** sürücülere araç takibi hakkında aydınlatma yapılması firmanın sorumluluğundadır. Bu turda KVKK akışı istenmediği için kurulmadı; yalnız saklama süresi ayarı var.
- **Sağlayıcı yolu seçilirse:** sözleşme firma adına olmalı ve verinin dışa aktarılabilirliği sözleşmeye yazılmalı.

## Sonuçlar

- Faz A cihaz olmadan bugün kullanılabilir.
- Faz B'de bağlantı noktası, jeton, hız sınırı, doğrulama, tekrar engelleme, saklama ve harita hazır. Gerçek cihaz bağlanana kadar konum ekranları boş durumdadır. Sahte konum gösterilmez; yerel test sahte POST ile yapılır.
- Karar bekleyen konular:
  - cihaz/sağlayıcı seçimi;
  - üretim için karo sağlayıcısı;
  - ağ geçidinin nerede çalışacağı.
