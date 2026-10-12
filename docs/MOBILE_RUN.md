# Mobil çalışma kaydı

Entegrasyon: `codex/mobile-integration`, güncel main `bbc2825` + mevcut native dal `dc8ad7f`. Alt PR'lar entegrasyon dalına; main ve `claude/night-2` hedef değildir. Çalışma alanı `/workspace/renkflow-mobile`; diğer oturumun web/AI dosyaları değiştirilmez. Production/Neon/Vercel ortamları kullanılmaz.

## Durdurma koşulları
- Aynı hata iki farklı düzeltmeyle çözülmezse dur, hatayı ve iki denemeyi yaz.
- DTO sızıntısı güvenli biçimde giderilemezse dur; ilgili alanı veya uç noktayı kapat.
- Tek adım 4 saati aşarsa çalışan parçayı bitir, kalanını **sonra** olarak yaz.

## Adım 1 planı (10 satır)
1. Güncel main tabanını ve ilk native sürümü ayrı entegrasyon dalında birleştir.
2. night-2 değişikliklerini test alanında karşılaştır; hedef dala merge etme.
3. Renk/boya, sorumlu ataması, otomatik işler, aşamalar ve süre alanlarını haritala.
4. Yeni erişim matrisi ve pasifleştirilmiş üyeler için mobil kısıtları uygula.
5. /api/mobile/v1 sözleşmesini JSON Schema/OpenAPI tek kaynakla oluştur.
6. İstek sürümünü doğrula, eski sürüme 426 ve yerel güncelleme ekranı göster.
7. Android/iOS DTO'larını ve protokol başlıklarını aynı sözleşmeye geçir.
8. Her rol için finans/müşteri/reçete sızıntı testlerini çalıştır.
9. Yerel DB ve iki platformda girişten barkoda gerçek sözleşme akışını doğrula.
10. CI yeşilse alt PR'ı mobil entegrasyona birleştir; kanıtları ve eksikleri kaydet.

## Uyumluluk haritası
| Kavram | main | night-2 farkı | Mobil sınır |
|---|---|---|---|
| RAL/boya | colorInfo + iş emri color | aynı | yalnız renk kodu/hex/boya, konfigurasyon değil |
| Üretim sorumlusu/otomatik iş | atama + sipariş dönüşümü var | genişletilmiş kayıt zinciri | atanmış iş/operasyon sorgusu |
| Süre/kalite/rework | üretim operasyonları | neden kodu ve derinlik kaydı | mevcut işlem kuralları, teknik DTO |
| Kesim planı | üretim platformu | sürüm geçmişi | çubuk/parça teknik projeksiyonu |
| Yeni roller | 6 temel rol | operator/warehouse + custom matrisi | temel yetkinin üstüne çıkılmaz |
| Montaj | main'de yok | teknik çalışan görünümü adres gizler | adres varsayılan kapalı; yeni yetki kararı gerekir |
| Bildirim | web bildirimleri | erişim/oturum iptali | cihaz/push sağlayıcısı bağlanmadı |

## Tur durumu — son değerlendirme

| Adım | Durum | Kanıt / kalan |
|---|---|---|
| 1 Uyumluluk | Tamamlandı ve entegrasyona alındı | #54–55, main/night-2 yerel build + gerçek HTTP, rol DTO sınırları, Android/iOS sözleşme |
| 3 Kalıcı çevrimdışı | Tamamlandı ve entegrasyona alındı | #56, Room/SwiftData, kayıp onay ve kopan büyük fotoğraf, çift gönderim, çatışma/yeniden atama |
| 4 Saha | Çalışan kapsam tamamlandı ve entegrasyona alındı | #57; kamera/barkod, kesim, RAL/aile, üretim/fire/gecikme/rework, montaj teknik kayıt/fotoğraf; adres/onay linki yetki gereği kapalı, uzak push bağlanmadı |
| 2 Oturum/cihaz | Kod hazır, CI/merge bekliyor | #58; 15 dakika erişim, dönen refresh, cihaz iptali ve opsiyonel biyometri; iOS Keychain simülatör test imzası son düzeltmesi doğrulanmadı |
| 5 Tasarım/erişilebilirlik | Kod hazır, son iOS CI/merge bekliyor | #59; Türkçe 205 Android / 246 iOS kaynak, tablet liste+detay, haptik/büyük hedefler; Android yerel lint/derleme geçti |
| 6 Yayın hattı | Kaynak ve belge hazır; imza/yayın yapılmadı | #59; OpenAPI 1.2.0/build 3, CI/version/signing, providersiz telemetri, MOBILE_RELEASE; Apple/Play hesabı ve sertifika yok |
| Ayrı web cihaz sayfası | Taslak | #60; /mobile-devices, yalnız kendi cihazlarını iptal; 3 yerel güvenlik testi geçti; #58'e bağımlı |

