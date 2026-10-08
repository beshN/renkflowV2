# 0002 · Renk modeli: tüm RAL Classic renkleri

Tarih: 8 Ekim 2026 · Durum: uygulandı (Tur 0c)

## Bağlam
Teklif yapılandırıcı renkleri firmanın elle yazdığı katalogdan alıyordu (Tur 0b). Firma tüm RAL
renklerinin seçilebilmesini, seçilen rengin önizlemesinin teklifte ve usta ekranlarında görünmesini istedi.
Eski kayıtlarda renk serbest metin ("7016 Mat", "7016 MAT", "7016  mat").

## Karar
- Renk tek metin alanında kalır; yazım "RAL 7016 Mat" (kod + boya cinsi). Göç yok.
- Seçenekler: 216 RAL Classic + Boyasız, Eloksal (natürel/siyah), Ahşap desen (ad), Özel renk (ad, isteğe bağlı hex).
- Boya cinsi ayrı seçim: Mat (varsayılan), Parlak, İnce doku, Kum. Yazılmamışsa Mat sayılır.
- İki metin aynı renk mi sorusunu tek fonksiyon cevaplar (`colorKey`, `lib/features/colors/color-spec.ts`):
  katalog tekilliği, stok eşleşmesi, kesim motoru ve ekranlar aynı kuralı kullanır.
- Firmanın renk kataloğu "Sık kullanılanlar"a dönüşür; seçimi sınırlamaz.
- Hex yalnız ekran yaklaşımıdır; arayüz her önizlemede numuneyle teyit notunu gösterir.

## Sonra (kapsam dışı)
- RAL Design System+ ve NCS: ihtiyaç olursa aynı modele yeni `kind` olarak eklenir.
- Tente yapılandırıcısının gövde paleti (3B sahne) RAL seçiciye taşınabilir.
- Stok girişi ve sayımda serbest metin yerine seçici (bugün yazılan metnin karosu gösteriliyor).
