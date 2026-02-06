# 🌐 RenkFlow Site Erişim Rehberi

## 📍 Server Bilgisi
**Port:** http://localhost:3001

---

## 🔓 Public Sayfalar (Giriş Gerektirmez)

### Landing Pages
- ✅ `/` - Ana sayfa (Waitlist)
- ✅ `/features` - Özellikler
- ✅ `/pricing` - Fiyatlandırma
- ✅ `/integrations` - Entegrasyonlar
- ✅ `/contact` - İletişim
- ✅ `/faq` - SSS
- ✅ `/blog` - Blog
- ✅ `/about` - Hakkımızda
- ✅ `/careers` - Kariyer
- ✅ `/privacy` - Gizlilik Politikası
- ✅ `/terms` - Kullanım Koşulları
- ✅ `/cookies` - Çerez Politikası
- ✅ `/roadmap` - Yol Haritası
- ✅ `/changelog` - Güncellemeler
- ✅ `/full-landing` - Tam Landing Page
- ✅ `/press` - Basın Kiti
- ✅ `/docs` - Dokümantasyon
- ✅ `/security` - Güvenlik
- ✅ `/status` - Sistem Durumu

### Auth Pages
- ✅ `/auth/login` - Giriş Yap
- ✅ `/signup` - Kayıt Ol
- ↪️ `/auth/signup` → `/signup`'a yönlendirir (308)
- ✅ `/auth/forgot-password` - Şifremi Unuttum
- ✅ `/auth/update-password` - Şifre Güncelle
- ↪️ `/auth/verify-email` → `/auth/verify`'e yönlendirir (307)
- ✅ `/auth/verify` - Email doğrulama sayfası
- ✅ `/auth/accept-invite` - Davet Kabul

---

## 🔒 Protected Sayfalar (Giriş Gerektirir)

### Dashboard
- 🔐 `/dashboard` - Ana Dashboard
- 🔐 `/orders` - Siparişler
- 🔐 `/orders/[id]` - Sipariş Detay
- 🔐 `/new-order` - Yeni Sipariş
- 🔐 `/notifications` - Bildirimler
- 🔐 `/settings` - Ayarlar

---

## 🎯 Middleware Yapılandırması

### Public Routes
```typescript
const publicRoutes = [
  '/',
  '/features',
  '/pricing',
  '/integrations',
  '/contact',
  '/faq',
  '/blog',
  '/about',
  '/careers',
  '/privacy',
  '/terms',
  '/cookies',
  '/roadmap',
  '/changelog',
  '/full-landing',
  '/press',
  '/docs',
  '/security',
  '/status',
  '/sitemap',
];
```

### Auth Routes
```typescript
const authRoutes = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/update-password',
  '/auth/accept-invite',
  '/auth/sso-verify',
];

// Redirect'ler (proxy.ts middleware — next.config.js'den önce çalışır):
// /auth/signup → /signup (308 permanent)
// /auth/verify-email → /auth/verify (307 temporary)
```

### Public API Routes
```typescript
const publicApiRoutes = [
  '/api/auth',
  '/api/subscribe',
  '/api/signup',
  '/api/verify-email',
  '/api/forgot-password',
  '/api/reset-password',
];
```

---

## 🔄 Middleware Davranışı

### 1. Public Route'lara Erişim
- ✅ Herkes erişebilir
- ✅ Giriş gerektirmez
- ✅ Redirect yok

### 2. Auth Route'lara Erişim
- ✅ Giriş yapmamış kullanıcılar erişebilir
- ❌ Giriş yapmış kullanıcılar `/dashboard`'a yönlendirilir

### 3. Protected Route'lara Erişim
- ✅ Giriş yapmış kullanıcılar erişebilir
- ❌ Giriş yapmamış kullanıcılar `/auth/login`'e yönlendirilir
- 📍 Callback URL olarak hedef sayfa kaydedilir

---

## 🧪 Test Senaryoları

### Senaryo 1: Giriş Yapmadan Gezinme
```
1. http://localhost:3001/ → ✅ Landing page
2. http://localhost:3001/features → ✅ Features page
3. http://localhost:3001/pricing → ✅ Pricing page
4. http://localhost:3001/dashboard → ❌ Redirect to /auth/login
5. http://localhost:3001/orders → ❌ Redirect to /auth/login
```

