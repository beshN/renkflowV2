# Order + PDF Sistem Analizi (2026-02-08)

## Kapsam
Bu analiz iki ekseni hedefler:
- Sipariş sistemi: doğruluk, çok kiracılı güvenilirlik, operasyonel akış kalitesi.
- PDF sistemi: görüntüleme performansı, arama doğruluğu, kullanıcı deneyimi.

Ayrıca Trello ve bu alandaki güçlü ürünlerle karşılaştırma yapılıp kapanması gereken boşluklar çıkarılmıştır.

## Kod Tabanında Bulunan Kritik Boşluklar

### 1) Sipariş katmanı
- Tenant bağımsız cache anahtarı riski vardı; farklı tenant oturumlarında yanlış sipariş listesi cache’e düşebilirdi.
- Server action tarafında doğrulama dağınıktı; `create/update/status/upload` akışlarında standart doğrulama hattı yoktu.
- Mutasyonlardan sonra enterprise cache invalidation eksikti; stale veri riski yüksekti.
- Durum geçişlerinde iş kuralı yoktu; akış disiplini bozulabiliyordu.

### 2) PDF katmanı
- Arama her sorguda tüm sayfaları yeniden işleyerek çalışıyordu; büyük dosyalarda yavaşlama ve race-condition riski vardı.
- Arama sonucu sayaç/navigasyon mantığı toplam eşleşme yerine sayfa bazında çalıştığı için kullanıcıya yanlış indeks gösterebiliyordu.
- Zoom davranışı “fit” ile kilitleniyordu; kullanıcı beklediği gerçek yakınlaştırmayı yapamıyordu.

## Uygulanan İyileştirmeler

### Sipariş sistemi
- Tek doğrulama hattı eklendi (`create/update/status/files`).
  - Dosya doğrulama, custom field normalizasyonu, zod hata mesajlarının tek formatta dönmesi.
- Mutasyon sonrası cache invalidation standartlaştırıldı.
- `getOrderByIdAction` cache’e alındı ve mutasyonlarda detay/list/stat cache temizleniyor.
- Durum geçiş kuralları eklendi (`pending -> in_production -> delivered` akışı kontrollü).
- Tenant bazlı cache key kullanımı eklendi (`orders:<tenantId>`).
- Oturum tenant’i yoksa store sıfırlanıyor; kiracılar arası veri sızıntısı engellendi.

### PDF sistemi
- Aramada sayfa metni cache’i eklendi (aynı dokümanda tekrar parse maliyeti azaldı).
- Race-condition önlemek için arama job-id iptal modeli eklendi.
- Sonuç navigasyonu toplam match üzerinden doğru indeksle çalışacak şekilde düzeltildi.
- Zoom, `fitScale * userScale` olarak yeniden ele alındı; mobilde fit korunurken gerçek zoom-in desteklendi.

### Ek Faz (devam çalışması)
- Siparişler için `orderHealth` risk motoru eklendi (skor, risk seviyesi, önerilen aksiyon).
- Enterprise `DataGrid` içine `SLA Risk` kolonu eklendi ve satır riski görsel olarak işaretleniyor.
- Analitik ekranına canlı risk metrikleri eklendi (at-risk, kritik, ortalama risk, yaklaşan teslimatlar).
- `GET /api/analytics/orders` yanıtına `healthSummary` ve `topRiskOrders` eklendi.

## Değişen Dosyalar
- `apps/web/app/actions/order.actions.ts`
- `apps/web/lib/features/orders/hooks/useOrders.ts`
- `apps/web/lib/features/orders/hooks/useOrders.new.ts`
- `apps/web/lib/features/order./postgres/order.postgres.ts`
- `apps/web/components/features/pdf-viewer/components/PDFSearch.tsx`
- `apps/web/components/features/pdf-viewer/components/PDFRenderer.tsx`

## Rekabet Kıyaslaması (Trello + En İyi Ürünler)

### Sipariş/iş akışı yönetimi
- Trello güçlü kart/board modeli ve Butler otomasyonu sunuyor; ancak karmaşık kurumsal süreçlerde yapılandırılmış akış yönetişimi için Jira/Asana/monday/ClickUp genelde daha derin katmanlar veriyor.
- Jira, iş akışı + otomasyon + proje düzeyi izleme tarafında daha derin enterprise kontrol sunuyor.
- Asana ve monday, portföy/çoklu ekip hedef hizalama tarafında daha olgun yönetim panelleri sağlıyor.
- ClickUp, doküman + görev + beyaz tahta birleşiminde güçlü bir “tek çalışma yüzeyi” modeli veriyor.

### PDF ve doküman deneyimi
- Adobe Acrobat ve Foxit, AI destekli PDF okuma/özetleme/yardımcı işlevleri agresif biçimde ürünleştirmiş durumda.
- DocuSign, e-imza ve agreement lifecycle tarafında pazar standardı konumunda.

## RenkFlow vs Pazar: Gap Özeti

### Kapatılan gap’ler (bu çalışma ile)
- Tenant-safe cache ve stale veri sorunları azaltıldı.
- Sipariş validasyon ve state transition disiplinine çekildi.
- PDF arama/zoom kullanılabilirliği ciddi ölçüde iyileştirildi.

### Kalan büyük gap’ler (Trello’dan net üstünlük için)
1. Akış otomasyonu tasarımcısı (if/then + SLA + event tetikleyici + retry/policy).
2. Sipariş yaşam döngüsü analitiği (cycle time, throughput, aging WIP, bottleneck heatmap).
3. PDF tarafında OCR + semantik arama + özet + aksiyon çıkarımı.
4. E-imza ve sözleşme akışı entegrasyonu (DocuSign benzeri akış).
5. Cross-workspace program/portfolio görünümü ve hedef-SLA bağlama.

## Trello’dan Daha İyi Olma İçin 90 Günlük Plan

### Faz 1 (0-30 gün)
- Sipariş otomasyon kural motoru (durum değişimi, gecikme, atama, bildirim).
- SLA ihlali erken uyarı paneli (order aging + risk score).
- PDF arama için “sonuçtan metin pasajı + sayfa içi highlight” desteği.

### Faz 2 (31-60 gün)
- Program seviyesinde çok pano/çok ekip görünümü.
- Sipariş analitik dashboard: lead time, throughput, rework ratio.
- PDF: OCR pipeline ve indeksli arama.

### Faz 3 (61-90 gün)
- AI copilot: sipariş sapma analizi + önerilen aksiyonlar.
- E-imza entegrasyonu ve sözleşme onay hattı.
- Kurumsal denetim izi (kural çalışmaları, kim-ne-zaman değişikliği).

## KPI Önerisi (başarı ölçümü)
- Ortalama sipariş çevrim süresi: -%20
- Gecikmiş sipariş oranı: -%30
- PDF’de bilgiye erişim süresi: -%40
- Manuel durum güncelleme adımı: -%35
- Otomasyonla çözülmüş olay oranı: +%50

## Kaynaklar
- Trello Automation: https://trello.com/en/features/automation
- Trello Views: https://trello.com/en/views
- Jira Automation: https://www.atlassian.com/software/jira/features/automation
- monday.com Automations: https://monday.com/features/automations
- ClickUp Features: https://clickup.com/features
- Asana Portfolios: https://asana.com/features/portfolios
- Adobe Acrobat AI Assistant: https://www.adobe.com/acrobat/generative-ai-pdf.html
- DocuSign eSignature: https://www.docusign.com/products/electronic-signature
- Foxit AI Assistant: https://www.foxit.com/ai-assistant/
