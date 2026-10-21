# Sipariş dosyası ve üretim akışı

Bu çalışma `codex/order-production-flow` dalındadır. Değişiklikler yerelde hazırlanmıştır; canlı veritabanına migration, deployment veya PR birleştirmesi yapılmamıştır.

## Teslim edilen davranış

Teklif kaydedildiğinde tek sipariş dosyası açılır. Müşteri onayına kadar bu dosya geçicidir, satış toplamlarını artırmaz ve üretime açılamaz. Onay, föy ve teknik sürümler aynı dosyada kalır. Müşteri onayı üretim onayı yerine geçmez.

Sipariş ekranı tek ana süreç gösterir: Teklif → Müşteri onayı → Liste bekleniyor → Teknik planlama → İmalat → Teslimata hazır → Araca yüklendi → Teslim edildi. Usta, kendi üretim listesinde uygulanabilir işlemleri ve miktarlarını görür. Mevcut iş emirleri, operasyonlar, stok ilişkileri ve geçmiş kayıtlar kullanılmaya devam eder.

| Sıra | Kullanılabilir sonuç | Bağımlılık ve doğrulama |
| --- | --- | --- |
| 1 | Makaslı tente: tek teklif/sipariş dosyası, müşteri onayı, föy, otomatik 170 dere, gerçek stoktan kesim, teknik sürüm ve üretime açma | Doğrulanmış ürün reçetesi, atölye kesim değerleri, fiziksel stok; `test-order-technical.ts` |
| 2 | Ustanın miktar bazında kesim ve boya kaydı, ürün kategorileri, stok tarama ve mevcut etiket araçları | Canlı yetki ve işe atama kontrolü; `test-order-technical.ts`, `test-access.ts`, `test-warehouse.ts` |
| 3 | Siparişe bağlı ihtiyaç → satın alma → belge okuma/eşleştirme → fiziksel kontrol → nihai kabul | Satın alma yetkileri, açık sipariş ve gerçek boy dağılımı; `test-workshop.ts` |
| 4 | Kesim ve ürün tamamlandıktan sonra kontrollü revizyon; ortak planda diğer siparişlerin devam etmesi; eski kesim ve maliyet geçmişinin korunması | Kritik revizyon ve fotoğraflı fiziksel ürün/malzeme kararı; `test-product-deliveries.ts` |
| 5 | Kısmi üretim, tamlık kontrolü, fotoğraflı yükleme, kısmi teslim ve siparişe bağlı montaj | Güncel teknik sürüm, tamamlanan ürün miktarı; `test-order-technical.ts` |
| 6 | Pergolada açıkça belirtilen klasik/oval dere; manuel, pistonlu ve motorlu giyotin için en/yükseklik esaslı reçeteler | Ürün ailesine bağlı yayımlanmış standart; dikey ürünlerde teknik kaynak zorunlu; `test-product-deliveries.ts` |
| 7 | Potansiyel müşteri bağlamı, satış önceliği, kaynaklı AI firma araştırması, insan doğrulaması, teklif sürümleri ve otomatik kazanılma bağlantısı | CRM yetkisi, mevcut Claude anahtarı ve Asistan ayarları; `test-lead-sales.ts`, `test-company-research.ts` |

Her eklenen ekran Türkçe işlem adları, mobil yerleşim ve açık/koyu tema ile hazırlanmıştır. Son kontrol, bu ekranların bütünlüğünü doğrular.

## İlk makaslı tente kabul senaryosu

