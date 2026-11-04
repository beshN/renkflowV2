# Kayıtlı kesim listesi CSV

Kesim föyü ekranındaki **CSV indir**, `GET /api/v1/production/cut-plans/[id]/csv`
üzerinden kayıtlı `result.bars[].pieces[]` sonucunu indirir. Yeniden optimizasyon,
rezervasyon, stok hareketi, onay veya başka bir yazma yoktur. Taslak ve iptal edilmiş
planlar da indirilebilir; plan durumu ayrı sütundadır. AI önerileri için mevcut
insan onayı süreci değişmez; CSV onay yerine geçmez.

UTF-8 BOM Türkçe karakterlerin Excel'de tanınmasını sağlar. Türkçe Excel'in ondalık
virgülüyle karışmaması ve mevcut audit CSV ile tutarlılık için `;` ayırıcı ve CRLF
kullanılır. Sayısal değerler JavaScript'in noktalı ondalık gösterimini korur; Excel
bölge ayarına göre içe aktarma gerekebilir. Ortak `audit-csv.csvCell` ve
`spreadsheet-safe` yardımcıları yeniden kullanılır. Metin kodları `-123` dahil
`=,+,-,@` ile başlarsa apostrof eklenir; gerçek sayılar değiştirilmez.

Her satır kayıtlı bir fiziksel parçadır: adet 1; profil/parça sırası kayıtlı dizinin
1 tabanlı sırasıdır. Sipariş numarası tenant kapsamlı iş emri/sipariş bağlantısından,
profil kodu `inventory_items.profile_code` alanından gelir (SKU ile doldurulmaz).
İsim ve kod güncel tenant stok kartındandır; plan tarihindeki bir katalog snapshot'ı
değildir. Uzunluk ve artık yalnız kayıttaki mm değerlerinden alınır; kg, m veya adet
çevrimi/toplamı yoktur. Artık her parçada tekrarlanır, toplanmamalıdır. Açı ve
etiket/parça kodu mevcut motorun kayıt sözleşmesinde yoktur: boş sütun bırakılır.
Eksik numara/kod/ölçü sıfır veya başka veriyle doldurulmaz. `parameterSource`
`default`/`unconfirmed` ise Tahmini=Evet, `confirmed` ise Hayır, yoksa boş.

Kesim föyünün owner/admin/office rol sınırı korunur; ayrıca mevcut üye erişim
kısıtlaması `requireWorkOrderPermission(view)` ile uygulanır. Tenant yalnız doğrulanmış
oturumdan gelir; tüm bağlantılar tenant koşulu taşır. Worker atölye görünümü daha
daraltılmış ayrı bir DTO kullanır; bu indirme o görünümü genişletmez.

CI kaydı: `scripts/test-cutting-list-export.ts`, mevcut `test:integration` dosya
keşfine otomatik katılır; `.github/workflows/validate.yml` bu komutu zaten çalıştırır.
Yeni workflow/package/runner değişikliği gerekmez. Sentetik fixture'lar yalnız geçici
yerel `renkflow_test` içinde iki-tenant plan ve item/job/order join izolasyonunu sınar.
Migration yoktur. CSV makine/CNC talimatı değildir; kesim öncesi insan kontrolü gerekir.
