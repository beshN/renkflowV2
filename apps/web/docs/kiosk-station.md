# Oturumlu usta kiosku — ilk dilim

Rota: `/production/worker/kiosk`. Panel kabuğu olmadan açılır; mevcut Button ve tasarım sınıflarını kullanır. Usta kendi oturumuyla giriş yapar. Bu görünüm cihaz eşleştirmesi veya PIN oturumu oluşturmaz.

## Mevcut akış

- `/station`: istasyon cihazı çerezi, eşleştirme, iş merkezi kapsamı ve kontrol listeleri.
- `/production/worker`: oturumlu usta ekranı, teknik planlar ve günlük üretim işlemleri.
- `production_operations`: `assigned_to`, durum, `version`, `active_seconds`, `active_since`, başlangıç/bitiş ve tamamlanan miktar.
- `platform-contract.transitionOperation`: start/pause/complete geçişleri ve süre hesabı; paused → start devam anlamına gelir.
- `platform.service.productionCommand`: tenant kilidi, idempotency, satır kilidi, worker ataması, sürüm, malzeme, kapasite, önceki aşama ve kalite kontrolleri; production_commands/events geçmişi.
- Güncel üyelik ve daraltılmış yetkiler `requireWorkOrderActor` ve `requireCap` üzerinden doğrulanır.

Kiosk bu servisi çağırır; alternatif süre tablosu, geçiş motoru veya migration eklemez. İş emri seviyesinde atama tek başına yeterli değildir: mevcut operasyon komutu operasyonun kişiye atanmasını gerektirir. Liste aynı koşulu uygular. Tüm roller için gerçek operasyon ataması aranır. Owner/admin/office yalnız mevcut production edit yetkileri varsa erişir; kiosk komutları bu roller için de worker kapsamına daraltılır, mevcut transaction içindeki atama kontrolü korunur. Accountant/member erişemez.

Miktar satır bazında `work_orders.production_uom` ile gösterilir. Birim eksikse açıkça belirtilir; adet varsayılmaz. Miktar veya para toplamı yoktur. Bitir mevcut integer quantity sözleşmesiyle kalan miktarı tamamlar. Kalite kontrolü isteyen işlerin tamamlanması mevcut usta ekranında kalır; kiosk kalite sonucunu otomatik geçmez. Kesirli miktar desteği mevcut komut sözleşmesiyle sınırlıdır.

## Manuel pilot kontrolü

Gerçek atanmış operasyonla oturum açıp bu rotaya gidin. Başla → mola → devam → bitir yapın; mevcut operasyon süresini ve olay geçmişini kontrol edin. İki tabletle sürüm çakışmasını kontrol edin. Kalite gerektiren işte mevcut usta ekranı bağlantısını kullanın. Gerçek fabrika tableti ve canlı kullanıcı oturumuyla doğrulama insan incelemesinde yapılmalıdır.

## Kapsam dışı

PIN ile hızlı kullanıcı geçişi için ayrıca güvenlik tasarımı istenmeli. Çevrimdışı çalışma ve analitik sonraki dilimlerde değerlendirilebilir. Bu PR üretim dağıtımı yapmaz. AI çıktısı insan onayı gerektirir; birleştirme Berat'a aittir.
