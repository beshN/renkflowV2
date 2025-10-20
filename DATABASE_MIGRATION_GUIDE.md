# Database Migration Rehberi

## Eksik Kolonları Ekleme

Supabase database'inde `orders` tablosunda bazı kolonlar eksik. Bunları eklemek için:

### Adımlar:

1. **Supabase Dashboard'a Git**
   - https://supabase.com adresine git
   - Projenizi seçin

2. **SQL Editor'ü Aç**
   - Sol menüden "SQL Editor" seçeneğine tıkla
   - "New Query" butonuna tıkla

3. **Migration Script'i Çalıştır**
   - `scripts/004_add_missing_columns.sql` dosyasının içeriğini kopyala
   - SQL Editor'e yapıştır
   - "Run" butonuna tıkla

4. **Sonucu Kontrol Et**
   - Hata almadan çalışmalı
   - "Success" mesajı görmelisin

### Script Ne Yapıyor?

Bu script şu kolonları ekliyor:
- `order_id` - Sipariş numarası (RNK-2025-001 gibi)
- `customer_phone` - Müşteri telefonu
- `product_type` - Ürün tipi
- `quantity` - Adet

### Script Çalıştırdıktan Sonra:

Artık sipariş ekleyebilir ve düzenleyebilirsin. Tüm özellikler çalışacak.

### Sorun Yaşarsan:

Eğer script hata verirse:
1. Önce mevcut `orders` tablosunu kontrol et
2. Eğer tabloda veri varsa, önce verileri yedekle
3. Gerekirse tabloyu silip `001_create_orders_table.sql` script'ini tekrar çalıştır
</parameter>
