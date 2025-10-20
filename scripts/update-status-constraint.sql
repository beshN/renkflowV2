-- Mevcut status constraint'ini kaldır
-- Bu işlem mevcut verilere dokunmaz, sadece constraint'i kaldırır
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Başarılı mesajı
SELECT 'Status constraint başarıyla kaldırıldı!' as message;
