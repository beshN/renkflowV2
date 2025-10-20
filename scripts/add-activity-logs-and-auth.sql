-- Aktivite geçmişi için activity_logs tablosu oluştur
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  user_name TEXT DEFAULT 'Sistem',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity logs için index oluştur
CREATE INDEX IF NOT EXISTS idx_activity_logs_order_id ON activity_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