1. Teklifin dosyası oluşturulur; yeniden gönderilen aynı kayıt ikinci dosya açmaz. Müşteri onayı olmadan üretim reddedilir.
2. Onaylanan teklif aynı dosyada siparişe bağlanır. Föy ve varsa asıl PDF bu dosyada saklanır; yeniden yükleme yeni sipariş oluşturmaz.
3. En, açılım, bölmeler, renk/yüzey ve adet kontrol edilir. Eksik veya okunamayan sayfa bilgileri teknik onayı engeller.
4. Dere satırı otomatik 170 profile bağlanır. Belirsiz diğer profiller kontrol edilir; kullanıcıya tekrar dere türü sorulmaz.
5. Uygun boyalı stok, ardından uyumlu boyasız stok değerlendirilir. Tam boylar ve kullanılabilir artıklar gerçek fiziksel boylarıyla karşılaştırılır. Başka renkte boyalı, hurda veya ayrılmış stok kullanılmaz.
6. Her kaynak çubuğun kesimleri, testere/uç düzeltme payı, kullanılabilir artığı ve kaybı gösterilir. Gramaj eksikse ağırlık hesaplanmış gibi gösterilmez. Fiziksel boy belirsizse kesin satın alma veya yanıltıcı sıfır fire gösterilmez. Yerleşim matematiksel optimum garantisi taşımaz.
7. Geçerli kayıtlı 3D ürün yapılandırması varsa aynı ölçülerle etkileşimli gösterilir. Diğer durumda yalnız föyde doğrulanmış boyutlardan ölçülü görünüm hazırlanır; eksik yükseklik, mekanizma ve delik ölçüsü üretilmez. 3D telefonda istek üzerine açılır.
8. Delik kuralları referans ucu, yüz, çap, kenar mesafesi, kaynak ve sürümle kaydedilir. Kaynağın açıkça “delik yok” dediği parça da gerekçesiyle tanımlanabilir. Kuralı kaydetmek mevcut teknik sürümü sessizce değiştirmez. Eksik kural ilgili delme ve ürün tamamlama işlemini engeller.
9. Yetkili teknik onayında föy kesimleri mevcut reçete motorunun kesimleriyle karşılaştırılır. Uyuşmazlık veya değişmiş stok işlemi durdurur. İşler ve rezervasyon tek transaction içinde oluşturulur.
10. Usta aynı teknik sürümün gerçek çubuklarını kısmen kesebilir. Uygun boyalı parçalar boya beklemez; boyasızdan kesilen parçaların hedef rengi ve gidiş/dönüş miktarları korunur. Hazır miktar sonraki işleme ilerler.

Kullanılan mevcut servisler: teklif/sipariş servisi, yayımlanmış reçete motoru, fiziksel çubuk çözücü, kesim yerleştirme ve rezervasyon motoru, stok hareketleri, üretim operasyonları, kayıtlı 3D bileşenleri, bildirimler ve montaj kayıtları. Yeni sipariş teknik sürümleri ve parça kayıtları bu servisleri birbirine bağlar.

## Doğrudan işlem ve ayrıca onay

“Doğrudan” işlem de oturum, güncel yetki, firma, atama, teknik sürüm, miktar, zorunlu kontrol ve gerektiğinde fotoğraf doğrulamasından geçer. Rol adı tek başına onay yetkisi sağlamaz.

