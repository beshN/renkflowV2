# Supabase Database Hatası Düzeltme

## Sorun
`orders_department_check` constraint hatası alıyorsunuz çünkü database'deki constraint değerleri uygulamanın kullandığı değerlerle eşleşmiyor.

## Çözüm

### Adım 1: Supabase Dashboard'a Git
1. [Supabase Dashboard](https://supabase.com/dashboard) açın
2. Projenizi seçin
3. Sol menüden **SQL Editor**'ü açın

### Adım 2: Migration Script'i Çalıştır
1. `scripts/002_fix_department_constraint.sql` dosyasını açın
2. Tüm SQL kodunu kopyalayın
3. Supabase SQL Editor'e yapıştırın
4. **RUN** butonuna tıklayın

### Adım 3: Doğrulama
Script başarıyla çalıştıktan sonra:
1. v0'da admin paneline gidin
2. Yeni bir sipariş eklemeyi deneyin
3. Artık hata almamalısınız

## Script Ne Yapıyor?
- Eski `orders_department_check` constraint'ini kaldırıyor
- Yeni constraint'i doğru değerlerle ekliyor: `cam`, `demir`, `tente`, `kumas`
- Status constraint'ini de güncelliyor

## Alternatif: Tabloyu Sıfırdan Oluştur
Eğer tabloda önemli veri yoksa:
1. `DROP TABLE orders;` çalıştırın
2. `scripts/001_create_orders_table.sql` dosyasını çalıştırın
