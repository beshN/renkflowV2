# Claude — RenkFlow mobil kaynak kurtarma paketi

## Önce bunu oku: bu paket ne içeriyor?

Bu dal, **Mac'teki son çalışma klasörünün birebir arşivi değildir**. Terminal, tüm denemelerde `Resource temporarily unavailable (os error 35)` hatası verdiği için yerel dosyalar okunamadı, git commit/push veya yerel ZIP üretilemedi. Bu hatanın ekran kilidinden kaynaklandığı doğrulanmadı.

Paket, GitHub'da doğrulanmış `ca9469149de6e8d91f32e1f0d303a74c5fefc74c` commit'indeki tam depo tabanını ve kodlama sohbetinin araç çıktılarından kurtarılan aşağıdaki **7 kaynak dosyayı** içerir. Kurtarılan dosyalarda sohbet sırasında kaydedilmiş düzeltmeler de uygulandı. Dosyalar diskten yeniden okunamadığından bunları byte-byte son yerel dosyalar olarak kabul etme.

- Depo tabanı: `beshN/renkflowV2`, commit `ca9469149de6e8d91f32e1f0d303a74c5fefc74c`.
- Kurtarma dalı: `codex/claude-mobile-recovery-20261030`.
- Yerel, henüz pushlanamamış çalışma dalı: `codex/mobile-experience-20261029`.
- Orijinal son proje, Mac'te kullanıcının `Documents/ChatGPT/RenkFlow-mobile-release` klasöründedir. Daha önceki harici disk yolu `/Volumes/HIKSEMI/RenkFlow V2` erişilemediği için o kopya kullanılmıştı.
- Tabanın mevcut native uygulamaları: `apps/native-ios` ve `apps/native-android`. Bunlar eski native saha sürümüdür; GitHub tabanını son tam mobil iş yönetimi sürümüyle karıştırma.
- Yeni kurtarılan kodlar bilinçli olarak `recovery/native-mobile` altında duruyor. Asıl uygulama kaynaklarına otomatik taşınmadı. Böylece eksik bir kurtarma mevcut uygulama derlemesine sessizce karışmıyor.
- **Bu kurtarma dalı derlenmedi ve test edilmedi.** Aşağıdaki test kayıtları yalnız erişim kesilmeden önceki orijinal yerel çalışma içindir.

## Kullanıcının kesin talebi

RenkFlow'un satış, müşteri, teklif, sipariş, üretim, depo, satın alma, montaj, servis, finans ve yönetim özelliklerini profesyonel, akıcı, site temasıyla uyumlu **tamamen native** mobil uygulamalara taşı.

- iOS: SwiftUI. Android: Kotlin / Jetpack Compose.
- WKWebView veya Android WebView ile siteyi uygulamanın içine koyma yaklaşımı kullanıcı tarafından açıkça reddedildi.
- `serve-sim` yalnız iOS simülatör görüntüsünü tarayıcıdan izlemek/kontrol etmek içindir; ürünün web ekranı değildir.
- Mevcut iş kuralları, sunucu yetkileri, müşteri/finans veri kısıtları korunmalı; native tasarım JSON API'lerini kullanmalı.
- Çalışma bitmediyse tüm sistemin tamamlandığını iddia etme. Katalog kaydı, native ekranın ve bütün iş akışının tamamlandığı anlamına gelmez.

## Kurtarılan kaynaklar

- `recovery/native-mobile/ios/Core/NativePurchasingStore.swift`
- `recovery/native-mobile/ios/Core/WorkspaceAPI.swift`
- `recovery/native-mobile/ios/Core/WorkspaceStore.swift`
- `recovery/native-mobile/android/data/NativeWorkspaceApi.kt`
- `recovery/native-mobile/android/ui/NativePurchasingModels.kt`
- `recovery/native-mobile/android/ui/NativeBusinessModels.kt`
- `recovery/native-mobile/ios/Core/NativeBusinessModels.swift`

