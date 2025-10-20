# Database Kurulum Rehberi

## Adım 1: Supabase'e Giriş Yap

1. [Supabase Dashboard](https://supabase.com/dashboard) adresine git
2. Projenizi seçin

## Adım 2: SQL Editor'ü Aç

1. Sol menüden **SQL Editor** sekmesine tıklayın
2. **New Query** butonuna tıklayın

## Adım 3: SQL Script'i Çalıştır

1. `scripts/COMPLETE_DATABASE_SETUP.sql` dosyasını açın
2. **TÜM İÇERİĞİ** kopyalayın
3. Supabase SQL Editor'e yapıştırın
4. **RUN** butonuna tıklayın

## Adım 4: Kontrol Et

Script çalıştıktan sonra:

1. Sol menüden **Table Editor** sekmesine git
2. Şu tabloları görmelisiniz:
   - `orders` (Siparişler)
   - `order_files` (Dosyalar)
   - `materials` (Malzemeler)

## Adım 5: Test Et

1. v0'da uygulamayı yenileyin
2. Admin panelinden yeni bir sipariş ekleyin
3. Ana sayfada siparişin göründüğünü kontrol edin

## Sorun Yaşarsanız

Eğer hata alırsanız:

1. SQL Editor'de şu komutu çalıştırın:
\`\`\`sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
\`\`\`

2. Hangi tabloların var olduğunu kontrol edin
3. Eksik tablo varsa, sadece o tablonun CREATE TABLE komutunu çalıştırın

## Önemli Notlar

- Bu script mevcut tabloları SİLER ve yeniden oluşturur
- Eğer database'de veri varsa, önce yedek alın
- Script bir kere çalıştırılmalı, tekrar çalıştırmanıza gerek yok
- Tüm constraint'ler ve index'ler otomatik oluşturulur

## Başarılı Kurulum Sonrası

Artık:
- ✅ Siparişler database'de saklanıyor
- ✅ Tüm cihazlarda senkronize oluyor
- ✅ Sipariş kodları RNK-2025-XXX formatında
- ✅ Boyaya gönderilecek ve imalat sorunu dialogları onay sorusu sormuyor
- ✅ Sipariş düzenleme doğru çalışıyor
