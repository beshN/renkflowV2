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
