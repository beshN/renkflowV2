# Sevkiyat yükleme listesi

`/shipments` üzerindeki sevkiyat numarası → salt okunur yükleme listesi → **Yazdır / PDF kaydet**. PDF, tarayıcının yazdırma penceresindeki PDF hedefiyle alınır; sunucuda PDF üretilmez. Liste kayıtlı sevkiyat kalemlerini gösterir; paket/sandık şablonu veya yeni paket kimliği oluşturmaz.

Her satır sipariş numarasını, sipariş kalemi kimliğini, ürün adını, varsa iş emri kimliğini ve miktarı kendi birimiyle gösterir. Üretim sevkiyatında iş emrinin `production_uom` değeri, diğer kayıtlarda sipariş kaleminin `quantity_unit` değeri kullanılır. İlişki/birim yoksa açıkça belirtilir; adet varsayılmaz. Toplam miktar veya para toplamı yoktur.

## Ön inceleme ve kapsam

- `apps/web/AGENTS.md` ve kurulu Next.js `dist/docs` içindeki giriş/Route Handler yönergeleri okundu.
- `platform.service.ts`: `shipProducedQuantity` miktarlı sevk, üretilen miktar sınırı, stok düşümü, teknik onay/tamlık, fotoğraf ve sevkiyat kaydı içeriyor. Sipariş durumunu kısmi/tam sevke göre güncelliyor; teslim komutu da var.
- `test-production-platform.ts`, `test-order-technical.ts`, `test-factory-stress.ts` kısmi sevk, teslim, teknik yükleme ve fazla sevk senaryoları içeriyor. Bu PR bu komutların doğruluğunu yeniden tasarlamaz veya sipariş miktarı sınırının tüm yollarını doğruladığını iddia etmez.
- Mevcut `/shipments` listesinde yazdırılabilir detay yoktu ve miktarlar sabit “Adet” gösteriliyordu. İlk eksik dilim olarak yalnız yükleme listesi eklendi.
- #134, #135, #136, #139 dosyaları değiştirilmedi. Özellikle `platform.service.ts` ve `ProductionWorkspace.tsx` değişmedi.

## Güvenlik ve doğrulama

Yeni GET oturumdan tenant ve mevcut `/shipments` rol yetkisini alır. Başka tenant'ın sevkiyat kimliği 404 döndürür; cevap private/no-store. Doğrudan tenant alanı olmayan `order_items`, tenant ile sınırlanan `orders` üzerinden bağlanır. Diğer join'lerde tenant eşitliği vardır. Mevcut liste API'sinin alt sorgusu da tenant ile sınırlandı.

- Birim/servis ve HTTP testleri: `npm test -- --runInBand __tests__/lib/shipment-load-list.test.ts __tests__/lib/shipment-load-list-route.test.ts __tests__/components/OperationalLists.test.tsx __tests__/components/ShipmentLoadList.test.tsx`.
- Gerçek PostgreSQL sorgusu: `npm run test:integration -- shipment-load-list`. Yalnız yerel `renkflow_test`, açıkça sentetik geçici tablolar; iki yönde tenant erişim reddi, hatalı tenant bağlantıları, miktar ve birim çözümleme.
- Migration yok. Production, Neon, Vercel veya canlı DB işlemi yok.
- Tarayıcı yazdırma/PDF sayfalaması ve oturumlu UI uçtan uca insan kontrolü gerektirir. Sentetik entegrasyon testi gerçek uygulama tablolarını değiştirmez ve tam fabrika provasının yerine geçmez.

AI tarafından hazırlanan değişiklikler insan onayı gerektirir. Draft PR Berat'ın inceleme ve birleştirmesine bırakılır.

Son doğrulama: type-check ve build başarılı; lint 0 hata / 3 mevcut uyarı. Tam Jest çalıştırması 225 dosya / 1673 test başarılı, yalnız eksik `xmllint` nedeniyle e-fatura XSD dosyasındaki 7 test başarısız. Sonradan eklenen 2 yükleme listesi bileşen testi de ayrı çalıştırmada başarılı (sevkiyatla ilgili toplam 11 test). Tarayıcıda gerçek PDF çıktısı görsel olarak doğrulanmadı.
