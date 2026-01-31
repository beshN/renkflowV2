# Email Template Kurulum Kılavuzu

## 📧 Resend ile Email Gönderimi

### 1. Resend Hesabı Oluştur

1. [resend.com](https://resend.com) → Sign up
2. Domain doğrula veya test için `onboarding@resend.dev` kullan
3. API Key oluştur

### 2. Environment Değişkenleri

`.env.local` dosyasına ekle:

```env
RESEND_API_KEY=re_123456789abcdefgh
```

### 3. Paketleri Kur

```bash
npm install resend react-email @react-email/components
```

### 4. Kayıt API Route'unu Güncelle

`app/api/auth/register/route.ts`:

```typescript
import { sendVerificationEmail } from '@/lib/email';

// User oluşturduktan sonra:
const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${verificationToken}`;

// Token'ı database'e kaydet
await sql`
  UPDATE users
  SET verification_token = ${verificationToken}
  WHERE id = ${userId}
`;

// Email gönder
await sendVerificationEmail(email, name, verificationUrl);
```

### 5. Email Verification Route Oluştur

`app/auth/verify/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/auth/login?error=invalid_token', request.url));
  }

  try {
    const users = await sql`
      UPDATE users
      SET email_verified = NOW(), verification_token = NULL
      WHERE verification_token = ${token}
      RETURNING id, email
    `;

    if (users.length === 0) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid_token', request.url));
    }

    return NextResponse.redirect(new URL('/auth/login?verified=true', request.url));
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL('/auth/login?error=verification_failed', request.url));
  }
}
```

---

## 🎨 Email Template Özelleştirme

### Template'i Görsel Olarak Düzenle

```bash
npx react-email dev
```

Bu komut `http://localhost:3000` adresinde email preview açar.

### Kendi Tasarımını Ekle

`emails/verify-email.tsx` dosyasını düzenle:

- **Logo:** `src="https://yourdomain.com/logo.png"` değiştir
- **Renkler:** `backgroundColor`, `color` değiştir
- **Metin:** Türkçe içeriği istediğin gibi düzenle
- **Buton:** `button` style'ını özelleştir

### Diğer Email Şablonları

Aynı şekilde oluşturabilirsin:
- `emails/password-reset.tsx` - Şifre sıfırlama
- `emails/welcome.tsx` - Hoş geldin
- `emails/invitation.tsx` - Davet maili

---

## 🧪 Test

### Development'ta Test

```typescript
// Test endpoint: app/api/test-email/route.ts
import { sendVerificationEmail } from '@/lib/email';

export async function GET() {
  const result = await sendVerificationEmail(
    'test@yourdomain.com',
    'Test User',
    'http://localhost:3000/auth/verify?token=test123'
  );
  
  return Response.json(result);
}
```

Tarayıcıda aç: `http://localhost:3000/api/test-email`

---

## 💡 Alternatif: Nodemailer (SMTP)

Kendi SMTP sunucunla kullanmak istersen:

```bash
npm install nodemailer
```

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

await transporter.sendMail({
  from: '"Renkflow" <noreply@yourdomain.com>',
  to: email,
  subject: 'Hesabınızı Doğrulayın',
  html: emailHtml,
});
```

---

## ✅ Özet

1. **Resend hesabı** oluştur → API Key al
2. **Paketleri** kur (`resend`, `react-email`)
3. **Email template** oluştur (`emails/verify-email.tsx`)
4. **Email gönderimi** ekle (`lib/email.ts`)
5. **Kayıt API**'sini güncelle (email gönder)
6. **Verification route** ekle (`/auth/verify`)
7. **Test et** → Production'a deploy

Sorularınız varsa sorun! 🚀