| İşlem | Yetkili kullanıcı doğrudan yapar | Ayrıca karar/onay |
| --- | --- | --- |
| Teklif veya föy hazırlama | Ofis/yönetici, ilgili düzenleme yetkisiyle | Üretime açmaz |
| Müşteri teklif onayı | Mevcut müşteri onayı/kayıt yolu | Üretime açmaz |
| Teknik planı üretime açma | — | Üretim onay yetkisi; müşteri onayı ve güncel stok tekrar doğrulanır |
| Kritik ölçü, renk veya adet revizyonu | Değişiklik talebi hazırlanabilir | Üretim onay yetkisi; eski teknik sürüm durdurulur |
| Kesilmiş parçayı yeniden kullanıma/hurdaya ayırma | — | Gerekçeli malzeme kararı; ardından yeni teknik plan onayı |
| Tamamlanmış ürünü stokta koruma / hurda / fiilî söküm | — | Üretim onay yetkisi, güncel miktar/sürüm, ilgili ürüne ait fotoğraf; yüklenmiş ürün için önce iade/fiziksel kontrol gerekir |
| Ortak kesimde diğer listelerin devam planı | — | Etkilenen listeler ve plan sürümü açıkça kabul edilir; diğer parçaların fiziksel çubuk atamaları korunur |
| Kesilen çubuğu kaydetme | Atanmış, üretim düzenleme yetkili usta | Yönetici onayı beklemez |
| Boyaya gönderme / gelen miktarı kaydetme | Atanmış yetkili usta | Yönetici onayı beklemez; durmuş sürümde boya dönüşü fiziksel geri gelişi kaydedebilir |
| İşlem ve kontrol listesi tamamlama | Atanmış yetkili usta | Yönetici onayı beklemez; zorunlu kalite/fotoğraf şartları sunucuda kontrol edilir |
| Üretim ihtiyacı bildirme | Yetkili usta, kendi siparişinden | Talep ve satın alma mevcut satın alma onay yetkileriyle ilerler |
| Satın alma taslağı | Satın alma oluşturma yetkisi | Siparişi gönderme/onaylama ayrıca satın alma onay yetkisi ister |
| Belge okuma / fiziksel mal kontrolü | Mal kontrol yetkili kullanıcı/usta | Stok artırmaz |
| Nihai mal kabul / kabul ters kaydı | — | Satın alma onay yetkisi |
| Yükleme ve teslim kaydı | Atanmış üretim düzenleme yetkili kullanıcı | Yönetici onayı beklemez; hazır miktar, tamlık kontrolü ve yükleme fotoğrafı zorunlu |
| Etiket hazırlama / yeniden yazdırma | Mevcut stok görünürlüğü kapsamında | Stok miktarını değiştirmez |
| AI firma araştırması / kaynak doğrulama | CRM düzenleme yetkili kullanıcı | Her aramada yönetici onayı beklemez; mevcut firma model/KVKK/bütçe ayarları geçerlidir; bulunan alıntılar önce kontrol bekler |

## Kesim sonrası geçiş

Siparişin kritik bilgisi değiştiğinde eski teknik sürüm ve çalışan işlem durdurulur. Yeni föy eski parça planını değiştiriyorsa doğrudan üretime açılamaz. Her fiziksel parça için yeniden kullanım veya hurda kararı gerekir. Boyadaki parça önce geri kaydedilir.

Yeniden kullanılacak parça gerçek boy, fiziksel renk, kaynak parça ve biliniyorsa gramaj/maliyet bilgisiyle kullanılabilir stok olur. Yeni kesimde testere payı tekrar hesaplanır. Hurda ayrı karar geçmişine girer. Kesilmemiş çubukların rezervasyonu bırakılır; eski işler iptal durumuyla, gerçekleşmiş kesim/fire ve stok hareketleri korunarak saklanır. Sonra güncel stoktan yeni sürüm hazırlanır ve ayrıca onaylanır. Eski gerçekleşmiş hareketler ters çevrilmiş gibi gösterilmez.

Aynı parça, ürün parametreleri ve malzeme yapısı korunuyorsa ve henüz tamamlanmış ürün yoksa yalnız teknik bilgi/kural revizyonu stok hareketi yaratmadan yeni sürüme taşınır. Eski sürümle günlük işlem gönderilmesi reddedilir.

Tamamlanmış ürün varsa yetkili, her üretim listesindeki tamamlanmış miktarın tümü için stokta koruma, hurdaya ayırma veya fiilen söküm kararı verir; sürüm, seri sayısı, fiziksel stok ve ilgili fotoğraf sunucuda doğrulanır. Stokta koruma mevcut ürünü ikinci kez stok yapmaz; sipariş yeni ölçüleriyle yeniden üretilir. Hurda ve söküm, bitmiş ürün stoğundan yeni hareketle çıkar. Sökümde eski tüketim/üretim kaydı değişmez; geri kazanım ayrı hareketle izlenir. Sökülen profilin yeniden kullanımında gerçek kullanılabilir boy ölçülür; önceki boyu aşamaz, aradaki fark hurda olur. Aksesuarların yeniden kullanılabilirliği ayrıca kaydedilir. Eski altyapıda parçalar tekil ürün serilerine bağlanmadığından rastgele bir seriye parça atayıp kısmi söküm uydurulmaz. Yüklenmiş/teslim edilmiş ürün, iade ve fiziksel kontrol yapılmadan bu yoldan değiştirilmez.