- Son kod `codex/mobile-release`, son APK 1.2.0 debug. **Canlı site bu kodu sunmuyor**; test sunucusuna aynı mobil API ve yerel migration kurulmalıdır. Production/main/night-2 değiştirilmedi.
- GitHub yeni runner'ları ödeme/harcama limiti gerekçesiyle başlatmıyor. Son değişiklikler taslak PR'da; CI geçmeden merge edilmedi. Hesap billing ayarına dokunulmadı.
- Durdurma koşullarındaki iki farklı başarısız çözüm / 4 saat / çözülemeyen DTO sızıntısı oluşmadı. Devamı engelleyen somut dış neden GitHub runner başlangıcının reddidir.
- Son kaynakla yerel web **92 paket / 630 test**, type-check/lint/guardrails/production build geçti. Web cihaz sayfası ayrı **3 test** geçti. Main ve night-2 gerçek HTTP: saha **6**, outbox **4**, oturum güvenliği **4 senaryo grubu**, hepsi geçti.
- Son başarılı tüm native CI: Adım 4 (`30f35de`) Android **10 JVM + 11 emülatör** ve iOS **18 birim + 1 UI**. Yeni oturum testleri Android iki ek JVM; iOS iki ek birimdir. iOS son imzasız CI 18/20 birim + UI geçti; iki Keychain testi imza nedeniyle hata verdi, testler korunup test imzası düzeltildi. Son düzeltmenin CI'sı billing nedeniyle başlayamadı.
- Bu plan kapsamında başlangıç native sürümüne göre **54 web testi** (51 mobil API + 3 ayrı cihaz sayfası), Android **7 JVM + 9 emülatör**, iOS **16 birim** eklendi; mevcut UI testleri korunur.
- Toplam mobil testler kaynakta: web mobil sözleşme/yetki/sync/context/push/yönlendirme paketleri + cihaz sayfası 3 test; native Android 12 JVM/11 emülatör, iOS 20 birim/1 UI. Parametrik testler gerçek yürütme sayılarıyla yukarıda raporlanır; "test tanımı" ile "senaryo grubu" aynı sayı değildir.
- Gerçek cihaz kamera/Face ID/parmak izi/Keychain, fiziksel uçak modu, saha ağı, düşük pil ve OS arka plan planlaması **doğrulanmadı**. FCM/APNs, crash ve analitik **bağlanmadı**; Play/TestFlight **yayınlanmadı**.

## Çevrimdışı mimari kararı
Android Room, iOS SwiftData. Kullanıcı/tenant/sunucu kapsamlı yerel snapshot ve outbox, atomik enqueue, her komutta istemci UUID'si ve sunucuda aynı kimliğe yalnız tek sonuç. Sırayla eşitleme; 401/403 işlem gönderimini durdurur; 409 çatışma olarak saklanır, otomatik ezilmez. Çatışmada “Yine de uygula” her koşulda yetki ve durum kurallarını yeniden doğrulayan **yeni** bir işlem üretir; atanmadığı/iptal işte mümkün değildir. Fotoğraf yükleme Vercel gövde sınırını aşmayan parçalara bölünür; sunucu kabul edilen parça durumunu döndürür. Sürüm 1.0 uygulamanın mevcut tek bekleyen işlemi kayıpsız taşınır.

### Uyumluluk kontrol noktası
- Yönlendirme PR #54 yalnız mobil entegrasyona merge edildi; iki web validate CI başarılı. Vercel preview hesabın proje işbirliği ayarı nedeniyle başarısız; dağıtım yapılmadı.
- Fotoğraf testinin ilk 500 hatası: depolama servisinin geniş DTO'su dar `Photo` sözleşmesine uymuyordu; yalnız `url` projeksiyonu ile düzeldi.
- Production build yerel HTTP fotoğrafında 409: yerel depolama production modunda varsayılan kapalı. Yalnız test sunucusunda `ALLOW_LOCAL_STORAGE=1` ile tam akış geçti. Canlı ayarlar değiştirilmedi.
- Aynı hata için iki başarısız çözüm koşulu oluşmadı.

