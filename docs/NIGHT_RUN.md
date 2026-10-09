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

### Tur 3 planı (10 satır) — araç filosu (yalnız sahip/yönetici)
1. ADR `docs/adr/0003-arac-filosu.md`: kapsam, veri modeli, cihaz yolu (sağlayıcı API'leri araştırıldı: herkese açık API bulunamadı; öneri kendi cihaz + TCP→HTTP ağ geçidi), cihaz firma adına.
2. Göç 046 (idempotent): araç, belge, bakım, yakıt, görev; cihaz (jeton özeti), konum (cihaz+zaman tekil, araç+zaman index), saklama ayarı (365 gün / süresiz).
3. Saf motor `lib/features/fleet/engine.ts`: belge uyarısı 30/15/7, araç sağlığı, aylık maliyet ve km başına maliyet, görev çakışması, konum doğrulama, güzergâh/durak/günlük km.
4. Yetki: `fleet` modülü yalnız sahip/yönetici; menü + sayfa (ROUTE_ROLES) + API (proxy matrisi) + servis katmanı; başka her rol için test.
5. `/vehicles` kartları (plaka, marka/model, tür, durum, sürücü, belge rozeti), araç ayrıntısı sekmeleri: Genel, Belgeler, Bakım, Yakıt, Görevler, Konum.
6. Görevler: montaja/sevkiyata araç atama + takvim çakışma uyarısı.
7. Maliyet grafikleri (araç başına aylık yakıt + bakım, km başına) ve panoda araç sağlığı kartı.
8. `POST /api/telemetry/ingest`: cihaz jetonu, hız sınırı, doğrulama, tekrar yok sayma; saklama süresi zamanlanmış temizlikte.
9. Harita: bağımlılıksız OSM karo bileşeni (atıf görünür, karo adresi ayarlanabilir), araç konumu ve canlı filo haritası; cihaz yoksa "Cihaz bağla".
10. Testler: motor jest + `test:fleet` (ekle, belge, uyarı, montaja ata, sahte konum POST, rol testleri) + tarayıcı.

| 2026-10-09 (Tur 3) | bitti → PR | Göç 046, motor (15 test), araç kartları + 6 sekme, belge uyarısı 30/15/7, montaja araç atama (çakışma uyarısı), maliyet grafiği, panoda araç sağlığı, cihaz jetonu + `POST /api/telemetry/ingest`, bağımlılıksız OSM harita, saklama ayarı. `test:fleet` yeşil, tarayıcıda yürütüldü (usta 404, planlama 403, menüde yok). /code-review 10 bulgu, hepsi düzeltildi (plaka küçük harf i, km üst sınırı, kayıt platformunda filo yetkisi, güzergâh kesilmesi → seyreltme, son konum LATERAL, temizlik araç listesinden). |

### Tur 4 planı (10 satır) — finans temeli (e-fatura yok; "bağlanmadı" olarak işaretli)
1. Keşif: fatura tablosu yok; `payments` siparişe bağlı (yöntem: nakit/havale/kart/çek mevcut), ödeme planı (041) var, muhasebede sipariş bazlı yaşlandırma var ama müşteri vadesini kullanmıyor. Var olan genişletilir, kopya açılmaz.
2. Göç 047 (idempotent): `invoices` (taslak → kesildi → iptal, firma içi numara, müşteri anlık görüntüsü, vade, `e_invoice_status = 'not_connected'`), `invoice_lines` (sipariş kalemine bağlı miktar → kısmi fatura); `payments`'a `invoice_id`, `reference`, `cheque_due_on`.
3. Saf motor `lib/features/finance/engine.ts`: satır/KDV toplamları (kuruş yuvarlama), faturalanabilir kalan miktar ve aşım kontrolü, vade (müşteri `payment_terms`), tahsilatların vadeye göre FIFO dağıtımı, yaşlandırma (vadesi gelmedi / 0–30 / 31–60 / 60+), ekstre (devir + yürüyen bakiye), vadesi geçenler, sipariş tahmini kârı.
4. Tahmini kâr: gelir = sipariş kalemleri (KDV hariç); maliyet = iş emri malzeme lotları (birim maliyet) + işçilik (operasyon süresi × firma saat ücreti) + yeniden işleme; eksik veri "bilinmiyor" olarak gösterilir, uydurulmaz.
5. Servis `invoices.server.ts`: siparişten taslak (kısmi), kes (numara), iptal (gerekçe), sil (taslak); tahsilat (dönem kilidi, sipariş tutarını aşamaz, çekte vade).
6. `receivables.server.ts`: müşteri bazlı açık bakiye + yaşlandırma, ekstre, vadesi geçen fatura → siparişe "ara" etkinliği + finans rollerine bildirim (fatura başına bir kez).
7. Yetki: `finance` hücresi (sahip/yönetici/muhasebe); usta ve diğerleri 404; API `/api/v1/invoices`, `/api/v1/finance/*` proxy matrisinden; tutarlar fiyat alanı olarak gizlenir.
8. Ekranlar: `/finance/receivables` (Alacaklar + yaşlandırma), `/finance/invoices` (liste + yazdırılabilir taslak), `/finance/statement` (ekstre, yazdırılabilir), sipariş sayfasında "Fatura & tahsilat" + tahmini kâr.
9. e-fatura/e-arşiv: entegrasyon yok; her faturada "e-fatura: bağlanmadı" rozeti, GİB'e gönderim yok.
10. Testler: motor jest + `test:finance` (kısmi fatura, aşım reddi, kes/iptal, tahsilat yöntemleri, yaşlandırma, ekstre, vadesi geçen → etkinlik + bildirim, kâr, usta göremez) + tarayıcı.

| 2026-10-09 (Tur 4) | bitti → PR | Göç 047, motor (14 test), siparişten kısmi taslak fatura → kes (FTR-000001) → iptal/taslak sil, tahsilat (nakit/havale/çek+vade/kart, dönem kilidi), Alacaklar (müşteri bazlı yaşlandırma 0–30/31–60/60+), yazdırılabilir fatura ve ekstre, vadesi geçen → siparişe 'ara' etkinliği + finans rollerine bildirim (bir kez), tahmini kâr (uydurma yok; maliyet yoksa 'hesaplanamadı'). `test:finance` yeşil, tarayıcıda yürütüldü (usta 404, planlama 403, sekme yok). /code-review 10 bulgu, hepsi düzeltildi (teklif genel iskontosu, ondalık yuvarlama, faturaya bağlı tahsilat, iptal ekstrede ters kayıt, etkinlikte fatura no/tutar yok, finans hücresi olmayana bildirim yok, dönem kilidi FOR SHARE, fatura kilidi, 'total' sızıntısı, kalemsiz siparişte serbest satır). |
| 2026-10-09 (Tur 3) | bitti | PR #51 `claude/night-2`'ye birleşti (CI yeşil). |
| 2026-10-09 (Tur 4) | bitti | PR #52 `claude/night-2`'ye birleşti (CI yeşil). |
| 2026-10-09 (Tur 5) | yapılmadı | Öncelik 1–4'e verildi; "sonra". |

---

## SABAH RAPORU — Gece 2

### Turlar
| Tur | Durum | PR (`claude/night-2`'ye) | Özet |
|---|---|---|---|
| 1 — Yetki / güvenlik | **bitti** | #49 | 9 hazır rol + özel rol (yalnız daraltır), proxy tek kapı + `access_denied` izi, pasif üye / oturum iptali, alan gizleme (fiyat/maliyet/kâr/iletişim) 75 rotada, rota taraması + sızıntı testleri, `/team`, `/account`, `/audit` (CSV), şifre politikası, bildirim tercihleri |
| 2 — Satış → montaj → servis | **bitti** | #50 | Potansiyel müşteri hattı + keşif/ölçü, kazanınca müşteri + taslak teklif, ölçü farkı uyarısı, montaj takvimi + çakışma, herkese açık teslim imzası `/teslim/…` (fiyatsız), onay kapılı "teslim edildi" önerisi, servis/garanti + tekrar eden arıza |
| 3 — Araç filosu (yalnız sahip/yönetici) | **bitti** | #51 | ADR 0003, araç kartları + 6 sekme, belge uyarısı 30/15/7, bakım/yakıt maliyeti, montaja araç atama + çakışma, panoda araç sağlığı; Faz B altyapısı: cihaz jetonu, `POST /api/telemetry/ingest`, güzergâh/durak/km motoru, OSM harita, saklama (365 gün / süresiz) |
| 4 — Finans temeli | **bitti** | #52 | Siparişten kısmi taslak fatura → kes → iptal, tahsilat (nakit/havale/çek+vade/kart), müşteri bazlı açık bakiye + yaşlandırma, ekstre, vadesi geçen → etkinlik + bildirim, sipariş tahmini kârı; e-fatura **bağlanmadı** |
| 5 — Görünümler / CSV / raporlar | **yapılmadı** | — | Öncelik 1–4'e verildi; "sonra" |

### Göçler (hepsi idempotent: `IF NOT EXISTS` ekleme, veri yeniden yazılmıyor; `scripts/ensure-backend-schema.ts` listesinde sırayla; yerel test veritabanında ikişer kez uygulandı)
| No | Dosya | Ne ekliyor |
|---|---|---|
| 044 | `044_access_control.sql` | `access_roles`, `tenant_members.access_role / deactivated_at`, `users.sessions_valid_after`, `user_sessions`, davet rolü |
| 045 | `045_sales_service_chain.sql` | `leads`, `site_surveys`, `installations` (+ imza jetonu özeti), `service_tickets` |
| 046 | `046_fleet.sql` | `vehicles`, `vehicle_documents`, `vehicle_maintenance`, `vehicle_fuel`, `vehicle_assignments`, `vehicle_devices`, `vehicle_positions`, `fleet_settings` |
| 047 | `047_finance_foundation.sql` | `invoices`, `invoice_lines`; `payments`'a `invoice_id`, `reference`, `cheque_due_on` |

Kod göç uygulanmadan da açılır: ilgili ekran "veritabanı güncellemesi (04x) bekleniyor" der.

### İş kuralları ve testler
- Birim testler (jest): Gece 1 sonu **609** → Gece 2 sonu **691** (97 suite). Yeni motor testleri: yetki matrisi + rota taraması + sızıntı, saha zinciri 11, filo 15, finans 14.
- Entegrasyon (yalnız yerel Postgres, `renkflow_test`): `test:access`, `test:chain`, `test:fleet`, `test:finance` — hepsi yeşil; her biri rol testleri içerir (usta ve yetkisiz roller 404/403).
- Her tur: `validate` yeşil, CI yeşil, /code-review yapıldı (4 × 10 bulgu, hepsi gerçek ve düzeltildi, çoğu teste bağlandı), tarayıcıda masaüstü + 390 px (koyu) denendi.
- Fiyat/müşteri usta DTO'larına girmiyor; tek denetim izi `activity_logs`; öneriler onay kapılı (teslim edildi önerisi durum makinesinden geçer).

### Bilinen boşluklar
- **Bağlanmayan dış servisler** (arayüzde "bağlanmadı" yazar, gerçekmiş gibi gösterilmez): e-fatura/e-arşiv (GİB), araç takip cihazı / sağlayıcı, TCP→HTTP ağ geçidi (yalnız ADR'de), imza bağlantısının SMS/e-postayla gönderimi.
- Konum verisi için KVKK aydınlatma metni ve sürücü onayı akışı yok.
- Harita karoları geliştirme için `tile.openstreetmap.org`; production'da yoğun kullanım için `NEXT_PUBLIC_MAP_TILE_URL` ile ücretli/kendi sunucu gerekir.
- Finans: yalnız TL alacaklar yaşlandırılır; faturasız eski tahsilatlar müşterinin avansı görünür; eski sahte fatura listesi `/finance/invoice` menüden kaldırıldı ama dosya duruyor.
- Tahmini kâr malzeme lotu + üretim süresi + yeniden işlemeyle sınırlı; saat ücreti Üretim ayarlarından girilmezse işçilik "bilinmiyor".
- Montaj takviminde dokunmatik sürükle-bırak yok (masaüstünde sürükle-bırak var).
- Yerelde üretim modunda davet e-postası localhost adresine gönderilemiyor (ortam kuralı, kod hatası değil).

### Ekran görüntüleri (`docs/night-run/gece2/`, yalnız sentetik test verisi)
- Tur 1: tur1-team, tur1-team-390-dark, tur1-invites, tur1-account(-390), tur1-audit(-390), tur1-planning-orders
- Tur 2: tur2-leads-board, tur2-leads-390-dark, tur2-lead-detail, tur2-leads-report, tur2-quote-warning, tur2-installation(s-390), tur2-worker-installations-390, tur2-signoff-390, tur2-order-chain, tur2-service
- Tur 3: tur3-fleet, tur3-fleet-390-dark, tur3-vehicle-general, tur3-vehicle-390-dark, tur3-documents, tur3-assignments, tur3-location
- Tur 4: tur4-order-billing, tur4-order-billing-390-dark, tur4-receivables, tur4-receivables-390-dark, tur4-invoice, tur4-statement

### Senin için liste
1. **Birleştirme sırası:** yalnız `claude/night-2` → `main`. (`night-2`, `main`'i ve `claude/trello-odoo`'yu zaten içeriyor; `trello-odoo`'yu ayrıca birleştirmen gerekmez.)
2. **Göç sırası (production Neon'a sen uygularsın):** Gece 1'in 037 → 043'ü uygulanmadıysa önce onlar, sonra **044 → 045 → 046 → 047**. Hepsi tekrar çalıştırılabilir; veri silmez/yeniden yazmaz.
3. **Kararlar:**
   - Usta montaj görünümünde şantiye adresini görsün mü? (şu an görüyor; telefon/fiyat görmüyor)
   - Araç takip: cihaz/sağlayıcı seçimi (ADR 0003: kendi cihaz + ağ geçidi önerisi) ve ağ geçidinin nerede çalışacağı (VPS?).
   - Harita karo sağlayıcısı (production).
   - Konum verisi için KVKK aydınlatma/sürücü onayı metni.
   - Teslim imza bağlantısı SMS/e-postayla gönderilsin mi (sağlayıcı)?
   - e-fatura entegratörü seçimi; o zamana kadar fatura firma içi kayıt.
   - Eski `/finance/invoice` sahte listesi silinsin mi?
   - Dokunmatik sürükle-bırak gerekli mi?
4. **Ayarlar:** Üretim ayarlarında saatlik işçilik maliyeti (tahmini kâr için), müşteri kartlarında vade günü (`payment_terms`, yoksa 30 gün).
5. **Sonraki tur önerisi:** Tur 5 (kayıtlı görünümler, faset filtre, toplu işlem, CSV içe/dışa aktarma, kayıtlı raporlar) — Alacaklar ve Faturalar CSV dışa aktarımı ilk adım olabilir.

---

# Gece 3 — Proaktif, onay kapılı AI asistanı (entegrasyon dalı `claude/n3-ai-assistant`, `claude/night-2`'den)

Keşif: `ai_suggestions` kuyruğu (029), 4 öneri türü (kesim planı, sayım içe aktarma, satın alma taslağı, teslim edildi), onay/ret/düzenle + `ai_feedback_examples`, `ai_usage` maliyet kaydı, sağlayıcılar (openai `gpt-6-luna` varsayılan, gemini, glm), maskeleme (`privacy.ts`), sohbet asistanı, eval çatısı (`evals/`), sayım PDF'i deterministik ayrıştırıcı. Yok: firma bazlı AI kapat anahtarı, öncelik/ertele/kanıt alanları, bütçe, Cmd+K komutu (yalnız gezinme). Var olan genişletilir.

### Plan (10 satır)
1. AI-1 temel: göç 048 (öneriye dedektör/öncelik/kanıt/ertele/ret nedeni; `ai_settings`: mod kapalı/yalnız kural/asistan, bütçe, dedektör ayarları, KVKK onayı); saf dedektör çatısı + bastırma (açık varsa yok, reddedilince N gün sus, düşük kabul oranında seyrelt).
2. AI-2 sekiz dedektör (geciken sipariş, eksik malzeme, bekleyen teklif, vadesi geçen alacak, fire anomalisi, kapasite, belge/bakım süresi, artık parça fırsatı): saf tespit + kanıt + şablon taslak mesaj + onayla uygulama; her biri için pozitif/negatif/bastırma testi.
3. Mesajlar şablonla yazılır (kural modu); asistan modunda model yalnız üslubu düzeltir, kişisel veri yer tutucuyla maskelenir; gönderim bağlı değil → "Kopyala".
4. AI-3 arayüz: Bugün kartları (ikon + tek cümle + kanıt rozetleri + Onayla/Düzenle/Ertele/Reddet), "Neden?" paneli (kanıt kayıtları, kural, güven; "bir daha önerme", "X güne çek"), Ayarlar'da AI modu + dedektör aç/kapa + performans paneli.
5. AI-4 doğal dil komutları: önce deterministik Türkçe ayrıştırıcı, yetmezse model → JSON şeması (doğrulanır); motor sonucu önizler, onayla uygulanır; belirsizlikte seçenek; rol yetkisi aşılamaz. "Ya şöyle olsa?" (öne al, gün ekle, iptal) etki önizlemesi.
6. AI-5 çıkarım: yapıştırılan mesaj → teklif taslağı, sayım PDF'i → sayım taslağı, tedarikçi PDF'i → RFQ cevap taslağı; alan bazında güven, düşük güven sarı.
7. Eval seti ≥30 Türkçe örnek (argo/kısaltma) + sağlayıcı karşılaştırma scripti; sonuç tablosu raporda.
8. AI-6 ekler: açıklanabilir fiyat aralığı + kâr tabanı uyarısı, müşteri hafızası (yalnız kayıtlardan, kaynaklı), rol bazlı sabah özeti, veri kalitesi bekçisi (≥4 sorun türü, geri alınabilir), usta sesli komut (destek yoksa gizli).
9. Maliyet/güvenlik: firma/kullanıcı günlük bütçe + hız sınırı, kural yeterliyse model yok, önbellek, prompt enjeksiyonuna karşı yalnız şema çıktısı, AI kapalıyken sistem çalışır.
10. Her tur: alt dal → PR → CI yeşil → /code-review → birleştir; testler kodla birlikte.