Başka siparişlerle ortak eski kesim planında yetkili, etkilenen diğer listeleri ve güncel plan sürümünü görüp kabul eder. Gerçekleşmiş çubuk kesimleri ve kayıpları eski planda kalır. Kesilmemiş parçalar, diğer siparişlerin aynı fiziksel çubuk atamaları korunarak ayrı devam planına taşınır; kaldırılan kesimlerin testere payı ve yeni artık yeniden hesaplanır. Yalnız serbest kalan çubuklar kullanılabilir olur. Eski planın tekrar iptal veya kesim kaydıyla devam planını bozması engellenir. Bütün karar, rezervasyon ve stok değişiklikleri tek transaction içindedir; eksik kabulde hiçbiri kalıcı olmaz.

## Kaynaklı AI firma araştırması

Mevcut `AIService`, Claude hesabı, CRM yetkileri ve Asistan ayarları kullanılır; ek arama servisi hesabı veya yeni modül gerekmez. Kullanıcı kaydedilmiş firma adı, ülke ve şehirle araştırmayı başlatır. İç görüşme notu, özel kişi iletişim bilgileri ve teklif tutarı sağlayıcıya gönderilmez. Modelin kendi yazdığı özetler kanıt sayılmaz: yalnız gerçek web araması sonuçlarına verilen sağlayıcı atıflarının kaynak URL'si, başlığı ve birebir alıntısı kaydedilir. Firma/şube eşleşmesi insan tarafından kontrol edilir; bulgular otomatik doğrulanmaz ve satış önceliğini değiştirmez. AI alıntısının içeriği/kaynağı sonradan değiştirilip AI bulgusu gibi sunulamaz; gerekirse ayrı yeni kaynak eklenir. Kullanıcı araştırma konusunu düzeltebilir ve kaynağı doğrulayabilir/reddedebilir. Yedi konunun sınıflandırması ayrı sınırlı çağrıdır; başarısız olursa gerçek alıntılar korunur ve eksik sınıflandırma açıklanır.

Araştırma başına en fazla üç web araması vardır. Sağlayıcının yayımladığı arama ücreti 1.000 arama için 10 USD'dir: en fazla 0,03 USD arama ücreti, buna ek model tokenları ve sınıflandırma kullanımı. Gerçek arama sayısı ve araç maliyeti `ai_usage` kaydına yazılır; model fiyatı bilinmiyorsa toplam uydurulmaz, bilinen araç maliyeti bütçede yine sayılır. Kaynak: [Claude web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool). Ücret ve erişim sağlayıcının güncel hesabına/model desteğine bağlıdır.

Aynı firma bağlamının başarılı sonucu 24 saat tekrar kullanılır. Komut tekrarları ve eşzamanlı istekler ikinci araştırma/kaynak üretmez. Sağlayıcı çağrısı sırasında firma bilgisi değişirse sonuç kayda uygulanmaz. Süresi dolan/başarısız işler güvenli durumla kapatılır, ham sağlayıcı hatası kullanıcıya gösterilmez. Anahtar, izin veya bütçe eksikse neden görünür; erişilmeyen kaynak ve satın alma niyeti uydurulmaz. Bir araştırma ve sınıflandırma, mevcut günlük bütçe/kullanıcı sınırı kapısından geçer; bunlar sağlayıcı faturasına ilişkin kesin harcama garantisi değildir.

## Veri bağımlılıkları ve sınırlar