Dosya eşlemesi:
- `recovery/native-mobile/ios/Core/*` orijinal çalışma kopyasında `apps/native-ios/RenkflowField/Core/*` altındaydı.
- Android `data/*`: `apps/native-android/app/src/main/java/com/renkflow/field/data/*`.
- Android `ui/*`: `apps/native-android/app/src/main/java/com/renkflow/field/ui/*`.

Destek tipleri ve bazı ekranlar eksiktir. Örneğin yeni `WorkspaceOrigin`, `JSONValue.entity/text/decimal`, `NativeUI` bileşenleri, Android `WorkspaceViewModel` ve yeni native uygulama kabuğunun tam yerel kaynakları bu kurtarmada bulunmuyor. Bu dosyaları körlemesine uygulama klasörüne kopyalayıp derlenebilir olduğunu söyleme.

## Orijinal yerel çalışmanın son durumu

Aşağıdakiler yerel çalışma sırasında yazıldı; tamamı bu pakette kurtarılamadı:

- Native giriş, ikinci adım/MFA formu, oturum geri yükleme/çıkış, uygulamaya dönüşte kimlik/yetki yenileme.
- Dashboard: gerçek sipariş/üretim/kritik stok verileri, Swift Charts ile son 14 gün, yaklaşan teslimatlar.
- Müşteri: arama, sayfalama, detay, oluşturma/düzenleme, fatura adresleri, il/ilçe, vergi alanları, ödeme vadesi/kredi limiti.
- Sipariş: arama/durum filtreleri, detay, çok kalemli oluşturma, ana alanları düzenleme, durum değişikliği, tahsilatlar.
- Teklif: oluşturma, liste/detay, durum, expectedVersion ile güncelleme ve siparişe dönüştürme.
- Finans: TRY fatura alacakları/yaşlandırma, tahsilat listesi/girişi, cari ekstre.
- Fatura: liste/detay, siparişin kalan kalemlerinden taslak, kesme, iptal, taslak silme, başarısız e-Belge gönderimini yeniden deneme.
- Stok: bakiye/arama/kritik stok filtresi, detay/hareketler, gerekçeli giriş/düzeltme ve kayıttan sonra taze bakiye okuma.
- Satın alma: tedarikçi liste/detay/oluşturma/düzenleme; satın alma siparişi liste/detay/çok kalemli oluşturma/onay/iptal; mal kabul listesi/detayı, kabul/red, red deposu/gerekçe ve ters kayıt.
- Eski native saha/çevrimdışı kuyruk korunuyordu. **İş yönetimi oturumu ile saha cihaz oturumu henüz birleştirilmedi.**

Orijinal yeni iOS dosya adları:
```
Core/WorkspaceAPI.swift
Core/WorkspaceStore.swift
Core/WorkspaceModule.swift
Core/WorkspaceNavigation.swift
Core/NativeBusinessModels.swift
Core/NativePurchasingStore.swift
Design/NativeUI.swift
Features/NativeSignInView.swift
Features/WorkspaceHubView.swift
Features/NativeDashboardView.swift
Features/NativeCustomersView.swift
Features/NativeOrdersView.swift
Features/NativeCommerceEditor.swift
Features/NativeQuotationsView.swift
Features/NativeFinanceView.swift
Features/NativeFinanceDocuments.swift
Features/NativeInvoiceDetail.swift
Features/NativeInventoryView.swift
Features/NativeInventoryDetail.swift
Features/NativeSuppliersView.swift
Features/NativePurchasesView.swift
Features/NativeReceiptsView.swift
```

Orijinal yeni Android dosya adları:
```
WorkspaceViewModel.kt
data/NativeWorkspaceApi.kt
data/WorkspaceModule.kt
ui/WorkspaceHub.kt
ui/NativeSignIn.kt
ui/NativeBusinessModels.kt
ui/NativeBusinessUI.kt
ui/NativeOverview.kt
ui/NativeCustomers.kt
ui/NativeOrders.kt
ui/NativeCommerce.kt
ui/NativeQuotations.kt
ui/NativeFinance.kt
ui/NativeInvoiceDetail.kt
ui/NativeInventoryDetail.kt
ui/NativePurchasingModels.kt
ui/NativeSuppliers.kt
ui/NativePurchases.kt
ui/NativeReceipts.kt
```