### Adım 1 doğrulaması
- Yerel web validate: **90 paket / 607 test**, guardrails, type-check, lint ve production build geçti. Eklenen web testleri: 19 sözleşme + 8 montaj/bildirim + 1 yönlendirme.
- Android: 5 mevcut birim + 1 gerçek HTTPS sözleşme testi geçti; debug derleme/lint geçti.
- iOS macOS CI (`37987542197`, `d3a2994`): **5 birim/sözleşme + 1 UI testi**, sıfır hata; gerçek HTTPS kalite/fotoğraf/barkod akışı geçti.
- `night-2@1b59bba` ayrı, detached test alanında birleştirildi. Proxy ve CI filtre çakışmaları web erişim kuralları korunarak çözüldü; hedef dallara yazılmadı. night-2 production build ve 30 ilgili test geçti.
- Main tabanı yeni gece şemasıyla: gerçek HTTP altı rol DTO kontrolü, depo/custom rol yazma engeli, pasifleştirme, sessions_valid_after, teknik montaj/bildirim ve ortak tercihler geçti.
- Otomatik iş emri/atama web kaynağı aynen kullanılır; mobil ikinci iş emri üretmez. Süre mevcut operasyon alanlarıyla taşınır; fire/gecikme/rework yazma ve arayüzleri Adım 4'tedir.
- Montaj adres/harita ve müşteri onay bağlantısı saha DTO'sunda **kapalı**: night-2 çalışan görünümü müşteri adresini yasaklar; bu veri sınırı genişletilmedi.
- CI Linux hazırlığında Homebrew bulunamadı; hazır olma kontrolü POSIX grep'e geçirilerek düzeltildi. Testler atlanmadı.

## Adım 3 planı (10 satır)
1. Sunucu/kullanıcı/tenant kapsamlı Room ve SwiftData depolarını oluştur.
2. İş/operasyon/çizelge/detay/referans snapshot'larını atomik sakla ve bağlantısız aç.
3. Tek eski bekleyen komutu aynı UUID ile yeni outbox'a kayıpsız taşı.
4. Tüm saha yazmalarını önce diske yaz; gönderildi onayı gelmeden silme.
5. Sunucuda kullanıcı kapsamlı makbuz tablosu ve atomik not/kontrol/durum işlemleri ekle.
6. Üretimde mevcut transaction/idempotency defterini aynı istemci UUID'siyle kullan.
7. Fotoğrafı küçük, hash doğrulanan parçalara ayır; kesilince onaylanan ofsetten devam et.
8. 409/403/404 ve bozuk kayıtları açık çatışma/kısıt ekranında tut; otomatik ezme yapma.
9. Sıralı yeniden deneme, bekleyen sayaç/ikon/zaman ve WorkManager/BGTaskScheduler ekle.
10. Çevrimdışı→tek kayıt, çift gönderim, yeniden başlama ve bozuk kuyruk testlerini iki platformda çalıştır.

Adım 3 başlangıcı: 2026-10-09 20:39 UTC. Adım 1 son feature CI devam ediyor; CI geçmeden PR #55 merge edilmez. Yeni iş ayrı `codex/mobile-offline-outbox` dalında. Son üretim ortamına geçiş için mobil migration'lar belgeyle ayrı uygulanmalıdır; otomatik production DDL yok.

### Adım 3 sunucu kontrol noktası
- Bitti: `/sync` kullanıcı/tenant kapsamlı UUID ve canonical hash; not/kontrol/durum + makbuz aynı transaction. Üretim mevcut atomic ledger ile; bağlantı havuzu için iç içe transaction yok.
- Bitti: `/uploads` 256 KiB parçalar, parça/bütün SHA-256, kalan ofset ve aynı dosya URL'si. Final dosya metadatası + onay aynı transaction.
- Yerel gerçek DB testleri: aynı notun 8 eşzamanlı gönderimi tek kayıt; aynı UUID farklı içerik 409; checklist/stale revision çatışması; üretim çift gönderim ve kayıp onay tek miktar; kopan fotoğraf devam/bozuk hash/çift finalize tek dosya; yeniden atama/iptal/üyelik iptali yazmayı engeller. Hepsi geçti.
- 11 yeni sözleşme/hash testi geçti; type-check geçti. Gerçek HTTP entegrasyon testi native CI hazırlığına eklendi.
- Sürüyor: Room/SwiftData, yerel queue UI ve arka plan çalışanı. Bu aşamada uçak modu kullanıcı arayüzü henüz doğrulanmadı.

