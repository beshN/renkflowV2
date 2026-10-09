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