Diğer yerel değişiklikler: native tema/fontlar, proje üreticisi, CI, native/HTTP/UI testleri, yerel fixture, modül kataloğu, canlı rebuild watcher, belgeler. Bu değişikliklerin eksiksiz git diff'i okunamadı. Özellikle katalog/generator, font dosyaları ve son ekran kaynaklarını disk erişimi döndüğünde kurtar.

## Kimlik doğrulama tasarımı

Yeni native iş ekranları mevcut Auth.js oturum çerezleriyle HTTPS JSON protokolünü kullanıyordu:

1. `GET /api/auth/csrf`, çerezleri koru.
2. Form-urlencoded `POST /api/auth/callback/credentials`: email, password, csrfToken, callbackUrl, json=true; gerekirse otp.
3. `X-Auth-Return-Redirect: 1` başlığı gerekli. Dönen JSON url içindeki error/code okunur; adrese gidilmez.
4. `otp_required` native kod girişini açar; `otp_invalid` hatası gösterilir.
5. `GET /api/auth/session` ile kimlik, `GET /api/v1/me/access` ile izin matrisi alınır.
6. İş isteklerine aynı kökenli Origin/Referer ve güvenli oturum Cookie eklenir. Yönlendirmeler izlenmez.
7. Çıkış: CSRF korumalı `/api/auth/signout` ve cihazdaki güvenli çerezleri temizleme.

Şifre saklanmaz. iOS Keychain ve Android Keystore kullanılır; saha outbox'ı ayrıdır.

Kaydedilmiş önemli düzeltmeler:
- iOS JSONEncoder `.sortedKeys` kullanmalı. Sunucunun komut özeti JSON alan sırasından etkileniyor; aynı komutun tekrar gönderimi farklı sırayla 409 hatası veriyordu.
- Auth.js oturumsuz durumda `/api/auth/session` yanıtı HTTP 200 + JSON null olabilir. Bunu bozuk JSON/502 olarak değerlendirme; identity katmanı 401 üretmeli.
- Test amaçlı `persistence=false` istemci gerçek uygulamanın Keychain kaydını silmemeli.
- JSON sayılarından string üretirken locale bağımsız NSNumber.stringValue kullanıldı.
- Android BigDecimal yüzde işlemlerinde `/` ölçeği kesebiliyordu. `.divide(BigDecimal(100), MathContext.DECIMAL128)` kullanıldı.
- Çerezler tam HTTPS şirket alan adı, path sınırı ve sona erme tarihine göre seçilir.
- Geciken yanıtların başka kullanıcı/şirket oturumuna yazılmasını epoch/generation kontrolleri engeller.

### Saha oturumu — henüz çözülmemiş iş

Mevcut `/api/mobile/v1/auth/login` cihaz/bearer oturumu ayrıdır. Bu yol MFA hesaplarını reddeder. `apiTokenStillValid` de MFA açık kullanıcıların bearer token'larını reddeder.

Saha oturumunu birleştirmek için doğrulanmış Auth.js/MFA oturumundan güvenli cihaz oturumu üretmek gerekir. Henüz exchange endpoint'i, ilgili migration veya MFA bearer istisnası uygulanmadı. Sentetik token üretip yetki denetimini atlama. Eski parola-only mobile login'deki MFA reddini testli bir çözüm olmadan kaldırma.

## JSON API sözleşmeleri

Sunucu kodunu `apps/web` içinde esas al. Bazı yollar Auth.js cookie aktörü, bazıları bearer bekler; hepsini aynı sanma.