### Native çevrimdışı kontrol noktası
- PR #55 tüm GitHub CI kontrolleri başarılıyken mobil entegrasyona merge edildi (`08aceec`). Main/night-2 değiştirilmedi.
- Yeni Android debug derleme, **8 birim/HTTPS testi**, lint ve Room emülatör testlerinin derlemesi geçti. Room 7 kalıcılık/çatışma testi henüz cihazda CI'da sürüyor.
- iOS macOS CI `37991727038`, `623c9c5`: **13 birim/sözleşme/SwiftData + 1 UI**, sıfır hata. Diskte cache/queue kalması, tek gönderim, bozuk yarım JSON'u koruma, çatışma ve yeniden atama geçiyor.
- Web **91 paket / 618 test**, guardrails/type-check/lint/build geçti. Gerçek HTTP `/sync` ve `/uploads` testi de tüm dört senaryo grubunu geçti.
- İki platforma ayrıca gerçek sunucuda kayıp üretim onayı, >256 KiB fotoğrafın ikinci parçasında ağ kopması, depo yeniden açılışı, aynı UUID ile devam ve tek miktar testleri ekleniyor. Sonuçları henüz tamamlanmadı.
- Uçak modu taşımada hata enjekte edilerek sınanıyor; gerçek cihaz uçak modu/OS arka plan zamanlaması **doğrulanmadı**.
- Cache notları snapshot'ta son 20/iş, toplam en fazla 500; online detay daha geniş geçmişi getirir. Arka plan çalışması OS koşullarına bağlı; kayıt diskte kalır, ön planda eşitleme her zaman kullanılabilir.

### Adım 3 night-2 kontrolü
- Güncel mobil-owned API/sözleşme ayrı night-2 test kopyasına taşındı; gece dalının web kodu korunuyor.
- Production build ve gerçek HTTP `/sync`/`/uploads` dört senaryo grubu geçti; main/night-2'ye merge veya production migration yapılmadı.
- iOS ağ kesintisi test sınıfında `URLProtocol.task` ad çakışması derleme hatası verdi; test alanı `forwardingTask` olarak düzeltildi. Test atlanmadı, CI yeniden çalışıyor.

## Adım 4 planı (10 satır)
1. Teknik ürün ailesi simgesi, RAL/boya ve kalan adet halkasını kartlarda birleştir.
2. Başla/Duraklat/Bitti kontrolünü büyük hedeflerle üretim akışına bağla.
3. Kesim çubuklarını yerel snapshot'tan çiz; parça bilgisi ve yakınlaştırma ekle.
4. Android CameraX + gömülü ML Kit kur; kamera izni ve elle giriş yedeğini koru.
5. Fire/gecikme nedenlerini güncel firma kataloğuyla doğrula ve atomik outbox'a ekle.
6. Rework komutunu mevcut web üretim hizmetiyle aynı kurallara bağla.
7. Montaj ekibinin teknik liste/kontrol/eksik-hasar kayıtlarını yetki ve sürümle sınırla.
8. Müşteri iletişimi/adres/onay kimliği DTO sınırını genişletme; kapalı özellikleri açıkça belgele.
9. Bildirim tercihleri, cihaz jetonu kaydı ve bağlanmamış FCM/APNs arayüzünü ekle.
10. Rol gizleme, tarama/kesim ve yeni yazma senaryolarını yerel API ve native CI'da doğrula.

Adım 4 başlangıcı: 2026-10-09 21:27 UTC. Adım 3 PR #56 CI sonucu bekleniyor; yeni saha işi ayrı dalda, CI yeşil olmadan entegrasyona alınmaz.

### Saha ilk kontrol noktası
- CameraX + gömülü ML Kit; kamera izin reddi/elle giriş; iki platformda kesim çubukları, parça dokunma ve yakınlaştırma.
- Kalan adet halkası ve büyük üretim kontrolü; gerçek RAL/boya bilgisi korunuyor.
- Fire/gecikme atomik makbuzla aynı night-2 tablolarına yazar; neden kodunun güncel/aktif olması ve iş kapsamı yeniden kontrol edilir. Fire stok hareketi değildir; depo kuralları web kaynağında kalır.
- Rework mevcut üretim transaction/defterine bağlı. Yerel DB üç grup geçti: tek fire/kapalı neden/açık gecikme; rework tek miktar; iptal iş engeli. 4 yeni sözleşme testi geçti.
- iOS Adım 3 son CI (`37993178588`, `f8ed7c7`): **16 birim/sözleşme/SwiftData + 1 UI**, yeni kayıp-onay/kopan-büyük-fotoğraf gerçek HTTPS senaryosu dahil sıfır hata.
- Android Adım 3 emülatörü hâlâ CI'da; saha devamı entegrasyona alınmadı. Montaj yazmaları/bildirim ekranları/rework arayüzü sırada.

