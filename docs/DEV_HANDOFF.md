# RenkFlow — Mac üzerinde devam notu

Son çalışma: 2 Ekim 2026. Hedef tek şirket, **Renk Alüminyum**; web uygulaması öncelikli. ERPNext runtime bağımlılığı yok; mevcut native stok/üretim altyapısı korunuyor. Kullanıcı isteğiyle geliştirme burada durduruldu.

## Tamamlanan değişiklikler

- Sidebar geçişi 150 ms; hover sayfa içeriğini kaydırmıyor. Sabitleme tercihi tarayıcıda saklanıyor. Çıkış düğmesi gerçek oturum kapatmayı kullanıyor.
- Daha sade kartlar, üst menü, sayfa geçişleri ve mobil alt menü. Mobil AI düğmesi alt menüyü kapatmıyor; sohbet penceresi ekran genişliğine sığıyor.
- Mobilya şablonları yerine alüminyum iş akışı; sipariş formunda mm ölçüleri, RAL/yüzey, profil/seri notları ve çoklu kalemler. Fiyatı henüz belli olmayan siparişler sıfır tutarla kaydedilebiliyor; negatif miktar/fiyat/ölçüler kabul edilmiyor.
- Gerçek sipariş araması, yerel liste araması/sayfalama, görünür yenileme düğmesi. İş emirleri listesi/detayı, firma ayarları, ekip ve bildirim sayfaları mevcut API'lerle bağlandı.
- Raporlarda uydurma fire/kapasite değerleri kaldırıldı; gerçek sipariş özeti ve CSV ihracı eklendi. Hurda/profil artıkları gerçek depo bakiyelerini bekliyor.
- Stokta metre/kg/adet birlikte toplanmıyor. Yükleme hatası sıfır stok veya “stok normal” olarak sunulmuyor. Stok sorgusu başarısız olsa da sipariş dashboard özeti alınabiliyor; eski açık siparişler 90 günlük filtreyle gizlenmiyor.
- PostgreSQL tagged-query istemcisi düzeltildi: iç içe SQL parçaları Promise'e dönüşmeden korunuyor.
- Yerel geliştirmede JS/CSS için bir yıllık immutable önbellek kaldırıldı. Eksik `critters` nedeniyle hata ekranını da bozan deneysel CSS optimizasyonu kapatıldı.

## Doğrulama

- Typecheck ve ESLint başarılı.
- Jest: **22 suite / 190 test başarılı**.
- Son production build başarılı (Next.js 16.1.6).
- Demo girişi; dashboard, sipariş listesi, arama, iş emirleri listesi, ayarlar, ekip, bildirimler, raporlar ve stok hata görünümü tarayıcıda kontrol edildi.
- 1440 px masaüstü / 390 px mobil yeni sipariş ekranları kontrol edildi; yatay taşma yok. Menü sabitleme kalıcı, üst menü araması `/search?q=...` sayfasına ulaşıyor.
- Bu oturumda test amacıyla yeni sipariş veya stok hareketi oluşturulmadı. Stok/üretim uçtan uca pilotu tamamlandı olarak kabul edilmemeli.

## Mac'te açılış

GitHub'dan `main` dalını alın (mevcut checkout varsa önce yerel değişikliklerini koruyun):

```sh
git clone https://github.com/beshN/renkflowV2.git
cd renkflowV2/apps/web
npm ci --workspaces=false
```

Node.js'in desteklenen güncel LTS sürümünü kullanın (bu bilgisayarda Node 24 ile doğrulandı). `apps/web/.env.example` sözleşmesine göre `apps/web/.env.local` dosyasını güvenli biçimde yapılandırın. Windows'taki `.env.local`, kimlik bilgileri ve veri yedekleri GitHub'a gönderilmedi. Veritabanı ve storage kimlik bilgilerini mevcut platformun güvenli ortam değişkenlerinden temin edin; Git'e eklemeyin.

Yerel URL'leri ayarlayın ve landing yerine paneli açın:

```sh
AUTH_URL=http://localhost:3000 NEXTAUTH_URL=http://localhost:3000 PUBLIC_SITE_MODE=off npm run dev -- --hostname 127.0.0.1 --port 3000
```

Panel: `http://localhost:3000/new-order`. Aynı veritabanı kullanılırsa mevcut demo hesabı orada kalır. Tarayıcı eski görünümü gösterirse sert yenileme yapın.

## Kalan işler ve güvenlik sınırları

1. Bağlı veritabanında `stock_balances` tablosu yok. Yeni native stok şeması güvenli yedek ve migration incelemesi yapılmadan uygulanmadı. Önce ayrı geliştirme/test veritabanında migration ve 40×40 profil pilotunu doğrulayın; canlı veritabanında doğrudan seed/migration çalıştırmayın.
2. PDF/AI servisinin beklediği `ZAI_API_KEY` yerel ortamda yok. Gerçek belge çıkarımı doğrulanmadı; insan onayı zorunlu kalmalı.
3. İş emri ekranları mevcut görev/checklist API'sini kullanıyor. BOM bağlantısı, rezervasyon, WIP transferi ve gerçek üretim tüketimi ekranlarının uçtan uca bağlantısı ayrıca tamamlanmalı. Kesim optimizer sonraki ayrı modül; tamamlandı diye sunulmamalı.
4. Bu frontend çalışması tüm modüllerin üretime hazır olduğu anlamına gelmiyor. Satın alma/mal kabul ve stok hareketleri kurulmuş şema üzerinde ayrıca test edilmeli. Multi-tenant, mobil uygulama ve muhasebe kapsamı büyütülmemeli.
5. Yerel `.env.local` canlı veritabanına bağlıydı. Yalnız eski demo şirketi ve RF-001/002/003 mobilya örnekleri, kesin eşleşme koşullarıyla alüminyum örneklerine çevrildi; diğer kayıtlar korunuyor. Değişim öncesi JSON yedeği Windows çalışma alanının `outputs/renkflow-demo-before-*.json` dosyasında kaldı. Bu yedek ve ekran görüntüleri hassas veri ihtimalinden dolayı repoya eklenmedi.

Yeni değişikliklerden sonra web klasöründe `npm run type-check`, `npm run lint`, `npm test -- --runInBand` ve `npm run build` çalıştırın. Build ile dev sunucusunu aynı `.next` üzerinde aynı anda çalıştırmayın.