- Müşteri: GET/POST `/api/v1/customers`; GET/PUT `/api/v1/customers/{id}`. DTO snake_case, yazma camelCase. Liste search/page/pageSize. Boş kredi limiti temizlemek için creditLimit:null gönderilir.
- Sipariş: GET/POST `/api/v1/orders`; GET/PATCH `/orders/{id}`; PATCH `/orders/{id}/status` {status,note?}. Yanıtlar genelde success/data zarfı.
- Sipariş oluşturma: customerId?, customerName, productName, quantity, totalAmount, currency, items. items: productName, quantity, unitPrice, totalPrice, renk/ölçü/not. Bu uçta henüz komut idempotency desteği yok; belirsiz ağ hatasında kör POST tekrarı yapma.
- Teklif: GET/POST `/api/v1/quotations`; GET/PATCH `/quotations/{id}`. Oluşturmada idempotencyKey; değişiklik/dönüştürmede expectedVersion. Dönüştürme {action:"convert",expectedVersion}.
- Dashboard: `/api/v1/dashboard/summary`, summary.orders/production/criticalStock/trend.
- Stok: `/api/v1/inventory/balances?search=&lowStockOnly=`; `/movements?itemId=`; POST `/stock-entries` {entryType,idempotencyKey,note,lines:[{itemId,warehouseId,quantityDelta,uom}]}.
- Doğrudan stok girişi/düzeltmesi owner/admin içindir; profil veya üretim bağlantılı hareketler ilgili operasyon ekranından yapılmalıdır. Gerekçe gerekir.
- Finans: `/api/v1/finance/workspace` yanıt data.payments/orders/...; `/finance/receivables` TRY fatura alacaklarıdır, farklı para birimlerini bir toplamda karıştırma.
- Cari ekstre: `/api/v1/finance/statement?customer=<key>&from=YYYY-MM-DD&to=...`. Yanıt lines; satır alanları on,ref,text,debit,credit,balance.
- Tahsilat: POST `/api/v1/production` {commandId,action:"finance.payment.create",data:{orderId,amount,currency,method,paidAt,note}}. Aynı komut aynı payload ile yeniden gönderildiğinde tek kayıt oluşur.
- Fatura: GET/POST `/api/v1/invoices`; GET/POST/DELETE `/invoices/{id}`. Taslak {orderId,lines:[{orderItemId,quantity}],vatPercent,notes}. İşlemler {action:"issue",issuedOn?,dueOn?}, {action:"cancel",reason}, {action:"retry"}.
- Sipariş faturalama: `/api/v1/finance/orders/{id}`, lines[].remaining, invoices, payments, summary.
- Satın alma workspace: `/api/v1/procurement/workspace`, data.suppliers/orders/receipts/items/warehouses.
- Satın alma komutları aynı `/api/v1/production` komut zarfını kullanır:
  - procurement.supplier.save: id/version düzenlemede; name,contactName,phone,email,paymentTerms,notes,isActive.
  - procurement.purchase.create: supplierId,currency,expectedAt?,notes,lines[{itemId,warehouseId,quantity,unitPrice,lengthMm?,color}].
  - procurement.purchase.transition: id,version,status submitted|cancelled.
  - procurement.receipt.create: purchaseOrderId,version,notes,lines[{lineId,acceptedQty,rejectedQty,rejectedWarehouseId?,rejectionReason?,color?,rejectedColor?,bars?}].
  - procurement.receipt.reverse: id,version,reason.
- Satın alma profil miktarı **çubuk adedidir**, lengthMm ile metreye dönüşür; fiyat metre başınadır. Sipariş DTO ordered_qty ve receipt acceptedQty/rejectedQty **metredir**. Red malzemeler siparişi yerine getirilmiş sayılmaz.
- Native satın alma formu tek receipt satırında tek fiziksel boy dağılımı sunuyordu; bir satırda çoklu farklı çubuk boyu arayüzü eksik.

## Tema

