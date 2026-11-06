# Tedarikçiye iade — Faz 5 / Dilim 5.1

Reddedilen, onaylı bir mal kabul satırından insan onayıyla taslak belge açılır. Belge ve satırlar yalnız tedarikçi iadesine aittir; müşteri RMA ve fason akışlarıyla tablo paylaşılmaz. Kabul tabloları yeniden tanımlanmaz.

## Miktar ve eşzamanlılık

Servis kilidi seçildi: mevcut mal kabul komutlarıyla aynı tenant advisory transaction lock, ayrıca kaynak kabul satırı ve kabul başlığında `FOR UPDATE`. İşlemler `SERIALIZABLE` ve mevcut transaction yardımcısının serialization/deadlock retry kuralıyla yürür. PostgreSQL numeric karşılaştırması, taslak/gönderildi/kapandı belgelerin tamamının ayırdığı miktarı reddedilen miktardan düşer. Böylece eşzamanlı taslaklar toplam sınırı aşamaz. Bu kural için doğrudan SQL yazımı desteklenen bir uygulama yolu değildir; tüm yazımlar servis üzerinden geçmelidir.

Birim kaynaktan kopyalanır, API birim veya tedarikçi override kabul etmez. Birim çevirisi yoktur. Profilin fiziksel lotu parçalanmaz; gönderilen metre miktarı kaynak red lotlarındaki tam fiziksel profillerden oluşmalıdır. Yetersiz veya uygun tam profil dağılımı bulunamazsa gönderim geri alınır ve taslak kalır.

## Durum ve stok

Yalnız `draft → sent → closed`. Aynı hedef durumun tekrar gönderilmesi idempotent başarıdır; atlama veya geri dönüş reddedilir. Taslak stok hareketi üretmez. `sent` geçişinde `postStockEntryInTransaction` ile `MATERIAL_ISSUE` ve `supplier_return` kaynağı kullanılır. Kaynak kabulün red lotları ve bakiyeler aynı transaction içinde güncellenir; kapatma stok üretmez. Belgeye bağlı sabit ledger idempotency key ve kaynak için unique index ikinci çıkışı engeller.

İade bağlı kabul terslenemez. Yeni bir iade iptal/geri dönüş durumu veya yeni stok tersleme motoru eklenmedi. Mevcut genel tersleme yalnız izin verdiği giriş kayıtlarında çalışır; iade çıkışı bu yoldan terslenmez. Gelecekteki bir düzeltme akışı mevcut REVERSAL defter kurallarını ve lot/bakiye tutarlılığını birlikte kullanmalıdır.

## Erişim ve ekran

Mevcut satın alma rol kontrolleri ve üye yetki matrisi birlikte uygulanır: görüntüleme `purchasing.view`, taslak `purchasing.create`, gönderim/kapatma `purchasing.approve`; gönderim ayrıca `inventory.create` ister. Her belge/satır sorgusu tenant ile sınırlıdır. Başka tenant'ın kaynak satırı veya iade belgesi 404 döner.

Mal kabul → geçmiş kabul kayıtları ve düzeltmeler → reddedilen satır → **Tedarikçiye iade**. `/supplier-returns` liste, `/supplier-returns/[id]` detaydır. Liste/detay mevcut PageHeader, paylaşılan tablo, StatusChip, kayıt çekmecesi ve rf-* sınıflarını kullanır. Yeni public sayfa yoktur.

Mevcut **Tedarikçi karnesi** yüzeyine gönderilmiş/kapanmış iade belgelerinin sayısı ve ham miktarı birim bazında eklenir. Taslaklar sayılmaz. Metre, kg, adet birbirine eklenmez; iade yüzdesi veya puanı üretilmez. Eski karne puanı hesaplama kuralları bu dilimde değiştirilmedi.

## Yerel doğrulama

`npm run db:local` ile açılan `renkflow_test` üzerinde `npm run test:supplier-return`. Test bağlantısı yalnız local-test-database yardımcısından alınır; dış DATABASE_URL kullanılmaz. Migration iki kez uygulanır. Eşzamanlı miktar rezervasyonu, durum geçişleri, tekrar gönderim/kapatma, başarısız gönderimin rollback'i, rol/tenant izolasyonu, lot/bakiye, audit ve birim bazında karne doğrulanır. Fixture'lar `finally` içinde temizlenir.
