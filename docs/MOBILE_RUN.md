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

## Tur durumu
- **Bitti:** ayrı çalışma alanı; main + ilk native dal çakışmasız birleştirildi.
- **Kısmi:** sürümlü sözleşme, ana dal yetki/renk/kesim DTO uyumu ve 426 ekranı. Main yerel gerçek HTTP akışı (giriş, atama, kontrol, üretim, kalite, fotoğraf, barkod, üyelik iptali) geçti. night-2 şeması ve iOS gerçek HTTPS testi sırada.
- **Sırada:** yerel kalıcı DB/outbox; saha modülleri; dönen oturumlar; erişilebilirlik ve yayın hattı.
- Eklenen test: 19 web sözleşme/yetki testi + 1 yönlendirme testi + Android/iOS için birer gerçek HTTPS akış testi. Web: 89 paket, 599 test geçti (rol HTTP kontrolü ayrıca). Android ilk derleme/birim/lint geçti; yeni gerçek HTTPS akışı da geçti. iOS yeni kodu macOS CI henüz doğrulamadı.
- Yeni APK: Android 1.1.0 derlendi; nihai dosya sonraki adımlardan sonra yeniden üretilecek.
- Gerçek cihaz kamerası, uçak modu, saha bağlantısı, düşük pil, FCM/APNs: **doğrulanmadı**.

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
