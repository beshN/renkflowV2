# Müşteri iadesi (RMA) — Faz 5.2

Sipariş detayındaki teslim edilmiş kalemden **Müşteri iadesi** ile insan tarafından başlatılır. `/customer-rmas` liste, `/customer-rmas/:id` belge detayıdır. Mevcut PageHeader, tablo, StatusChip, kayıt çekmecesi ve rf-* sınıfları kullanılır.

087 yalnız eklemeli ve idempotenttir; tedarikçi iadesinin 086 tablolarını kullanmaz. Yerel doğrulama `npm run db:local` ve `npm run test:integration -- customer-rma` ile yapılır. Production migration/deploy bu çalışmanın parçası değildir.

- Teslim kanıtı: `production_shipments.status=delivered`, aynı sipariş/kalem/tenant ve `work_orders.production_uom=order_items.quantity_unit`. Yerel sevkiyat akışına bağlı olmayan manuel sipariş açıkça `delivered` ise kalem miktarı kullanılır; o kalemde herhangi bir native sevkiyat varsa yalnız teslim edilmiş sevkiyat miktarı kullanılır. Birim dönüşümü yapılmaz.
- Kaynak kalem ve sipariş kilitlenir; önceki tüm RMA satırları (reddedilenler dahil) teslim miktarından düşülür. Bu dilimde rezervasyon serbest bırakma/iptal akışı yoktur. Adet birimleri tam sayı gerektirir.
- Karar `pending → repair | replace | reject`; karar tekrarları yan etkisizdir, farklı ikinci karar reddedilir. Oluşturma anahtarı kaynak/miktar/neden/fotoğraf ve belirtilmiş servis bağı ile karşılaştırılır.
- `replace` reçetesiz, malzeme/operasyon üretmeyen `general / blocked` taslak WO açar. Ayrı insan onayı `production.approve` ister; mevcut WO durum değiştirme servisi ve DB CHECK onay öncesinde ilerlemeyi engeller. Onay yalnız kilidi kaldırır, üretimi başlatmaz. Üretim planlama ayrıca insanın sorumluluğundadır.
- Hiçbir RMA komutu stok/lot/bakiye hareketi yazmaz. Fiziksel kabul ve stok geri alımı bu dilimde uygulanmaz.
- Aynı tenant ve siparişe ait mevcut servis kaydı varsa en yeni kayıt bağlanır. API'de belirli `serviceTicketId` de verilebilir ve sipariş eşleşmesi doğrulanır. Kayıt yoksa bağ kurulmaz; detayda nedeni gösterilir. Yeni servis kaydı otomatik açılmaz.
- Fotoğraflar kayıt platformunun mevcut eki deseniyle RMA kayıt çekmecesine eklenir. Oluşturma API'sindeki isteğe bağlı `photoAttachmentId`, aynı tenant ve kaynak siparişe bağlı, silinmemiş resim eki olmalıdır. Dosya yükleme/indirme mevcut depolama yapılandırmasını kullanır.
- Okuma `orders.view + service.view`, oluşturma `service.create`, karar `service.edit`, değişim ayrıca `production.create`, insan onayı ayrıca `production.approve` gerektirir. Worker/member RMA müşteri verisine erişemez. Başka tenant belgeleri 404 döner. Kayıt platformu da aynı modül sınırlarını uygular.
- İade faturası/e-Belge, tedarikçi iadesi, mobil, tenant modelini genişletme ve panel/landing tasarımı kapsam dışıdır.
