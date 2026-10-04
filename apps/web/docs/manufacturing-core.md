# Üretim çekirdeği — 4 Ekim 2026

Mevcut `/api/v1/production`, firma üyeliği, komut defteri, stok defteri ve ekranlar genişletildi. Yeni bir paralel MES veya AI stok motoru oluşturulmadı. Landing page ve görsel tasarım değiştirilmedi.

## Belge inceleme ve sipariş

`/production?tab=intake` PDF, taranmış PDF, teknik çizim ve görselleri mevcut dosya yükleme yolundan alır. GPT-6 Luna Responses API çıktısı zorunlu alanlı JSON schema/Zod ile doğrulanır. Alan kanıtı değer, modelin kendi güven değerlendirmesi, kaynak sayfa/metin ve inceleme bayrağı taşır. Güven yüzdesi kalibre edilmiş doğruluk olasılığı değildir. Kaynak dosya ve özgün extraction korunur; düzeltilmiş veri ayrıca saklanır.

İnceleme ekranı çok kalemi, birimi, gövde/kumaş/motor/LED seçeneklerini ve çıkarılmış ürün parametrelerini düzenler. En, açılım, montaj yüksekliği ve eski ürün yüksekliği ayrı tutulur. Belirsiz alanlar tek tek doğrulanmadan onay API'si sipariş oluşturmaz. Aynı içerikle tekrar onay aynı siparişi döndürür; değiştirilmiş tekrar ve eski inceleme sürümü reddedilir. JSON nesne anahtar sırası işleme tekrarını değiştirmez. AI arızasında kaynak dosya, elle kalem eklenebilen inceleme taslağı olarak kalır.

## Reçete, BOM ve rota

`/production?tab=recipes` ürün parametreleri, sayı/boolean türü ve sınırları, malzeme/kesim formülleri, opsiyon koşulları, rota, hazırlık süresi, operasyon süresi ve kalite kontrollerini saklar. Formüller mevcut güvenli ifade ayrıştırıcısıyla hesaplanır; `eval`, kullanıcı JavaScript'i veya LLM malzeme hesabı yoktur.

Yayın öncesinde en az iki farklı örnek ve beklenen malzeme miktarları doğrulanır. Yayınlanmış reçete değişmez; güncelleme yeni sürümdür. Veritabanı da yayımlanmış tanımın değiştirilmesini engeller. İş emri girdiyi, kullanılan reçete sürümünü, BOM'u ve operasyon/kalite rotasını sabitler. Yeni reçete sürümü eski iş emrini yeniden hesaplamaz. 3D model üretim reçetesi yerine kullanılmaz; doğrudan doğrulanmış ölçülerden de iş emri açılabilir.

## Kapasite ve takvim

`/production?tab=planning` mevcut merkezleri ve yeni makine/ekip/çalışan kaynaklarını yönetir. Vardiya, çalışma günleri, bakım/mola/duruş, kapasite, makine yetkinliği ve ekip üyeleri İstanbul saatinde girilir. Operasyon kaynakları ve malzemenin tahmini hazır olma tarihi sürümlü kaydedilir.

Deterministik öncelik/termin algoritması operasyon bağımlılığını, kalan üretim miktarını, gerçek çalışma süresini, hazırlığı, ortak takvimi ve her kaynağın dolu zaman aralıklarını kullanır. Çalışan farklı merkezlerde aynı anda planlanamaz. Malzeme tarihi yoksa ve stok hazır değilse uygulanabilir ETA uydurulmaz. Tahmini hazır olma tarihi stok transferinin yerini almaz. Bu algoritma geçerli sonlu kapasite planı üretir; matematiksel küresel optimum garantisi vermez.

Öneri mevcut yayınlanmış planı değiştirmez. Yönetici yayınında güncel operasyon, stok hazırlığı, kaynak/takvim sürümü ve terminlerin parmak izi yeniden kontrol edilir. Arada değişen öneri yeniden hesaplanmalıdır. Gerçek operasyon başlatma da merkez, makine, ekip ve çalışan kapasitesiyle önceki aşamaları doğrular.

## WIP, darboğaz ve ETA

Üretim olayları mevcut canlı güncelleme kanalına bağlıdır. Yönetim özeti fiziksel WIP'i iş başına yalnız ilk bitmemiş aşamada sayar; ilerideki operasyon sayısını ayrıca gösterir. Gerçek çalışma, azami kuyruk beklemesi, son 24 saat throughput, 30 günlük tamamlanmış deneme geçmişi, çevrim/bekleme medyanı ve rework oranı hesaplanır.

Geçmiş normal davranış en az beş tamamlanmış denemeden sonra güvenilir kabul edilir. Darboğaz eşikleri bir vardiyalık yük veya yeterli geçmişle kapasiteye göre yüksek kuyruk/anormal beklemedir. Sipariş ETA'sı deterministik kapasite çizelgesinden alınır. Eksik üretim emri, kalite engeli veya hazırlık bilgisi varsa ETA ve gecikme tahmini boş kalır; gerekçe gösterilir. AI hesaplanmış veriyi açıklayabilir; sayı/teslim tarihi üretim motoru değildir.

## Kalite, lot ve yeniden işlem

Kalite sonucu sipariş, iş emri, operasyon/deneme, çalışan, iş merkezi/makine/ekip, reçete sürümü, kullanılan lot ve kesim paketi bağlamını saklar. Kanıt kayıtları değişmez; yeni deneme yeni kontrol oluşturur. Başarısız kapı sonraki aşamayı bloke eder.