- `malzeme sayım listesi (1).pdf` bu uygulama oturumunun dosyalarında ve bağlı Drive'da bulunamadı. Belgenin tamamı incelenmiş veya aktarılmış değildir. Kullanıcının verdiği dört örnek değer tam katalog yerine kullanılmadı.
- Teknik sayım aktarımının ayrı amacı vardır: profil kartı, kg/m ve kaynak bilgisi. Tarihî adet/metre/kg tekrar güncel stoğa eklenmez. Çelişen gramaj mevcut değeri sessizce değiştirmez. Gerçek dosya geldiğinde tamamı, sayfa/kod/renk ve çelişki sonuçlarıyla kontrol edilmelidir.
- Fiziksel stok boyları, doğrulanmış testere/uç düzeltme değerleri ve ürün/mekanizma reçeteleri işletmeden gelmelidir. Testlerdeki reçeteler sentetiktir; gerçek üretim standardı değildir.
- Otomatik kaynaklı araştırmanın kod bağlantısı tamamlandı. Bu ortamda gerçek sağlayıcı anahtarı yoktur; ücretli dış web araması yapılmadı. Gerçek hesapta model/web arama erişimi ayrıca doğrulanmalıdır. Yerel testte sentetik sağlayıcı kullanıldığı açıkça kayıtlıdır.
- Web kaynakları firmanın kendi sitesi, kamuya açık proje/şube sayfaları ve resmî siciller olabilir. Kapalı/ücretli siciller, abonelik gerektiren şirket verileri ve erişimi kısıtlı sayfalar için veri varmış gibi davranılmaz. Yeni hesap açılmadı veya veri servisi satın alınmadı.
- Nadir ürünler ortak listede görünür; ayrı ürün kategorileri açılmaz. Eski genel üretim altyapısı korunur.
- Kamera, etiket yazıcısı ve gerçek telefon üzerindeki donanım kontrolü işletme cihazlarında yapılmalıdır. Tarayıcı doğrulaması fiziksel yazıcı testi yerine geçmez.

## Veriyi koruyan kurulum

1. Mevcut veritabanının yedeği ve geri yükleme doğrulaması alınır. Canlıya uygulama ayrı yayın adımıdır.
2. Yeni migration dosyaları `061`–`072` eklemeli değişiklikler içerir. `060` başka açık çalışmaya ait olduğundan kullanılmadı. Yerel entegrasyon kurucusu yeni tabloları sıfırdan ve mevcut yerel şemada çalıştırdı. `072` araştırma işlerini/kanıt kökenini ve web arama kullanımını ekler; henüz uygulanmamış kurulumda manuel kaynaklar ve eski kullanım kaydı çalışmayı sürdürür, yeni araştırma kapalı görünür.
3. Mevcut siparişler `technical_file_required=false` ile eski davranışlarını korur. Bu çalışma üzerinden yeni açılan teklif dosyaları teknik onay zorunluluğunu alır. Eski hareketler, etiketler, iş emirleri, servis kayıtları ve montaj geçmişi silinmez.
4. Önce şema, sonra uyumlu uygulama sürümü hazırlanır. Gerçek stok veya tarihî sayım topluca yeniden yüklenmez. Pilot sipariş teknik kaynak ve gerçek fiziksel boylarla kabul edilir.
5. Geri dönüşte uygulama sürümü geri alınabilir; yeni tablolara kaydedilmiş olaylar silinmez. Gerçekleşmiş stok/üretim hareketleri gerektiğinde mevcut kontrollü düzeltme yollarından ele alınır.

## Doğrulama kaydı