### Adım 3 tamamlandı
- PR #56, GitHub web + sözleşme + Android + iOS kontrolleri başarılıyken yalnız `codex/mobile-integration`'a merge edildi: `2ae4e19` (Türkiye saati 10 Ekim 00:39).
- Android CI `37993178588`: debug/birim/lint ve emülatör testleri geçti; kalıcı Room ve gerçek HTTPS kayıp onay/kesilen fotoğraf senaryosu dahil. iOS 16 birim + 1 UI geçti.
- Vercel preview dış hesap/proje erişim ayarı nedeniyle engellendi; canlı dağıtım veya ortam değişikliği yapılmadı. Entegrasyon kabul ölçütü GitHub testleridir.
- Gerçek cihaz, fiziksel uçak modu ve OS arka plan zamanlaması halen doğrulanmadı.

### Montaj kontrol noktası
- Teknik montaj detay API'si, ekip kapsamı, sürüm kontrolü, atomik kontrol/eksik/hasar kayıtları ve tekrar gönderim koruması eklendi.
- İki platformda yerel montaj listesi/detayı ve outbox. Üretim yazma yetkisi olmayan montaj rolü ayrı modül yetkisiyle çalışır; müşteri DTO sınırı korunur.
- Yerel gerçek DB montaj testi geçti: iki start tek sürüm artışı, stale sürüm reddi, checklist + tek issue, ekipten çıkarılınca 404. Kamera/kesim Android derleme ve lint geçti.
- Sırada: native montaj CI, rework arayüzü, fotoğraf/bildirim altyapısı; oturum ve yayın adımları.

### Saha fotoğraf/bildirim kontrol noktası
- Montaj fotoğrafları aynı resumable uploader ile web `record_attachments` tablosuna gider; ekip kapsamıyla korunan JPEG okuma ucu vardır. Yerel DB tek dosya/tekrar finalize/ekipten çıkarılınca okuma engeli geçti.
- Yerel şema 002 hedefin yalnız iş emri veya montaj olmasını zorlar; 003 özel cihaz push kaydı ekler. Production'a uygulanmadı.
- Bildirim metadata ve web tercihleri görünür; gecikme tercihi hem deadline hem order:delayed türünü kontrol eder. FCM/APNs kayıt köprüleri ve sunucu gönderici arayüzü var; SDK/sağlayıcı anahtarı bağlı değil, teslim başarılı gösterilmez. OS yerel test düğmesi ayrı.
- Montaj-only custom role: giriş/teknik detay çalışır, üretim snapshot boş ve üretim yazması 403; cihaz kayıt yanıtında sağlayıcı tokeni yok.
- API/DTO birim testleri ve native montaj overlay/önceki fotoğraf kuyruk uyum testleri eklendi. Fotoğraf içeren yerel testte depolama açıkça local seçilmediği için ilk deneme hata verdi; yalnız test process'inde local depolama seçilerek düzeldi.

- Son iOS kontrolünde eski fotoğraf JSON'unda eksik `name` alanı okuması başarısız oldu. Decoder varsayılan dosya adını açıkça uygulayacak şekilde düzeltildi; test korunuyor. Montaj detayı hızlı değiştirilince eski ağ yanıtının yeni seçimi ezmesi de seçim kimliğiyle engellendi.

## Adım 2 planı (10 satır)
1. Mevcut web parola doğrulama ve giriş denemesi sınırını mobilde yeniden kullan.
2. 15 dakikalık erişim ve 30 günlük dönen yenileme jetonlarını yalnız mobil API'de üret.
3. Jetonun yalnız hash'ini sakla; tekrar kullanımda cihaz oturumunu iptal et.
4. Ağda kaybolan yenileme yanıtını aynı istemci UUID'siyle güvenli biçimde tekrar al.
5. Mobil cihazları mevcut night-2 user_sessions tablosuyla uyumlu kaydet ve iptali her istekte kontrol et.
6. Android/iOS ağ katmanlarında yenilemeyi seri yap ve Keystore/Keychain'e atomik yaz.
7. Çıkışta oturumu iptal et; çevrimdışı kuyrukları kullanıcı kapsamıyla koru.
8. Ayrı, küçük web cihaz yönetimi yüzeyinde kendi cihazlarını listeleme/iptal etme ekle.
9. İsteğe bağlı cihaz biyometrisiyle uygulama kilidi ve arka plan gizlilik örtüsü ekle.
10. Döndürme, kayıp yanıt, tekrar kullanım, üyelik kaldırma ve cihaz iptalini gerçek yerel DB'de test et.