Kaynak: `apps/web/styles/theme.css`.
- Antrasit #2a3134, açık gri #f2f3f2, bronz #7e5a38.
- İnce kenarlıklar, küçük 6–8 px köşeler, sade beyaz yüzeyler.
- Archivo ve IBM Plex Sans; font dosyaları/lisansları son yerel çalışmada paketlendi, bu kurtarmada taşınmadı.
- Native alt gezinme ve platform tarih/dosya/kamera/erişilebilirlik bileşenleri.
- Dashboard tarihlerindeki kesilme Date ekseni ve her 3 gün bir etiket ile düzeltildi; string kategorilerde 14 etiket sıkıştırılmamalı.

## Son yerel doğrulamalar — bu kurtarma dalına ait değildir

Erişim kesilmeden önceki yerel çalışma:
- iOS simulator build başarılıydı.
- NativeWorkspaceContractTests: cookie sınırı, ondalık/iskonto, gerçek oturum/müşteri/sipariş/tahsilat/fatura/stok turu, fiziksel profil boyları, tedarikçi/satın alma/kabul-red/ters kayıt: toplam beş test başarılı.
- Authenticated iOS UI testi müşteri, finans, satın alma listesi ve yeni satın alma formunu açtı; WebView sayısı sıfır kontrol edildi.
- Android debug APK ve instrumentation test kaynak derlemesi başarılıydı.
- Son seçilmiş Android testleri: WorkspaceTest 2 + NativeWorkspaceContractTest 2 + NativePurchasingTest 2, hata yok. Gerçek HTTPS satın alma/kısmi kabul/red/ters kayıt buna dahil.
- Daha önce 17 JVM testinin tamamı da geçti, ancak son satın alma eklendikten sonraki test çağrısı yalnız yukarıdaki altı testi seçiyordu.
- Fiziksel cihaz, Android yeni satın alma UI etkileşimleri ve bütün modül kabulü tamamlanmış sayılmamalı.

Yerel canlı preview `serve-sim` ve Swift rebuild watcher ile çalışıyordu; şu an erişimi/doğruluğu yeniden doğrulanamadı. Bu public depoya test hesap parolaları, oturum çerezleri, .env veya imzalama anahtarları eklenmedi.

## Eksik işlerin dürüst listesi

Bu paket en son native uygulamanın tamamını kurtarmıyor. Önce dosyaların gerçekten mevcut olduğu, hangi sürüm oldukları ve derlenebilirlik doğrulanmalı.

Fonksiyonel eksikler: saha ile tek oturum; MFA uçtan uca saha kabulü; müşteri kişiler/aktiviteler/fiyat kuralları; teklif düzenleme/yapılandırıcı/PDF/paylaşım; sipariş teknik/malzeme/üretim/zincir/belgeleri; fatura XML/export; stok sayım/eşik/artıklar; malzeme talepleri/tedarik belgesi eşleştirme; takvim/ekip/araç/servis/rapor/bilgi/denetim/ayarlar/AI kapsamının tamamı. Eski native saha işlevlerini ve kalıcı outbox'ı bozma.

## Claude için önerilen ilk adımlar

1. Bu dosyanın kapsam uyarısını oku; kurtarma paketini son eksiksiz proje diye adlandırma.
2. Tam depo tabanındaki apps/native-ios, apps/native-android, contracts/mobile ve ilgili apps/web servislerini incele.
3. recovery/native-mobile içindeki kaynakları bağımlılıklarıyla eşleştir. Eksik destek tiplerini ve ekran kaynaklarını listeden tespit et.
4. Mac'e daha sonra erişim gelirse önce orijinal uncommitted çalışma kopyasını güvenli biçimde arşivle ve git diff al; kurtarma kopyalarıyla orijinalin üstüne yazma.
5. Mac erişimi yoksa bu kopyaları referans alarak açıkça yeni bir uygulama dalında native geçişi sürdür; yeni/yeniden oluşturulan kodları orijinalden kurtarılmış gibi sunma.
6. Yerel test verisiyle gerçek HTTPS sözleşme testleri ve native UI kabulü yap. Native envanter fixture sunucusunda NATIVE_INVENTORY_ENABLED=1 gerekir. Üretim ortamı ayarlarını bu kurtarma için değiştirme.
