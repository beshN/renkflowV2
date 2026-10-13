# e-Belge (e-Fatura / e-Arşiv) tasarımı

Tarih: 14 Ekim 2026 · Durum: uygulanıyor (Faz 2, `docs/ROADMAP.md`)

## Amaç

Renk Alüminyum'un RenkFlow'da kestiği faturalar, bir GİB özel entegratörü üzerinden resmi e-Fatura veya e-Arşiv olarak gönderilebilsin. Entegratör henüz seçilmedi. Bu yüzden önce sağlayıcıdan bağımsız bir çekirdek kuruluyor; entegratör seçilince yalnızca bir adaptör yazılacak.

## Bugün olan (047 migration'ı, `lib/features/finance/invoices.server.ts`)

- Siparişten taslak fatura (kısmi faturalama dahil), satır bazında KDV oranı, kesme, iptal ve tahsilat.
- Dönem kilidi (`writablePeriod`) ve denetim kaydı.
- Numara biçimi `FTR-<n>`, firma bazında benzersiz.
- `e_invoice_status` alanı yalnızca `not_connected` değerini alabiliyor.
- Faturadaki satıcı bilgisi yalnızca firma adı.

## Kapsam

1. **Satıcının yasal kimliği.** Firma kartına şu alanlar eklenir: unvan, VKN/TCKN, vergi dairesi, adres (il, ilçe, açık adres), MERSİS, ticaret sicil no, telefon, e-posta, IBAN. Eksik zorunlu alan varsa fatura kesilemez ve hata mesajı hangi alanın eksik olduğunu söyler.
2. **GİB uyumlu numara.** 16 karakter: 3 harfli seri önekiyle yıl ve 9 haneli sıra (`RNK2026000000001`). Seri her yıl 1'den başlar. e-Fatura ve e-Arşiv için iki ayrı seri vardır; önekleri firma ayarından değiştirilebilir (varsayılan `RNK` ve `RNA`). Numara, kesme işlemiyle aynı transaction'da kilitli bir sayaçtan alınır; numarada boşluk oluşmaz. `FTR-` ile kesilmiş eski faturalar olduğu gibi kalır.
3. **Belge türü ve senaryo.**
   - `document_type`: `e_fatura` ya da `e_arsiv`. Alıcı GİB e-Fatura kayıtlı kullanıcısıysa e-Fatura, değilse e-Arşiv. Kayıtlı kullanıcı sorgusunu sağlayıcı yapar; sahte sağlayıcı müşteri kartındaki işarete bakar.
   - `profile`: `TEMELFATURA`, `TICARIFATURA` ya da `EARSIVFATURA`.
   - `invoice_type_code`: `SATIS`, `TEVKIFAT`, `ISTISNA` ya da `IADE`.
4. **Satır vergileri.** KDV oranı (zaten var), tevkifat oranı ve GİB tevkifat kodu, istisna kodu ve gerekçesi. Tevkifat kodları ve istisna kodları kod içinde sabit bir listedir (GİB kod listeleri); serbest metin kabul edilmez.
5. **UBL-TR 1.2 XML üretimi.** Saf bir fonksiyondur: fatura ve firma kimliğinden XML üretir. ETTN (UUID) faturaya bir kez atanır. XML, şema zorunlu alanları için birim testlerle doğrulanır.
6. **`EInvoiceProvider` arayüzü.**
   - `isRegisteredRecipient(vkn)`
   - `send(document) → { providerId }`
   - `status(providerId) → durum`
   - `cancel(providerId, reason)` (e-Arşiv iptali; e-Fatura'da yalnızca ret ve iade yolu vardır)

   İki uygulaması vardır: `mock` (yerel ve test, gerçek gönderim yok) ve seçilecek entegratör. Hangisinin kullanılacağını `E_INVOICE_PROVIDER` belirler; değer verilmezse özellik kapalıdır ve davranış bugünkü gibi kalır.
7. **Gönderim kuyruğu.** Kesilen fatura `queued` durumuna geçer. Bir cron işçisi (mevcut `notification_outbox` deseni: `FOR UPDATE SKIP LOCKED`, deneme sayısı, `next_attempt_at`) gönderir ve durumu sorgular.
   - Durumlar: `not_connected → queued → sent → accepted | rejected | error`, iptal için `cancelled`.
   - Her geçiş denetim kaydına yazılır.
   - Gönderilmiş bir fatura düzenlenemez ve silinemez.
8. **Ekran.** Fatura listesinde ve detayında e-Belge durumu görünür. Detayda ETTN, belge türü ve hata mesajı yer alır; işlemler "Yeniden dene" ve "XML indir". Firma ayarlarında yasal kimlik ve seri önekleri düzenlenir.

## Kapsam dışı (ayrı iş)

- Gerçek entegratör adaptörü: sözleşme ve sandbox hesabı kullanıcıda.
- e-İrsaliye: aynı arayüzle, sevkiyattan gelecek.
- Yevmiyeye otomatik kayıt: muhasebe işinde, bu modelin üzerine.
- Döviz kuru: TCMB işinde. O iş gelene kadar dövizli faturada kur elle girilir ve XML'e yazılır.

## Veri modeli (053 migration'ı)

- `tenants` tablosuna: `legal_name, tax_number, tax_office, address_line, district, city, postal_code, mersis_no, trade_registry_no, phone, invoice_email, iban, e_fatura_prefix, e_arsiv_prefix`.
- `customers` tablosuna: `e_invoice_registered boolean` (sahte sağlayıcı ve önbellek için), `e_invoice_alias text` (posta kutusu etiketi).
- `invoices` tablosuna:
  - `document_type, profile, invoice_type_code, ettn uuid`
  - `e_invoice_status` CHECK listesi genişler
  - `e_invoice_provider, e_invoice_provider_id, e_invoice_error, e_invoice_attempts, e_invoice_next_attempt_at, e_invoice_sent_at, exchange_rate`
- `invoice_lines` tablosuna: `withholding_code, withholding_percent, exemption_code, exemption_reason, unit_code` (varsayılan `C62`, adet).
- `invoice_number_series (tenant_id, prefix, year, last_number)`: kilitli sayaç.

## Hata ve güvenlik

- Kesme işlemi atomiktir: numara, durum ve kuyruğa ekleme ya birlikte yazılır ya hiç yazılmaz.
- Gönderim, kesmeden ayrıdır. Entegratör kapalı olsa bile fatura kesilir, kuyrukta bekler ve sonra gönderilir.
- Sağlayıcı kimlik bilgileri `secret-box` ile şifreli saklanır; loglara yazılmaz.
- XML'de kişisel veri olarak yalnızca faturada zaten bulunması gereken alanlar yer alır.

## Test

- Birim: numara biçimi ve yıl geçişi; UBL üretimi (zorunlu alanlar, tevkifat ve istisna, toplamlar, KDV alt toplamları); kod listeleri.
- Entegrasyon (gerçek PostgreSQL): eş zamanlı iki kesmede numaralar ardışık ve tekil; yıl geçişi; eksik yasal kimlikte ret; sahte sağlayıcıyla kuyruk akışı `queued → sent → accepted`; ret ve hata sonrası yeniden deneme; gönderilmiş fatura iptal edilemez ve düzenlenemez; tüm geçişler denetimde.