Adım 2 başlangıcı: 2026-10-09 22:03 UTC. Adım 4 PR #57 düzeltme CI'sı bekleniyor; entegrasyona yalnız başarılı CI ile alınır.

### Oturum kontrol noktası
- Mobil giriş mevcut parola/deneme sınırını kullanır; erişim 15 dakika, yenileme 30 gün. Veritabanında hash ve kısa süreli şifreli tekrar yanıtı vardır; açık yenileme jetonu saklanmaz.
- Gerçek DB dört grup geçti: döndürme/kayıp yanıt; tüketilmiş jetonun farklı UUID ile tekrarı tüm cihazı kapatır; mevcut user_sessions web iptali hemen keser; üyelik kaldırma/cihaz iptali.
- Android/iOS ağ katmanı yenilemeyi seri yapar, aynı istek UUID'sini ağdan önce güvenli depoya yazar, hesap değişiminde eski istek yeni hesaba erişemez. Yerel outbox korunur.
- İsteğe bağlı biyometrik/cihaz kilidi ve arka plan gizlilik örtüsü eklendi. Fiziksel Face ID/parmak izi testi **doğrulanmadı**.
- iOS ilk oturum CI derleme + 18 birim/1 UI başarılı; yeni oturum birim testleri sırada. Yerel web 92 paket/629 test başarılı.
- night-2 ayrı test kopyası: güncel saha/oturum API'si production build ve gerçek HTTP saha 6 grup + outbox 4 grup + oturum 4 grup geçti. Hedef web dalları değişmedi.
- Yerel native test yeniden çalıştırılırken önceki testin kullandığı operasyon sürümü nedeniyle 409 verdi; fixture her çalıştırmada yeniden oluşturulur. CI zaten izole fixture kullanıyor; test veya üretim davranışı gevşetilmedi.

## Adım 5 planı (10 satır)
1. Nötr/kobalt açık-koyu tema ve geometrik simgeyi koru.
2. Android kullanıcı metinlerini Türkçe strings.xml kaynaklarına taşı.
3. iOS kullanıcı metinlerini Türkçe Localizable.strings dosyasına taşı.
4. Dinamik sayı/değişken metinlerinde yerelleştirilmiş biçim argümanları kullan.
5. Büyük yazı ve kaydırma davranışlarını telefon/tablet düzenlerinde kontrol et.
6. Dokunma alanlarını Android 56dp/iOS 48pt sınırına getir.
7. Anlamlı ikon etiketlerini ve ekran okuyucu durumlarını tamamla.
8. Başarı/hata haptikleri ve mevcut ortak boş/hata/offline bileşenlerini kullan.
9. Tabletlerde iş listesi ve detayını aynı ekranda göster.
10. Kaynak bütünlüğü, native derleme/lint ve mevcut UI testlerini koruyarak doğrula.

Adım 5 başlangıcı: 2026-10-09 22:12 UTC. Önceki adımların Android CI'sı beklenirken bağımsız native tasarım hazırlığı ayrı dalda yapılır.

### Tasarım kontrol noktası
- Türkçe kullanıcı metinleri Android strings.xml ve iOS tr.lproj/Localizable.strings'e taşındı; dinamik metinler biçim argümanlarıyla gelir. Eksik/çift kaynak anahtarı CI'da hata verir.
- Tablet iş sekmesinde liste+detay yan yana; telefon akışı aynı. Büyük hedefler ve başarı/hata haptikleri eklendi. Mevcut nötr/kobalt açık-koyu tema ve ortak boş/hata/offline durumları korunur.
- Android oturum ekranında lint LocalContext'in Activity'ye cast edilmesini reddetti; LocalActivity'ye geçildi. Test veya lint kuralı atlanmadı.
- PR #57 tüm GitHub kontrolleri başarılıyken mobil entegrasyona merge edildi (`0b5e168`). Adım 4 tamamlandı; fiziksel kamera ve müşteri adres/onay bağlantısı halen kapalı/doğrulanmadı.

## Adım 6 planı (10 satır)
1. Native/API yol filtrelerini koru; kaynak ve proje üretiminin drift kontrolünü CI'ya ekle.
2. Sürüm adını/kodunu tek OpenAPI kaynağından üret, yayın build numarasını ortamdan al.
3. Android release imzasını yalnız secret/ortam değişkenleriyle yapılandır.
4. Elle çalıştırılan CI'da imzalı AAB üret; otomatik mağaza yüklemesi yapma.
5. macOS bulut runner'da iOS archive/export için sertifika/profil secret adımlarını hazırla.
6. Apple Developer/App Store Connect ve TestFlight gerekliliklerini açıkça belgele.
7. Hata/analitik soyutlamasını yalnız izinli adsız olaylarla kur; sağlayıcıyı bağlanmadı bırak.
8. Son sürümde Android/iOS/API/outbox testlerini ve night-2 uyumluluk kanıtlarını topla.
9. Yeni debug APK'yı sürüm ve SHA-256 ile teslim alanına koy; iOS simülatör talimatını yaz.
10. MOBILE_RUN/MOBILE_RELEASE raporunda kısmi/kapalı özellikleri ve fiziksel cihaz kontrol listesini belirt.

