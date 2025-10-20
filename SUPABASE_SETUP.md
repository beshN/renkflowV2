# Supabase Kurulum Rehberi

## 1. Database Tablolarını Oluştur

Projeyi indirdikten sonra, database tablolarını oluşturmak için SQL scriptini çalıştırman gerekiyor:

\`\`\`bash
# v0'da script otomatik çalıştırılabilir
# Veya Supabase SQL Editor'de manuel çalıştırabilirsin
\`\`\`

SQL script dosyası: `scripts/001_create_orders_table.sql`

## 2. Environment Variables

Supabase bağlantısı için gerekli environment variable'lar v0 tarafından otomatik eklendi:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Özellikler

### Gerçek Zamanlı Senkronizasyon
- Bir cihazda yapılan değişiklikler anında diğer cihazlara yansır
- Supabase Realtime kullanılıyor

### Veri Güvenliği
- Row Level Security (RLS) aktif
- Şu an tüm kullanıcılar okuma/yazma yapabiliyor
- İleride kullanıcı bazlı yetkilendirme eklenebilir

### Dosya Depolama
- Dosyalar base64 olarak database'de saklanıyor
- Büyük dosyalar için Supabase Storage kullanılabilir

## 4. Kullanım

### Yeni Sipariş Ekleme
\`\`\`typescript
await addOrder({
  customerName: "Müşteri Adı",
  status: "new",
  department: "celik-kapi",
  // ... diğer alanlar
})
\`\`\`

### Sipariş Güncelleme
\`\`\`typescript
await updateOrder(orderId, {
  status: "in-progress",
  notes: "Güncelleme notu"
})
\`\`\`

### Sipariş Silme
\`\`\`typescript
await deleteOrder(orderId)
\`\`\`

## 5. Sorun Giderme

### Siparişler yüklenmiyor
- Supabase bağlantısını kontrol et (Connect sekmesi)
- SQL scriptinin çalıştırıldığından emin ol
- Browser console'da hata mesajlarını kontrol et

### Gerçek zamanlı güncelleme çalışmıyor
- Supabase Realtime'ın aktif olduğundan emin ol
- Network bağlantısını kontrol et

## 6. İleri Seviye

### Kullanıcı Yetkilendirmesi Eklemek
Şu an RLS politikaları herkese açık. Kullanıcı bazlı yetkilendirme için:

1. Auth sistemi ekle (Supabase Auth)
2. RLS politikalarını güncelle
3. Kullanıcı ID'lerini orders tablosuna ekle

### Dosya Boyutu Optimizasyonu
Büyük dosyalar için Supabase Storage kullan:

\`\`\`typescript
// Dosyayı Storage'a yükle
const { data, error } = await supabase.storage
  .from('order-files')
  .upload(`${orderId}/${fileName}`, file)

// URL'i database'e kaydet
await supabase.from('order_files').insert({
  order_id: orderId,
  name: fileName,
  url: data.path
})
