# RenkFlow Next.js - Admin Panel

Modern mobilya atölyesi için Next.js 16 App Router ile geliştirilmiş üretim takip ve yönetim sistemi.

## 🚀 Özellikler

- ✅ **Next.js 16** - App Router ile modern routing
- ✅ **TypeScript** - Type-safe development
- ✅ **Tailwind CSS** - Utility-first styling
- ✅ **Dark Mode** - Otomatik tema değiştirme
- ✅ **Drag & Drop Kanban** - @dnd-kit entegrasyonu
- ✅ **Responsive Design** - Mobil, tablet ve desktop uyumlu
- ✅ **LocalStorage** - Tarayıcı tabanlı veri persistence

## 📁 Proje Yapısı

```
renkflow-nextjs/
├── app/                      # Next.js App Router
│   ├── (dashboard)/         # Dashboard route group
│   │   ├── dashboard/       # Ana dashboard
│   │   ├── orders/          # Sipariş yönetimi
│   │   ├── new-order/       # Yeni sipariş
│   │   ├── settings/        # Ayarlar
│   │   └── kanban/          # Üretim takip
│   ├── login/              # Giriş sayfası
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── components/
│   ├── ui/                  # Temel UI component'leri
│   ├── layout/              # Layout component'leri
│   ├── dashboard/           # Dashboard component'leri
│   ├── orders/              # Sipariş component'leri
│   └── forms/               # Form component'leri
├── lib/
│   ├── hooks/               # Custom React hooks
│   ├── context/             # React Context providers
│   ├── types/               # TypeScript type definitions
│   └── utils.ts             # Utility functions
└── public/                  # Static assets

```

## 🛠️ Kurulum

### 1. Dependencies Yükleme

```bash
npm install
```

### 2. Development Server

```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## 📦 Kullanılan Teknolojiler

- **Next.js 16.0** - React framework
- **TypeScript 5.0** - Type safety
- **Tailwind CSS 3.4** - Styling
- **@dnd-kit** - Drag and drop
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **Material Symbols** - Icon sistemi

## 🎨 Tasarım Sistemi

### Renkler

```css
--primary: #1e3b8a
--secondary: #06B6D4
--background-light: #FFFFFF
--background-dark: #121620
```

### Typography

- Font Family: Inter (Google Fonts)
- Material Symbols Outlined (Icons)

## 📄 Sayfalar

### Public Pages
- `/` - Landing page
- `/auth/login` - Giriş sayfası

### Dashboard Pages (Protected)
- `/dashboard` - Ana dashboard
- `/orders` - Sipariş listesi (Tablo/Kanban)
- `/orders/[id]` - Sipariş detayı
- `/new-order` - Yeni sipariş oluştur
- `/settings` - Şirket ayarları
- `/kanban` - Üretim takip panosu

## 🔧 Geliştirme

### Build

```bash
npm run build
```

### Production Start

```bash
npm start
```

### Lint

```bash
npm run lint
```

## 📝 Notlar

- Tüm veriler şu an **LocalStorage**'da saklanıyor
- Backend entegrasyonu için API route'ları eklenebilir
- Dark mode tercihi otomatik kaydediliyor
- Kanban drag-and-drop tam fonksiyonel

## 🚢 Deployment

### Vercel (Önerilen)

```bash
vercel --prod
```

### Docker

```bash
docker build -t renkflow-nextjs .
docker run -p 3000:3000 renkflow-nextjs
```

## 📄 License

MIT License - Öğrenme ve geliştirme amaçlı kullanılabilir.

---

**RenkFlow** - Mobilya üretimini dijitalleştirin 🏭