Adım 6 başlangıcı: 2026-10-09 22:17 UTC. Yayın hesabı/imza bilgileri yok; kaynak ve CI hazırlığı yapılır, mağazaya yayın yapılmaz.
- Yeni iOS oturum birim testleri imzasız simülatörde Keychain yazamadı. CI simülatör uygulaması geçici ad-hoc imza ve yalnız test Keychain entitlement'ı ile kurulacak; Apple hesabı/production imzası gerekmez. Testler korunuyor, fiziksel cihaz güvenli depolama ayrıca doğrulanmalıdır.

### Yayın/CI kontrol noktası
- Son sürüm 1.2.0 / build 3 tek OpenAPI kaynağına geçirildi; önceki 1.1 uygulama 426 ile güncelleme ekranına gider, bekleyen kayıt korunur.
- Android imza ortam değişkenleri, elle AAB / iOS IPA hazırlayan ve önce aynı commit'te başarılı native CI isteyen workflow eklendi. Hesap/sertifika bulunmadığı için mağaza yayını yapılmadı.
- Analitik/hata raporlama yalnız izinli enum olaylarını kabul eden kapalı arayüzdür; gerçek sağlayıcı bağlanmadı. İmza dosyası/anahtar repoya konmadı.
- GitHub yeni job'ları başlangıçta reddetti: `recent account payments have failed or your spending limit needs to be increased`. Kod testi başlamadığı için hata CI geçişi sayılmaz. Hesap billing ayarı değiştirilmedi; #58 ve sonraki işler merge edilmez.
- Çift push/PR native çalışmaları kaldırıldı: feature'larda PR, mobil entegrasyonda push ve elle çalıştırma kalır. Testler azaltılmadı; ilgili API/native yol filtreleri korunur.
- iOS Face ID izin açıklaması ve sürüm plist değişkenleri kontrol edildi; son Keychain ad-hoc test imzası ve release imzası doğrulanmadı.

## Çevrimdışı sonuçlar

| Senaryo | Sonuç |
|---|---|
| Üretim bildirimi → ağ bağlantısı tekrar → tek kayıt | İki platform gerçek HTTPS testinde geçti; fiziksel uçak modu kullanılmadı |
| Aynı UUID çift/eşzamanlı gönderim ve kayıp onay | Üretim/not/checklist/fotoğraf tek kayıt; sunucu DB + native test geçti |
| Fotoğrafın ikinci parçasında ağ kesintisi | Room/SwiftData yeniden açıldı, onaylanan 262144 ofsetten devam, tek dosya |
| İptal/başkasına atama/üyelik kaldırma | Sunucu engelliyor; terminal kayıt zorlanamaz, kuyruk görünür kalır |
| 409 revizyon çatışması | Otomatik ezme yok; izinli durumda yeni UUID ile yeniden uygulama, vazgeç arşivleme |
| Bozuk yarım JSON / yeniden başlama | Bozuk kayıt korunur ve görünür; önceden sending kalan kayıt pending'e döner |
| Yeni hesap veya tenant | Ayrı scope; eski hesap yeni jetonu ödünç alamaz |
| Refresh yanıtı kaybı | UUID önce güvenli kayda, aynı UUID ile şifreli yanıt replay; farklı UUID eski jeton kullanımı tüm cihazı iptal eder |

## Bilinen eksikler / sonra

