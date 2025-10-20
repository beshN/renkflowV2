# RenkFlow - Sipariş Takip Sistemi

Alüminyum doğrama siparişlerini takip etmek için geliştirilmiş modern web ve mobil uygulama.

## Özellikler

- Sipariş oluşturma ve takip
- Departman bazlı iş akışı (Kesim, Montaj, Cam, Paketleme)
- Dosya ve fotoğraf yükleme
- Yönetici paneli
- Mobil uygulama desteği (iOS & Android)
- Responsive tasarım
- Gerçek zamanlı durum güncellemeleri

## Web Uygulaması

### Kurulum
\`\`\`bash
npm install
npm run dev
\`\`\`

Tarayıcıda `http://localhost:3000` adresini aç.

### Deployment
\`\`\`bash
npm run build
\`\`\`

Vercel, Netlify veya herhangi bir static hosting servisine deploy edebilirsin.

## Mobil Uygulama

### Hızlı Kurulum
\`\`\`bash
npm run mobile:setup
\`\`\`

Detaylı kurulum için `KURULUM.md` dosyasını oku.

### Gereksinimler
- **iOS:** macOS + Xcode
- **Android:** Android Studio

## Teknolojiler

- **Framework:** Next.js 15
- **UI:** React 19, Tailwind CSS, shadcn/ui
- **Mobil:** Capacitor
- **State:** React Context + localStorage
- **Form:** React Hook Form + Zod
- **Icons:** Lucide React

## Proje Yapısı

\`\`\`
renkflow/
├── app/                    # Next.js app router
│   ├── page.tsx           # Ana sayfa (siparişler)
│   ├── admin/             # Yönetici paneli
│   ├── orders/[id]/       # Sipariş detay
│   └── settings/          # Ayarlar
├── components/            # React bileşenleri
├── lib/                   # Utility fonksiyonlar
├── public/               # Static dosyalar
├── scripts/              # Kurulum scriptleri
└── capacitor.config.ts   # Mobil uygulama config
\`\`\`

## Kullanım

### Sipariş Oluşturma
1. Yönetici paneline git
2. "Yeni Sipariş Ekle" butonuna tıkla
3. Müşteri bilgilerini ve sipariş detaylarını gir
4. Dosya/fotoğraf yükle (opsiyonel)
5. Kaydet

### Sipariş Takibi
1. Ana sayfada siparişleri görüntüle
2. Sipariş kartına tıkla
3. Detaylı bilgileri ve dosyaları gör
4. Durum güncellemelerini takip et

### Mobil Uygulama
1. `npm run mobile:setup` ile kur
2. iOS: `npm run cap:open:ios`
3. Android: `npm run cap:open:android`
4. Xcode/Android Studio'da build yap

## Lisans

MIT

## Destek

Sorularınız için issue açabilirsiniz.
