# KVKK: başvurular, saklama ve silme

Son güncelleme: 14 Ekim 2026. Bu belge yalnızca kodda karşılığı olan uygulamaları anlatır. Hukuki dayanakların ve sürelerin bir avukat ya da veri sorumlusu temsilcisiyle teyit edilmesi gerekir.

## Roller

- **Renk Alüminyum, kendi müşterileri, adayları ve çalışanları için veri sorumlusudur.** Bu belgedeki başvuru, döküm ve silme işlemleri bu verilere uygulanır.
- **RenkFlow (platform), firmanın talimatıyla veri işleyendir.** Platform kullanıcılarına yönelik aydınlatma metni `components/site/KvkkNotice.tsx` dosyasındadır.

## Başvurular (KVKK m.11, m.13)

**Ayarlar → KVKK** sekmesi başvuru defteridir. Her başvurunun türü, başvuranı, tarihi ve son günü (başvurudan 30 gün sonra) kaydedilir. Süresi geçen açık başvurular işaretlenir. Kapatırken verilen yanıt yazılır. Defter, başvuruların süresinde yanıtlandığının kanıtıdır.

| Talep | Ne yapılır |
|---|---|
| Bilgi / veri dökümü | Müşteri sayfası → KVKK → "Veri dökümü (JSON)": kart, siparişler, teklifler, faturalar, tahsilatlar, montajlar, adaylar, servis kayıtları ve KVKK başvuruları. |
| Düzeltme | Müşteri sayfası → Fatura bilgileri, ya da ilgili kayıt düzenlenir. Kesilmiş faturalar düzeltilmez; iade ya da düzeltme faturası gerekir. |
| Silme | Müşteri sayfası → KVKK → "Kişisel verileri sil" (aşağıda). |

Döküm, silme ve başvuru işlemlerini yalnızca firma sahibi ve yöneticiler yapabilir. Hepsi denetim kaydına yazılır.

## Silme (anonimleştirme)

Geri alınamaz. Müşterinin adı yazılarak onaylanır.

**Silinenler**
- Müşteri kartı: ad, e-posta, telefon, adresler, il ve ilçe, ek kişiler, notlar. Kişi TCKN'si silinir; şirket unvanı ve VKN kalır, çünkü KVKK gerçek kişileri korur.
- Kopyalarının bulunduğu yerler:
  - siparişlerdeki ad, e-posta ve telefon;
  - tekliflerdeki ad ile onay veren kişinin adı, IP adresi ve tarayıcı bilgisi;
  - adaylardaki kişi bilgileri;
  - montajlardaki adres ile teslim imzasının adı ve IP adresi;
  - keşif adresleri.
- Müşteri takip bağlantıları iptal edilir.
- Mesaj kuyruğu: alıcı ve içerik silinir, gönderilmemiş mesajlar hiç gönderilmez.
- Müşterinin kendi değişiklik geçmişindeki eski değerler silinir. Olayların kendisi kalır; değiştirilemez denetim izinin denetimli temizlik anahtarı kullanılır (051).

**Korunanlar** (yasal saklama yükümlülüğü, KVKK m.5/2-ç)
- Faturalar, tahsilatlar ve yevmiye kayıtları değiştirilmez. Ticari defter ve belgeler 10 yıl (TTK m.82), vergi kayıtları 5 yıl (VUK m.253) saklanır.

## Saklama süreleri (kodda uygulanan)

| Veri | Süre | Nasıl |
|---|---|---|
| Araç konum kayıtları | Firma ayarı, varsayılan 365 gün | Günlük temizlik `/api/cron/storage-cleanup` (03:00 İstanbul), `pruneVehiclePositions` |
| Hız sınırı sayaçları | Pencere süresi | Aynı günlük temizlik, `pruneRateLimitBuckets` |
| Oturumlar | 30 gün hareketsizlik | Süresi dolan oturum kapanır |
| Fatura, tahsilat, yevmiye | 10 yıl | Silinmez; anonimleştirmede de korunur |
| Diğer müşteri verisi | Talep edilene ya da iş ilişkisi bitene kadar | Başvuru üzerine anonimleştirme |

## Not

Günlük temizlik 14 Ekim'e kadar canlıda hiç çalışmıyordu: yalnızca Pro planı için hazırlanmış `vercel.pro.json`'da dakikalık olarak tanımlıydı. Artık Hobby planının izin verdiği günlük cron olarak `vercel.json`'da tanımlı.

## Açık işler

- Süresi dolan veriler için otomatik imha. Örneğin, son işlemi 10 yılı aşan müşteriler için yıllık bir imha listesi. Bu işin karar kuralı firma tarafından belirlenmeli.
- VERBİS kaydı ve veri işleme envanteri. Bunlar teknik değil idari işlerdir.
