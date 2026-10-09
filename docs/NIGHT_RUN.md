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
| 2026-10-09 06:20 | bitti | Tur C (#45 birleşti): göç 042, neden kodları, fire/gecikme, kapasite ısı haritası, kesim planı geçmişi, çubuk boyu seçimi, değişiklikte BOM yeniden hesabı. İnceleme 10 bulgu → 10 düzeltildi. 600 birim + test:production-depth yeşil |
| 2026-10-09 07:00 | bitti | Tur D: göç 043, yeniden sipariş politikası, onayda eksik malzeme, teklif isteme (RFQ), tedarikçi karnesi, fiyat geçmişi. İnceleme 9 bulgu → 9 düzeltildi. 609 birim + test:stock-depth yeşil; PR açılıyor |
| 2026-10-09 07:00 | yapılmadı | Tur E–H: öncelik A–D'ye verildi; aşağıdaki listede "sonra" |

---

## SABAH RAPORU

### Turlar
| Tur | Durum | PR | Özet |
|---|---|---|---|
| A — Kayıt platformu | **bitti** | #43 | Yorum + @bahsetme + ek + takipçi, etiket, sorumlu/termin, kontrol listesi %, planlı aktivite, akıllı butonlar, 3 kural (onay → üretim aktivitesi, gecikme → yöneticiye, teslim → geri bildirim). 6 kayıt türünde çekmece. |
| B — Teklif → sipariş | **bitti** | #44 | Revizyon + fark, geçerlilik/süre dolması, indirim onay eşiği, şablon, müşteri fiyat listesi, KDV/kur, müşteri onay bağlantısı (ad/tarih/IP), PDF'de revizyon/KDV/onay. Tek kapılı sipariş durum makinesi (gerekçe), kısmi teslim, satır durumu, değişiklik talebi + üretim etkisi, ödeme planı, söz vs gerçek tarih. |
| C — Üretim/kesim | **bitti** | #45 | (Aşama, süre, fotoğraflı QC, rework, kerf/trim, artık önceliği, renk gruplama zaten vardı.) Firma neden kodları, fire/gecikme kaydı, Pareto, 7 günlük kapasite, kesim planı geçmişi, çubuk boyu seçimi, değişiklikte BOM yeniden hesabı. |
| D — Stok/satın alma | **bitti** (PR birleşiyor) | #46 | (Rezervasyon, kullanılabilir = fiziksel − ayrılan, hareket türleri, lot, sayım, kısmi kabul zaten vardı.) Azami/tedarik süresi/paket katı, tüketime göre sipariş noktası, onayda eksik malzeme + bildirim, RFQ → karşılaştırma → taslak satın alma, tedarikçi puanı, fiyat geçmişi. |
| E — CRM/montaj/servis | yapılmadı | — | sonra |
| F — Finans temeli | yapılmadı | — | sonra |
| G — Görünümler/arama/rapor/CSV | yapılmadı | — | sonra |
| H — Yetki/güvenlik/ayar/cila | yapılmadı | — | sonra (her turda yetki ve izler zaten tur içinde yapıldı) |

### Göçler (hepsi idempotent: yalnız `IF NOT EXISTS` ekleme, veri yeniden yazılmıyor; uygulanmadan kod eski davranışla çalışır)
| No | Dosya | Ne ekliyor |
|---|---|---|
| 040 | `040_record_platform.sql` | record_comments, record_attachments, record_followers, record_tags(+links), record_meta, record_checklist_items, record_activities, record_rules, record_rule_runs |
| 041 | `041_quote_order_depth.sql` | quotations'a revision/vat/fx/onay sütunları; quotation_revisions, quote_settings, quotation_templates, customer_price_rules, quotation_approval_links; orders'a promised_date/delivered_on; order_deliveries, order_change_requests, order_payment_plans |
| 042 | `042_production_depth.sql` | production_reason_codes, production_scrap_events, production_delays; manufacturing_preferences.bar_length_options_mm |
| 043 | `043_stock_purchasing_depth.sql` | inventory_items'a max_stock, lead_time_days, order_multiple; purchase_rfqs, purchase_rfq_lines, purchase_rfq_responses |

Hepsi `scripts/ensure-backend-schema.ts` listesinde sırayla kayıtlı. Her biri yerel test veritabanında iki kez uygulandı (ikinci seferde değişiklik yok).

### İş kuralları ve testler
- Birim testler (jest): 572 → **609** (records 4, sales 17, production 11, stock 9 yeni).
- Entegrasyon (yerel Postgres): `test:records`, `test:sales`, `test:production-depth`, `test:stock-depth` (yeni) + `test:quote-configurator`'a BOM yeniden hesap senaryosu; eski `test:production` (16 PASS), `test:stock-threshold` yeşil.
- Kurallar sunucuda: tek sipariş durum makinesi ve gerekçe; indirim eşiği gönderme ve dönüştürmede; teklif süresi; revizyonda bağlantı kapanır; onay bağlantısı tek karar, hız sınırı, aynı köken; teslim kalan miktarı aşamaz; değişiklikte üretim etkisi onayı, teslim edilmiş ürün değişmez; ödeme planı toplamı = sipariş; fire/gecikme yalnız saha+ofis, usta yalnız kendi işi; RFQ satırı satın alma satırı kurallarıyla aynı; satın alma yazma ofis/yönetici, muhasebe okur, usta hiç.
- Fiyat/müşteri usta DTO'larına ve usta bildirimlerine girmiyor (testlerde doğrulandı). Tek denetim izi `activity_logs`.
- Her turda bağımsız kod incelemesi yapıldı: A 10, B 10 (1 geçersiz), C 10, D 9 bulgu — geçerli olanların hepsi düzeltildi ve teste bağlandı.

### Bilinen boşluklar
- Dış servisler bağlanmadı (gösterilmiyor da): e-fatura/e-arşiv, banka, SMS, RFQ e-postası, döviz kuru servisi (kur elle).
- Dosya eki için Blob depolama yapılandırılmamışsa ek yükleme 503 ("bu kurulumda kapalı"); yorum çalışır.
- Fire kaydı stok hareketi yaratmaz (stok düşümü depo komutlarında).
- Değişiklik talebi ödeme planını kendiliğinden yeniden dağıtmaz; uyarı gösterir.
- Kapasite ısı haritası yalnız reçeteli operasyonları sayar.
- `apps/mobile` sahte veriyle çalışıyor; API'ye bağlı değil.
- Tur E–H yapılmadı.

### Ekran görüntüleri (`docs/night-run/`, yalnız sentetik test verisi)
turA-drawer / turA-drawer-390 / turA-dashboard-activities / turA-settings · turB-quote-before / turB-quote-panel / turB-customer-390 / turB-order-sales / turB-order-390 / turB-settings · turC-worker-390 / turC-insights / turC-settings · turD-reorder / turD-rfq / turD-suppliers / turD-390

### Senin için liste
1. **Göç sırası (production Neon'a sen uygularsın):** 037/038/039 henüz uygulanmadıysa önce onlar, sonra **040 → 041 → 042 → 043**. Her biri tekrar çalıştırılabilir.
2. **Birleştirme:** `claude/trello-odoo` → `main` (main otomatik deploy + göç çalıştırır; göçlerin sırası yukarıdaki gibi). PR'lar #43, #44, #45, #46 bu dala birleşti.
3. **Kararlar:**
   - İndirim onay eşiği varsayılanı %10, teklif geçerliliği 15 gün, KDV %20 → Ayarlar › Teklif kuralları'ndan değiştir.
   - Müşteri onay sayfası `/teklif/…` herkese açık (coming-soon modunda kapalı); uygun mu?
   - Çubuk boyu seçenekleri (6000/6500/7000 vb.) ve neden kodları Ayarlar'dan girilmeli.
   - Blob depolama (ekler için) açılsın mı?
4. **Sonraki tur önerisi:** Tur E (CRM/montaj/servis) — montaj ekibi takvimi ve servis kaydı sipariş/teslim verisine hazır bağlanabilir.

---

# Gece 2 (2026-10-09) — entegrasyon dalı `claude/night-2` (`claude/trello-odoo` main'e henüz birleşmedi; ondan açıldı)

| Zaman (UTC) | Durum | Not |
|---|---|---|
| 2026-10-09 06:50 | başladı | Yetki altyapısı haritalandı. Açıklar: `internal/admin-notification` gizli anahtar yoksa açık; kullanıcı pasifleştirme / oturum iptali yok; davet listesi ham token döndürüyor; denetim izi ve bildirim tercihi ekranı yok |
| 2026-10-09 (Tur 1) | sürüyor | Bitti: göç 044, matris motoru, proxy tek kapı + `access_denied` izi, oturum/pasif üye kontrolü, ekip/rol/davet/oturum API'leri, şifre politikası, admin-notification kapatıldı, 75 rotada alan süzgeci + server action'lar, rota taraması ve rol başına sızıntı testleri. Ekranlar (/team, /account, /audit), menü süzme, `test:access` da bitti. |
| 2026-10-09 (Tur 1) | inceleme | /code-review 10 bulgu, hepsi gerçek ve düzeltildi (davet uçları kapı dışı, pasif üyelik girişte atlanır, yönetici oturum kapatması firma kapsamlı, yönetici temelli rolleri yalnız sahip yönetir, rol değişikliğinde yetki rolü korunur, satış ayarlarını okuma, genel anahtarlar, Salt okunur gerçekten salt okunur, sorgu yükü, alt koleksiyon POST'u). validate yeşil (651 test). PR açılıyor. |

### Tur 1 planı (10 satır)
1. Göç 044 (idempotent): `access_roles` (özel rol: temel rol + modül×eylem matrisi + gizli alanlar), `tenant_members.access_role/deactivated_at`, `users.sessions_valid_after`, `user_sessions`, davette `access_role`.
2. Saf motor `lib/security/access-matrix.ts`: 9 hazır rol (Sahip, Yönetici, Ofis, Satış, Planlama, Muhasebe, Usta/Operatör, Depocu, Salt okunur), özel rol temel rolün yetkisini yalnız DARALTIR (mevcut korumalar zayıflamaz), rota → modül/eylem eşlemesi, alan gizleme sözlüğü, şifre politikası.
3. Tek kapı: `proxy.ts` her oturumlu `/api` ve sayfa isteğinde üyenin erişimini veritabanından (30 sn önbellek) okur; yetkisizse 403 + `activity_logs`'a `access_denied`; pasif üye/iptal edilmiş oturum düşer.
4. Alan gizleme: fiyat/maliyet/kâr/müşteri iletişimi; ana DTO'larda (sipariş, teklif, müşteri, satış panelleri, satın alma, stok) `redactFor` ile; her hazır rol için sızıntı testi.
5. Rota taraması testi: her `route.ts` ya bir kapı kullanır ya da gerekçeli açık listededir; `admin-notification` kapalı-başarısız yapılır, davet listesinden ham token çıkar.
6. Ekip: üyeler (rol, son görülme), rol değiştirme (son sahip korunur), pasifleştirme/geri alma (kayıtlar kalır), süreli davet (1–30 gün, rol seçimi), davet iptali, özel rol matrisi düzenleyici.
7. Oturumlar: JWT'de `sid`; aktif oturum listesi, tek oturum ya da hepsini kapat (kendisi + yönetici başkası için); şifre sıfırlamada hepsi düşer.
8. Şifre politikası (en az 10, harf+rakam, e-postayla aynı olamaz) davet kabul/sıfırlama/kayıtta; giriş denemesi sınırı mevcut.
9. Denetim izi görüntüleyici `/audit`: kim/ne/ne zaman/kayıt, filtre, sayfalama, CSV (dışa aktarma yetkisi).
10. Bildirim tercihleri (olay × kanal) kişi bazlı API + ekran. Testler: jest motor + `test:access` entegrasyon + sızıntı.

### Tur 2 planı (10 satır) — CRM → keşif → teklif → sipariş → montaj → teslim imzası → garanti
1. Göç 045 (idempotent): `leads`, `site_surveys` (ölçü json + teklif anındaki ölçü özeti), `installations` (ekip, gün/saat, durum, eksik/hasar, teslim imza jetonu özeti), `service_tickets` (garanti, parça, işçilik, çözüm süresi); `tenants.settings` içinde garanti süresi.
2. Saf motor `lib/features/field/engine.ts`: aşama geçişleri (kayıp nedeni zorunlu), dönüşüm raporu (kaynağa göre), ürün ailesine göre ölçü alanları, ölçü farkı, montaj çakışması, garanti durumu, çözüm süresi, tekrar eden arıza.
3. Kayıt platformu (Tur A) üç yeni kayıt türü alır: `lead`, `installation`, `service_ticket` → yorum, fotoğraf eki, kontrol listesi, etkinlik hazır.
4. CRM: potansiyel müşteri hattı, takip etkinliği, keşif randevusu (adres + harita bağlantısı); kazanılınca müşteri kartı (mevcut eşleştirici) ve taslak teklif otomatik açılır.
5. Ölçü formu ürün ailesine göre; teklif sonrası ölçü değişirse teklif ekranında fark uyarısı.
6. Montaj: siparişten tek tıkla plan; ekip/gün takvimi (sürükle), çakışma uyarısı, kontrol listesi, eksik/hasar notu, fotoğraf.
7. Teslim imzası: herkese açık jetonlu `/teslim/…` (fiyat yok, hız sınırlı); imzalanınca "siparişi teslim edildi yap" önerisi Önerilenler'e düşer (onay kapılı, durum makinesinden geçer).
8. Servis/garanti: siparişten ya da montajdan tek tıkla kayıt; garanti teslim tarihi + süreye göre; parça/işçilik; çözüm süresi ve tekrar eden arıza raporu.
9. Yetki: modüller `crm`, `installations`, `service` (Tur 1 matrisi); usta kendine atanan montajı görür, fiyat/müşteri iletişimi gizli kalır.
10. Testler: motor jest + `test:chain` (lead → teklif → sipariş → montaj → imza → öneri onayı → garanti kaydı uçtan uca) + tarayıcı.

| 2026-10-09 (Tur 1) | bitti | PR #49 `claude/night-2`'ye birleşti (CI yeşil). |
| 2026-10-09 (Tur 2) | bitti → PR | Göç 045, motor (11 test), lead/keşif/teklif, montaj takvimi + imza + onay kapılı 'teslim edildi' önerisi, servis/garanti, sipariş 'Montaj & servis' sekmesi, `test:chain` uçtan uca yeşil, tarayıcıda zincir yürütüldü (müşteri sayfasında fiyat yok, usta görünümünde müşteri yok). /code-review 10 bulgu, hepsi düzeltildi. |