- GitHub billing engeli çözülünce #58 ve #59 exact commit native CI yeniden çalışmalı; özellikle ad-hoc Keychain test imzası. Başarılı kontroller olmadan merge yapılmadı.
- #60 web cihaz sayfası #58'e bağımlı; ayrı güvenlik testleri başarılı, son birleşik web production sayfa testi CI'da bekliyor.
- Montaj adres/harita/müşteri onay paylaşımı kapalı; worker veri sınırı değişmez. FCM/APNs SDK ve sağlayıcı bağlantısı, crash/analitik sağlayıcıları yok.
- Fotoğraf galeriden seçilir; saha kameradan doğrudan fotoğraf çekme akışı henüz yok. Gerçek barkod kamera akışı vardır.
- Kesim çizimi kerf/fire alanını gri gösterir; gerçek kamerada düşük ışık/hasarlı etiket performansı doğrulanmadı.
- Cache snapshot 100 iş / 300 üretim işi sınırında; notlar son 20/iş ve toplam 500. Online detay daha geniştir.
- Offline timer server tarafından teslim zamanında uygulanır; saatlerce çevrimdışı start/pause sürelerinin geriye dönük muhasebesi eklenmedi.
- Montaj complete web durum akışıyla uyumludur, bütün checklist'lerin zorunlu olması kuralı eklenmedi. Durum değişiminde mobil AI/öneri çağırmaz.
- Arka plan WorkManager/BGProcessing çalışması OS koşullarına bağlı; belirli saniyede çalışma garantisi yok. Ön planda eşitleme kullanılabilir.
- Telefon/tablet gerçek cihaz, büyük yazı, VoiceOver/TalkBack, biyometri, mağaza imzası ve TestFlight/Play kurulumu doğrulanmadı.

## Kullanıcının fiziksel cihaz kontrol listesi

1. Aynı mobil API commit'i çalışan HTTPS test sunucusunda saha hesabıyla giriş yap; fiyat/müşteri/reçete bilgisi bulunmadığını kontrol et.
2. Kamera iznini reddet/sonra aç; elle barkod gir, gerçek QR ve çubuk/ürün etiketini farklı ışıkta tara.
3. Atanmış işleri aç, uygulamayı kapatıp uçak modunda tekrar aç; checklist/not/üretim kaydını ekle. Bekleyen sayacını ve offline ikonunu kontrol et.
4. Büyük fotoğraf seç; yüklerken ağ kes, uygulamayı kapat/aç, bağlantıyı geri getir. Tek fotoğraf ve tek üretim adedi kaldığını web'den kontrol et.
5. Aynı işi başka kullanıcı değiştirsin/iptal etsin veya atamayı değiştirsin; açık çatışma mesajını ve terminal işte yeniden uygulama engelini kontrol et.
6. İsteğe bağlı kilidi etkinleştir; arka plana al, Face ID/parmak iziyle aç. İptal/başarısızlıkta kayıtların korunmasını kontrol et.
7. Web cihaz sayfası etkinleştirildikten sonra telefon oturumunu iptal et; erişimin kesildiğini, outbox'ın cihazda kaldığını ve yeniden girişte geri geldiğini kontrol et.
8. Yerel bildirim iznini reddet/izin ver ve test et. Uzak push şu an bağlı değildir; teslim bekleme.
9. Düşük pil/arka plan/uzun bağlantı kaybında queue kaybı olmadığını kontrol et; OS zamanlamasını gerçek saha ağıyla gözle.
10. En büyük yazı boyutu, açık/koyu tema, TalkBack/VoiceOver ve iPad/Android tablet yan yana liste+detay düzenini dene.

## Teslim kanıtı

- Android son yerel `assembleDebug + testDebugUnitTest + lintDebug + compileDebugAndroidTestKotlin`: **başarılı**, 12 JVM test, 0 hata/0 atlanan. Emülatörde son tam başarılı sürüm #57'dir; son 1.2.0 emülatör testi billing engeli yüzünden çalışmadı.
- Debug APK: `/workspace/artifacts/RenkFlow-Saha-1.2.0-debug.apk` (42 MiB), package `com.renkflow.field`, versionName `1.2.0`, versionCode `3`, minSdk `26`, targetSdk `35`.
- SHA-256: `b7ae00b3001ff1afa533744d7c83a972d048ab34ea40ba080bce6e66dfe00a8d`.
- Güncel ana API production build üzerinde gerçek HTTP saha 6 + sync 4 + oturum 4 grubu geçti. Yerel web validate 92 paket/630 test başarılı. iOS son kaynak için başarılı native CI henüz yok; Keychain/test imzası düzeltmesi doğrulanmadı.
- Kod ve belge taslak PR #59; güvenli oturum PR #58; ayrı web cihaz yüzeyi taslak PR #60. #54–57 yalnız mobil entegrasyona alındı; #58–60 CI geçmediği için alınmadı.
- iOS simülatör/TestFlight/Play iç test talimatı: `docs/MOBILE_RELEASE.md`. API tek kaynak: `contracts/mobile/openapi.json`.

Web self-service: `/account` içinden `/mobile-devices` sayfasına ulaşılır. Her action güncel giriş ve üyelik üzerinden yalnız kendi cihazlarını kapatır; bekleyen saha kayıtları cihazda korunur.
