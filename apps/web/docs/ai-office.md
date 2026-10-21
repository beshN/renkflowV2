# AI ofis: yürütme ve teslim kontrolü

Görevler firma bazında `office_tasks` ve `office_files` tablolarında saklanır (077 migration). Dosyalar özel Blob deposundadır; indirme firma/rol denetiminden geçer.

Çalışan teslim ettikten sonra yönetici gerçek dosya içeriklerini görevle karşılaştırır. Word, Excel ve PowerPoint XML içeriği, PDF metni, düz metin ve desteklenen görseller incelenir. Büyük veya okunamayan içerik, kontrol edilebilmiş gibi onaylanmaz. Puan, gerekçe ve sorunlar teslim kartında gösterilir. Kontrol sonucunun ve en fazla son 10 incelemenin kaydı `decision` alanındadır.

Yönetici yalnız düzeltilmeden teslim edilemeyecek sorunları (yanlış hesap, eksik kalem, uydurma bilgi, bozuk biçim) `issues` olarak yazar; üslup ve küçük biçim önerileri `suggestions` olarak teslim kartında görünür ve işi geri göndermez. Geçme puanı 7'dir. Hata bulunan teslim bir kez otomatik düzeltmeye gider. Aynı çalıştırmadaki bütün model çağrıları ortak 260 saniye sınırını paylaşır. Sorun sürerse, kontrol servisi kullanılamazsa veya dosya tam incelenemezse son karar kullanıcıya bırakılır. Yönetici onayı, kullanıcının son onayının yerine geçmez. Altı dakika boyunca çalıştırılamayan işler yeniden denenebilir; eski çalıştırıcı yeni denemenin sonucunu değiştiremez. Yeniden deneme revizyon sayılmaz: başarısız denemenin bıraktığı dosyalar silinir ve iş aynı revizyonda tekrar yapılır; dosya kaydı yalnız görevi o an tutan çalıştırmaya açıktır.

## Firma bilgisi ve kayıtlar

Çalışan, firmanın kendi bilgilerini (unvan, vergi dairesi ve numarası, adres, telefon, fatura e-postası) antet ve imza için talimatında görür. Siparişler, müşteriler, teklifler, malzeme ve stok, tedarikçiler, satın almalar, sevkiyatlar, üretim işleri, reçeteler, depolar ve personel `firma_verisi` aracıyla aranır. Arama, asistanın aramalarıyla aynıdır ve görevi veren kişinin o anki rolü, özel rolü ve gizli alanlarıyla yapılır; üyeliği kalkan kişinin görevi kayıt okuyamaz. Hiçbir kayıt yazılmaz. Bir çalıştırmada en çok 4 arama turu, turda 5 arama yapılır. Talimat, kayıtlarda bulunabilecek bilgiyi kişiye sormamasını söyler.

KVKK: firmanın bilinen müşteri, tedarikçi ve üye adları, e-posta, telefon, IBAN ve TC numaraları görevde, firma bilgisinde ve her arama sonucunda yer tutucuyla (`[KİŞİ_1]`) modele gider. Teslimde gerçek değerler cevaba ve Word, Excel, PowerPoint ile metin dosyalarına geri konur; yönetici kontrolü yer tutuculu kopyayı inceler. Görsel ve PDF yeniden yazılamadığı için talimat yer tutuculu bilgiyi bunlara yazdırmaz.

## Sahne

Ofis sayfadan ayrılınca durmaz: menü değişip geri gelindiğinde aynı ofis, uzakta geçen süre kadar (en çok 30 dakika) ilerlemiş olarak açılır; hız, gece/gündüz ve sekme seçimi de korunur. Sayfa yeniden yüklendiğinde sunucuda çalışmakta olan görevin çalışanı yeniden görev verilmeden masasında görünür. Masa ekranları işin türünü (tablo, belge, slayt, tasarım, e-posta; yöneticide görev panosu) ve ilerlemesini gösterir.

## Model seçimi

Varsayılan `OFFICE_PROVIDER=anthropic`: mevcut Claude Sonnet 5.5 yolu korunur; Word, Excel, PowerPoint ve araştırma araçları bu yoldadır.

OpenCode API hazır olduğunda yalnız sunucu ortamına `OPENCODE_API_KEY` eklenir ve `OFFICE_PROVIDER=opencode` ile yeni preview deploy oluşturulur. Uygulamanın diğer AI özellikleri bu ayardan etkilenmez. Firma KVKK onayı, asistan modu, bütçe ve kişi çağrı sınırı her model çağrısında geçerlidir.

| Rol | OpenCode model kimliği |
| --- | --- |
| Yönetici / görev dağıtımı | `minimax-m3.1-flash-free` |
| Tablolar / veri / finans | `deepseek-v4.1-flash-free` |
| Belgeler / çeviri / sunum / rapor | `mimo-v2.6-flash-free` |
| Yazışma / tasarım / bağımsız belge kontrolü | `glm-5.3-flash-free` |

Kimlikler 21 Ekim 2026 tarihinde `https://opencode.ai/zen/v1/models` kataloğundan doğrulandı. Ücretli modele otomatik geçiş yoktur. Ücretsiz modellerin kapasite ve kullanım şartları sağlayıcıya bağlıdır.

OpenCode bağlantısının ilk sürümü aracıyla gerçek TXT, Markdown, CSV ve statik SVG dosyaları teslim eder; ikili Word/Excel/PowerPoint üretimi veya web araması yaptığını iddia etmez. Bu sınırlama model talimatında ve teslim notunda belirtilir. SVG aktif içerik ve CSV formülleri kabul edilmez. OpenCode görsel incelemesi desteklenmediğinde kullanıcı kontrolü istenir.

API anahtarı henüz hazır olmadığından OpenCode canlı çağrısı doğrulanmamıştır; etkinleştirmeden önce preview üzerinde dört model için teslim, eksik bilgi, yanlış toplam, düzeltme, kota/zaman aşımı ve özel dosya indirme akışları denenmelidir. Anahtarlar loga, repoya veya tarayıcıya yazılmaz.

## Yayın

077 migration mevcut veriyi değiştirmez; yeni görev ve dosya tablolarını ekler. Veritabanı yedeği alınarak migration ve ledger kaydı tamamlanmalı; ardından production readiness ve anonim API erişim reddi kontrol edilmelidir.
