# Gece çalışması (Trello akıcılığı + Odoo derinliği)

Entegrasyon dalı: `claude/trello-odoo` (main'e birleştirme sabah, kullanıcı tarafından). Her tur bu daldan alt dal + PR.

| Zaman (UTC) | Durum | Not |
|---|---|---|
| 2026-10-08 22:30 | bitti | Görsel dönüşüm #42 main'de. `claude/trello-odoo` açıldı; `.claude/settings.json` izin kuralları doğrulandı (echo izinli, main'e push ve Neon/Vercel yasak) |
| 2026-10-08 22:40 | sırada | Tur A: kayıt platformu (yorum, @bahsetme, ek, takipçi, etiket, kontrol listesi, aktivite, akıllı buton, kural motoru). Göç 040 |
| 2026-10-09 01:10 | bitti | Tur A: göç 040 (idempotent), `/api/v1/records/*`, kayıt çekmecesi 6 kayıt türünde, panoda bugünkü aktiviteler, ayarlarda etiket + 3 kural. İnceleme 10 bulgu düzeltildi. 572 birim test + `test:records` yeşil. CI artık `claude/trello-odoo` PR'larında da çalışıyor |
| 2026-10-09 01:10 | sırada | Tur B: teklif → sipariş derinliği |

### Tur B planı (10 satır)
1. Göç 041 (idempotent): teklif revizyon/şablon/ayar/müşteri fiyat kuralı/onay bağlantısı; sipariş söz tarihi, kısmi teslim, değişiklik talebi, ödeme planı.
2. Saf motorlar (`lib/features/sales/`): teklif farkı (diff), etkin indirim ve eşik, KDV/kur toplamları, müşteri fiyat kuralı seçimi, ödeme planı dağıtımı, satır teslim durumu, değişiklik etkisi, söz/gerçek gecikme.
3. Teklif durum makinesi sunucuda: gönderirken indirim eşiği (yönetici onayı), geçerlilik tarihi zorunlu ve geçmiş olamaz; süresi dolan teklif otomatik "süresi doldu"; revize = anlık görüntü + taslağa dönüş.
4. Müşteri onay bağlantısı: tek kullanımlık karar, ad + tarih + IP + tarayıcı izi, süre ve revizyon bağlı, hız sınırı; fiyat yalnız o teklifin kendisi.
5. Sipariş durum makinesi tek kapıdan: tüm yollar (`/transition`, `/status`, sunucu eylemi) aynı kuralı ve gerekçe zorunluluğunu (iptal, beklet, geri adım) uygular, denetime yazar.
6. Söz verilen tarih onayda donar; değiştirmek gerekçe ister; teslimde gerçekleşen tarih yazılır.
7. Kısmi teslim satır bazında (kalan miktarı aşamaz), satır durumu açık/kısmi/teslim.
8. Değişiklik talebi: üretim etkisi uyarısı (iş emri başladıysa onay ister, sevk edildiyse engeller), uygulanınca satır + toplam + iz + üretime bildirim (fiyatsız).
9. Ödeme planı: taksitlerin toplamı sipariş tutarına eşit; tahsilatlar sırayla dağıtılır, gecikmiş taksit görünür.
10. Arayüz: teklif detayında revizyon/fark, onay bağlantısı, indirim onayı, şablon; sipariş detayında plan/teslim/değişiklik/söz tarihi. Testler: jest motorlar + `test:sales` entegrasyon.
| 2026-10-09 06:20 | bitti | Tur B (#44 birleşti): göç 041, satış motorları + tek kapılı sipariş durum makinesi, müşteri onay bağlantısı, revizyon farkı, kısmi teslim, değişiklik talebi, ödeme planı. İnceleme 10 bulgu → 9 düzeltildi, 1 geçersiz (mobil sahte veri). 589 birim + test:sales yeşil |
| 2026-10-09 06:20 | sürüyor | Tur C: göç 042, neden kodları, fire/gecikme, kapasite ısı haritası, kesim planı geçmişi, çubuk boyu seçimi, değişiklikte BOM yeniden hesabı; testler + tarayıcı tamam, kod incelemesi bekleniyor |

### Tur D planı (10 satır)
Mevcut olan: rezervasyon, kullanılabilir = fiziksel − ayrılan (eşik ekranı), hareket türleri (stok fişleri), lotlar, sayım belgeleri, onay kapılı satın alma taslağı önerisi, sipariş → kısmi kabul/ret.
1. Göç 043 (idempotent): stok kalemine azami stok, tedarik süresi (gün), sipariş katı; teklif isteme (RFQ) başlık/satır/tedarikçi cevabı tabloları.
2. Saf motor: yeniden sipariş noktası = asgari + günlük tüketim × tedarik süresi; azamiye kadar, kat yuvarlaması; eski davranış (yalnız asgari) aynen korunur.
3. Günlük tüketim son 90 günün çıkış fişlerinden; onay kapılı satın alma önerisi yeni hesabı kullanır.
4. Sipariş onayında eksik malzeme: yapılandırılmış satırların reçete malzemesi × adet, kullanılabilir stok ve başka işlerin ayırdığıyla karşılaştırılır; eksik varsa uyarı + üretim sorumlusuna bildirim (fiyatsız), sipariş ekranında "Malzeme durumu".
5. RFQ: satırlar + tedarikçiler → cevaplar (birim fiyat, süre, geçerlilik) → karşılaştırma (toplam, satır bazında en ucuz, süre) → seçilen tedarikçiye taslak satın alma siparişi (mevcut sipariş komutuyla). E-posta gönderimi bağlanmadı olarak işaretli.
6. Tedarikçi fiyat geçmişi: sipariş satırlarından kalem × tedarikçi zaman serisi ve değişim %.
7. Tedarikçi puanı: zamanında teslim %, ret oranı, ortalama gecikme gün → 0-100 ve harf.
8. Yetki: satın alma ofis/yönetici/muhasebe; usta hiçbirini görmez.
9. Testler: jest motorlar + test:stock entegrasyon.
10. Arayüz: satın alma ekranında yeniden sipariş politikası, RFQ akışı, tedarikçi puan kartı ve fiyat geçmişi; sipariş detayında malzeme durumu.
