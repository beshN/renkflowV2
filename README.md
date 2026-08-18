# RenkFlow V2

RenkFlow; sipariş, PDF analizi ve üretim sürecini tek akışta yöneten çok şirketli üretim operasyon platformudur.

## Teknoloji

- Next.js 16 + React 19
- Supabase Auth, Postgres, Storage ve RLS
- Vercel AI Gateway + Workflow
- Resend SMTP / işlem e-postaları
- Saf TypeScript JSON AST hesap motoru

## Yerel geliştirme

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Supabase şeması `supabase/migrations` altındadır. Canlı anahtarlar yalnızca `.env.local`, Supabase ve Vercel ortam değişkenlerinde tutulur.
