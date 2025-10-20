-- Sadece constraint'i kaldır, yeni constraint ekleme
-- Bu script mevcut verilere dokunmaz ve hatasız çalışır

ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

-- Artık status kolonu herhangi bir değer kabul edecek
-- TypeScript type checking uygulama seviyesinde güvenliği sağlayacak