- TypeScript denetimi ve üretim derlemesi geçti. PDF worker paketleri ve bağımsız Türkçe PDF çıkarımı geçti.
- Jest: 165 test grubu, 1.169 test geçti.
- Entegrasyon: temiz ve geçici yerel veritabanında 47 senaryonun tamamı tek genel çalışmada geçti. Son kaynak-alıntısı değişmezliği ve insan sınıflandırması düzenlemesinden sonra iki ilgili satış/araştırma entegrasyonu ayrıca geçti.
- Lint: sıfır hata; değişiklik dışında kalan üç eski kullanılmayan `eslint-disable` uyarısı mevcut.
- Güncel tarayıcı kontrolü: 390 × 844 görünümde usta yönlendirmesi, atanmış sipariş, ticari API'ye 403, teknik yanıtta fiyat/maliyet alanlarının bulunmaması, yatay taşma olmaması ve ölçülü 3D açılması doğrulandı; JavaScript hatası görülmedi. Açık/koyu ekran görüntüleri yerel inceleme için alındı. Tarayıcıdan kısmi kesimde bir çubuğun tüketilip diğerinin ayrılmış kalması ve hazır miktarın sonraki işleme açılması doğrulandı.
- Mal kabul mobil tarayıcı kontrolü: 4.000 mm sağlam ve 2.000 mm yanlış renkli çubuk tek kontrolde kaydedildi; kontrol aşamasında stok hareketi oluşmadı. Usta nihai kabul düğmesini göremedi. Yetkili onayından sonra 4 m kullanılabilir, 2 m gerçek yanlış rengi korunarak red deposuna girdi; kalan satın alma ihtiyacı açık kaldı.
- Günlük üretim yetkisi kaldırıldığında yeni kayıt reddedilir. Etiket hazırlama, iki kez yazdırma ve tarama stok miktarını değiştirmez. Asıl fatura/PDF ve fatura görselleri usta teknik görünümüne açılmaz.
- Günlük miktar, boya, yükleme ve revizyon tekrar gönderimleri ikinci stok hareketi üretmez. İzin, eski sürüm, eksik delik kuralı, yanlış miktar ve eksik kalite kontrolüne yönelik olumsuz senaryolar test edildi.
- Tamamlanmış üründe stokta koruma/hurda/söküm, ölçülmüş 950 mm geri kazanım ve 50 mm hurda, eski üretim/seri kaydının korunması ve tekrar gönderimin ikinci hareket yaratmaması test edildi. Ortak eski planda ilk çubuğun gerçekleşmiş kesimi korunurken iki başka siparişin ayrılmış ikinci çubuktan kesime devam etmesi doğrulandı. Ortak etki kabulü eksikse bütün stok hareketlerinin geri alınması test edildi.
- Tamamlanmış ürünün mobil tarayıcı kabulü: sentetik 2 adetlik siparişte 1 adet gerçekten üretim servisiyle tamamlandı; teknik revizyon açıldı. Telefona uygun formdan mevcut stokta koruma seçildi, görüntü dosyası gerçek dosya API'sine yüklendi, gerekçeli karar kaydedildi. Eski seri/üretim kaydı korundu, eski işler kapandı ve yeni hesaplama beklendi. 390 × 844 görünümde taşma/JavaScript hatası yoktu; açık/koyu görünüm incelendi. Üretim stoğu testte mevcut `NATIVE_INVENTORY_ENABLED=1` ile, dosyalar yalnız yerel dosya backend'iyle çalıştırıldı; canlı özel Blob ayarları değiştirilmedi.
- AI araştırmasında gerçek arama sonucu/atıf kontrolü, uydurma kaynakların atılması, ham model metninin bulgu yapılmaması, araç maliyeti, bütçe, eşzamanlı istek, aynı komutun tekrarı, 24 saat önbellek, değişen firma bağlamının sonucu geçersiz kılması ve güvenli hata testleri geçti. Tarayıcı → API → veritabanı kontrolünde yerel sentetik sağlayıcı kullanıldı: gerçek alıntı alanının kaydı, insan doğrulaması, önceliğin değişmemesi, önbellekten tekrar aramanın yeni çağrı yapmaması, 390 × 844 görünümde taşma/JavaScript hatası olmaması doğrulandı. Bu, gerçek ücretli web araması kabulü değildir.

## Efor değerlendirmesi

Önceki 90–150 kişi-gün aralığı bir takvim veya teslim tarihi taahhüdü değildir. Var olan reçete, kesim, stok, 3D, yetki, kayıt ve bildirim servislerinin kullanılabildiği; gerçek teknik kaynakların ve pilot verisinin erişilebilir olduğu varsayımına dayanır. Yeni bir hesaplama motoru veya iş emri altyapısı yazılmadı.

Eksik teknik kurallar, fiziksel stok kalitesi, tüm sayım belgesine erişim, üretimdeki sıra dışı revizyonlar, dış veri lisansları ve gerçek cihaz kabulü belirsizliktir. Otomatik testlerin geçmesi bu işletme verilerinin doğrulandığı anlamına gelmez. Her teslimatın kabulü, kendi arayüzü ve sunucu/veri davranışı birlikte çalıştığında yapılmalıdır.
