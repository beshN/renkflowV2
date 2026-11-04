# Pilot ZPL etiketleri

Mevcut kesim föyü, depo etiketi kayıtları ve tarayıcının kabul ettiği RF kimlikleri / UUID'leri kullanılır. Yeni kimlik sistemi veya menü yoktur. Kesim planı ve iş emri satırlarından, sevkiyat satırlarından ve mevcut etiket merkezindeki raf etiketinden **ZPL indir** ile `.zpl` dosyası alınır. Dosya yazıcıya gönderilmez; mevcut HTML etiket önizlemesi korunur, ZPL önizlemesi eklenmez.

`GET /api/v1/labels/zpl?kind=cut|job|shipment|location&id=UUID` oturumdan tenant ve güncel rolü alır. Owner/admin/office ve ilgili modülde view yetkisi gereklidir (raf: inventory, diğerleri: production). Daraltılmış müşteri iletişim alanı yetkisinde sevk dosyası reddedilir. Sorgular tenant filtrelidir; kesim mevcut `cutPlanSheet`, raf mevcut `labelRecord` üzerinden okunur. Başka tenant kimliği 404 verir. Yanıt private/no-store, attachment ve nosniff içerir. İndirme baskı sayacı artırmaz; fiziksel baskı anlamına gelmez.

Saf üretici `lib/features/labels/zpl.ts`: varsayılan 100 × 50 mm / 203 dpi (`^PW799^LL400`); 80–150 × 50–150 mm ve 152–600 dpi parametreleri desteklenir. Her metin UTF-8 `^CI28` ve tüm baytları kaçıran `^FH_` ile yazılır. QR mevcut kayıt kimliğini içerir; kesim parçasına yeni bir seri kimlik atamaz, ilgili iş emrini açar (ilişkisi bulunmayan parçada planı açar). Raf için varsa mevcut RF-R kodu, yoksa mevcut tarayıcının desteklediği raf UUID'si kullanılır. Sevk şablonunda yeni barkod kimliği üretilmez.

Kesim yalnız approved/completed planlardan çıkar; her fiziksel kesim satırı ayrı **1 adet** etiketidir, boy **mm** cinsindedir. İş emri eylemi yalnız o işin parçalarını verir. Onaylı planda doğrulanmamış kesim parametresi uyarısı varsa etikete kontrol uyarısı da basılır. Profil kodu `inventory_items.profile_code`, sipariş no `orders.order_number`, iş emri mevcut UUID'dir. Kod/ilişki yoksa alan boş kalır; SKU veya tahminle doldurulmaz.

Sevk: `orders.customer_name`, `orders.order_number`, `work_orders.title`, `production_shipments.quantity`, `work_orders.production_uom`. Gerçek paket sıra/toplam alanı bulunmadığından **Paket:  / ** boş bırakılır; sevkiyat adedi paket sayısı varsayılmaz. İçerik özeti tek sevkiyat kaydının iş başlığı ve kendi birimli miktarıdır. Birim veya para birimi toplamı yapılmaz. Migration yoktur.

Satır başına en fazla 50 karakter ve indirme başına en fazla 2000 etiket; taşan/geçersiz veri 422 ile reddedilir, kimlik sessizce kesilmez. Boyut parametresi saf modüldedir; ilk sürüm ekran eylemleri varsayılanı kullanır.

**Fiziksel Zebra yazıcıda baskı, QR okuma, Türkçe glif kapsamı ve ölçek doğrulanmadı.** Font 0'ın Türkçe glifleri yazıcı firmware/fontuna bağlıdır. Dosyalar operatör kontrolüyle pilotta denenmelidir. AI onay akışlarına değişiklik yoktur; insan onayı gerekliliği korunur. Test/PR örnekleri sentetik test fixture'larıdır, gerçek müşteri verisi içermez.