Yeni sarf malzemesi girişleri ve mal kabulü fiziksel lot oluşturur. Tüketim yalnız kullanılabilir gerçek lotlardan FIFO ile ayrılır. Eski toplu stok, yalnız ilgili raftaki gerçek izsiz miktar kadar `legacy_untracked` olarak tüketilebilir; lot bilgisi uydurulmaz, rezerve lot tüketilmez. Lot, stok ve raf defteri aynı transaction içinde değişir. Sarf lotu kısmi raftan/depodan aktarılınca alt lot kaynak parti/lot bilgisini korur. Profil çubuğu parçalama kesim akışında kalır.

Rework hata kategorisi, kaynak kontrol, aday/doğrulanmış kök neden, dönüş operasyonu, ek malzeme, hurda, işçilik ve çözüm taşır. Etkilenen rota ve kalite kapıları tamamlanmadan kapatılamaz. Usta kapanışı çevrim dışıyken cihaz kuyruğunda kalır; sunucu kabulüne kadar eşitlenmediği gösterilir. Sürüm/rol/firma kontrolü ve UUID aynı kapanışın iki kez işlenmesini engeller.

90 günlük kalite özeti kontrol hatalarını, ürün/operasyon rework oranını, kategori ve lot/reçete ilişkilerini gösterir. İlişki kök neden kanıtı değildir; AI yalnız aday önerebilir. Tahmini kalitesizlik maliyeti kapanmış vakaların kayıtlı ek malzemesi ve deneme olaylarından alınan veya çalışan tarafından belirtilen ek işçiliğidir. İşçilik oranı vaka açılırken sabitlenir. Para birimleri ayrı tutulur; eksik maliyet sıfır sayılmaz. Nakliye, müşteri iadesi ve fırsat maliyeti kapsama dahil değildir. Bildirilen malzeme hurdası birim bazındadır; kesim firesi ayrıca kesim planında saklanır.

## Migration ve pilot

Additive migration'lar: `023_intake_provenance.sql`, `024_recipe_parameters.sql`, `025_production_resources.sql`, `026_production_analytics.sql`, `027_quality_traceability.sql`. Eski ölçülerin anlamı, stok bakiyesi ve üretim geçmişi yeniden yorumlanmaz. Mevcut kayıtların gerçek lot bağlantısı geçmişten tahmin edilmez.

Gerçek mühendislik reçeteleri/toleransları, ekipman kg/m değerleri, vardiyalar, duruşlar ve kaynak atamaları işletme tarafından doğrulanmalıdır. Otomatik öneri eksik fabrika verisinin yerine geçmez. Pilot hâlâ makaslı tente ve özel erişimli Vercel Hobby Preview kapsamındadır; ücretli plan veya Production kaynaklarına geçiş yapılmaz.

Doğrulama komutları: `npm run type-check`, `npm run lint`, `npm test -- --runInBand`, `npm run test:production`, `npm run test:warehouse`, `npm run build`, ardından `npm run test:production:browser`, `npm run test:warehouse:browser` ve `node scripts/verify-assistant-browser.cjs`. Mutation/migration ve tarayıcı fixture'ları yalnız yerel `renkflow_test` veritabanındadır. Her ana faz kendi typecheck/lint/test/build kapısından geçirilmiştir. Raporlar ve görüntüler ignored `.data/phase*-*.log` dosyalarındadır.

Son doğrulama: **60 Jest suite / 326 test**, typecheck, lint, yerel ve Vercel production build geçti. İzole PostgreSQL üretim/depo testleri; kaynak belge inceleme/onayı ve JSONB tekrar güvenliği; sarf FIFO/lot/raf dengesi ve rezervasyon koruması; değişmez kalite kanıtı; tüm yeni migration'ların tekrarında stok/kanıt korunması doğrulandı. Gerçek tarayıcıda reçete sürümü/parametre/örnek/yayın, eski BOM'un korunması, makine takvimi, çizelge önerisi/yayını, başarısız kalite → rework → çevrim dışı çözüm kapanışı ve 31 mevcut yetkili ekran geçti. PDF masaüstü/mobilde gerçek canvas'a çizildi; QR ve Code 128 baskı PDF'sinden aynı kimliğe okundu. Gerçek GPT-6 Luna PDF/görsel extraction ve asistan çağrıları geçti. AI öneri kartının iş düğmelerini örtmesi, mevcut kartı sayfa akışına taşıyarak giderildi; görsel yeniden tasarım yapılmadı.

Dağıtım: `renkflowv2-ou85qkjjy-beshnovski-projects.vercel.app` **READY**, target Preview. `renkflow.com` ve `www.renkflow.com` bu Hobby pilotuna manuel alias edildi. Production kaynakları ve ücretli plan kullanılmadı. Mevcut özel hesapla gerçek alan adı girişi, bulut kaynak/WIP/ETA/kalite API ve ekranları, otomatik öneriler, gerçek model yanıtı ve özel Blob PDF doğrulandı. Register 403; oturumsuz AI/depo/belge 401. Yakalanmamış tarayıcı istisnası yok. Sonraki Preview deploy custom alias'ları otomatik güncellemez; doğrulama ve alias adımları tekrar gereklidir. Ayrıntılı raporlar ignored `.data/phase5-*.log` içindedir.