### Senaryo 2: Giriş Yaptıktan Sonra
```
1. http://localhost:3001/dashboard → ✅ Dashboard
2. http://localhost:3001/orders → ✅ Orders page
3. http://localhost:3001/auth/login → ❌ Redirect to /dashboard
4. http://localhost:3001/ → ✅ Landing page (hala erişilebilir)
```

---

## 📝 Test Kullanıcısı Oluşturma

### Option 1: Signup Page
```
1. http://localhost:3001/signup
2. Form doldur
3. Email doğrulama (geliştirme modunda otomatik)
4. Giriş yap
```

### Option 2: Direct Database
```sql
-- Test kullanıcısı ekle
INSERT INTO users (name, email, password, email_verified, created_at, updated_at)
VALUES ('Test User', 'test@example.com', '$2a$10$...', NOW(), NOW(), NOW());

-- Tenant oluştur
INSERT INTO tenants (name, slug, created_at, updated_at)
VALUES ('Test Company', 'test-company', NOW(), NOW());

-- Kullanıcıyı tenant'a bağla
INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
VALUES (1, 1, 'owner', NOW());
```

---

## 🚀 Hızlı Erişim Linkleri

### Landing Pages
- http://localhost:3001/
- http://localhost:3001/features
- http://localhost:3001/pricing
- http://localhost:3001/contact

### Auth
- http://localhost:3001/auth/login
- http://localhost:3001/signup

### Dashboard (Giriş Gerekli)
- http://localhost:3001/dashboard
- http://localhost:3001/orders

---

## ⚙️ Middleware Özellikleri

### ✅ Yapılanlar
- Public route'lar belirlendi
- Auth route'lar belirlendi
- Protected route'lar belirlendi
- Redirect logic eklendi
- Callback URL desteği
- Static file exclusion
- API route handling

### 🎯 Özellikler
- NextAuth integration
- JWT session strategy
- Role-based access (hazır)
- Callback URL preservation
- Clean redirects

---

## 🔧 Sorun Giderme

### Problem: Dashboard'a erişemiyorum
**Çözüm:** Giriş yapmış olmanız gerekiyor
```
1. http://localhost:3001/auth/login
2. Giriş yap veya kayıt ol
3. Dashboard'a yönlendirileceksiniz
```

### Problem: Landing page'lere erişemiyorum
**Çözüm:** Middleware doğru çalışıyor, bu sayfalar public
```
Direkt erişebilirsiniz:
- http://localhost:3001/
- http://localhost:3001/features
- http://localhost:3001/pricing
```

### Problem: Auth sayfalarına giriş yaptıktan sonra erişemiyorum
**Çözüm:** Bu beklenen davranış, dashboard'a yönlendiriliyorsunuz
```
Giriş yapmış kullanıcılar auth sayfalarına erişemez
Otomatik olarak /dashboard'a yönlendirilir
```

---

## 📊 Route Haritası

```
RenkFlow
├── Public Routes (Herkes)
│   ├── Landing Pages (/, /features, /pricing, vb.)
│   └── Auth Pages (/auth/login, /signup, vb.)
│
├── Protected Routes (Sadece Giriş Yapanlar)
│   ├── Dashboard (/dashboard)
│   ├── Orders (/orders, /orders/[id])
│   ├── New Order (/new-order)
│   ├── Notifications (/notifications)
│   └── Settings (/settings)
│
└── API Routes
    ├── Public APIs (/api/auth, /api/subscribe, vb.)
    └── Protected APIs (Diğer tüm API'ler)
```

---

**Middleware Dosyası:** `/proxy.ts`
**Auth Config:** `/auth.config.ts`
**Auth Handler:** `/auth.ts`

**Tüm site erişilebilir! 🎉**

---

## 🌍 URL / Domain Yönetimi

### Environment Variables
```bash
# .env.local (geliştirme)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# .env.production (prod / Vercel)
NEXT_PUBLIC_APP_URL="https://app.renkflow.com"
NEXTAUTH_URL="https://app.renkflow.com"
```

### Önemli Notlar
- `robots.ts` ve `sitemap.ts` dosyaları `NEXT_PUBLIC_APP_URL` env var'ını kullanır
- Fallback olarak `https://renkflow.com` kullanılır
- Hardcoded domain kullanılmaz — tüm dinamik URL'ler env-based'dir
- `renkflow.com` domain'i middleware tarafından `/coming-soon`'a yönlendirilir

---

## 📦 Standalone Start

```bash
# Build
npm run build

# Standalone mode (production)
npm run start:standalone

# Kalite kontrol (type-check + lint + test + build)
npm run validate
```
