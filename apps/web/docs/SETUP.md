# RenkFlow Setup Guide

## 🚀 Quick Start

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Setup Environment Variables

Create `.env.local` in project root:

```bash
cp .env.example .env.local
```

Fill in the required values (see below for where to get them).

### 3️⃣ Push Database Schema
```bash
npm run db:push
```

### 4️⃣ Run Development Server
```bash
npm run dev
```

---

## 🔑 Getting Your Keys

### 🔵 Neon Database

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Paste into `DATABASE_URL`

**Format:**
```
DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require"
```

### 🟠 Cloudflare R2

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage**
3. Create a new bucket: `renkflow-documents`
4. Go to **Manage R2 API Tokens**
5. Create new token with "Edit" permissions
6. Copy:
   - Account ID → `R2_ACCOUNT_ID`
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`

**Optional:** Setup custom domain for public access
- Go to bucket settings → Public access
- Add custom domain
- Update `R2_PUBLIC_URL`

### 🟢 Supabase Auth

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **API**
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Setup Authentication:**
1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Optional: Enable social providers (Google, GitHub, etc.)

---

## 📁 Project Structure

```
lib/
├── auth/
│   └── supabase.ts          # Supabase Auth client
├── db/
│   ├── neon.ts              # Neon DB client
│   └── schema.sql           # Database schema
├── storage/
│   └── r2.ts                # R2 storage helpers
└── services/
    ├── index.ts             # Auto-selects Mock or Neon
    ├── types.ts             # Service interfaces
    ├── mock/
    │   └── order.mock.ts    # localStorage implementation
    └── neon/
        └── order.neon.ts    # Neon + R2 implementation
```

---

## 🔄 Service Auto-Selection

The app automatically uses:
- **MockOrderService** (localStorage) when `DATABASE_URL` is not set
- **NeonOrderService** (Neon + R2) when `DATABASE_URL` is configured

No code changes needed! Just set your environment variables.

---

## 🧪 Testing

### Without Database (Mock)
```bash
# Just run without DATABASE_URL
npm run dev
```

### With Database (Neon + R2)
```bash
# Set up .env.local with all keys
npm run db:push
npm run dev
```

---

## 🚨 Troubleshooting

### "DATABASE_URL not found"
- Make sure `.env.local` exists
- Check that variable name is exactly `DATABASE_URL`
- Restart dev server after adding variables

### "Schema push failed"
- Verify Neon connection string is correct
- Check if you have permissions on the database
- Try running schema manually in Neon SQL Editor

### "R2 upload failed"
- Verify all R2 credentials are correct
- Check bucket name matches `R2_BUCKET_NAME`
- Ensure API token has "Edit" permissions

### "Auth not working"
- Verify Supabase URL and anon key
- Check if NEXT_PUBLIC_ prefix is present
- Restart dev server after adding auth keys

---

## 📊 Cost Estimates (Monthly)

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| **Neon** | 500MB, 191h compute | $19/mo pro plan |
| **R2** | 10GB storage | $0.015/GB |
| **Supabase Auth** | 50K MAU | Free forever |

**Total for small business:** ~$0-5/month

---

## 🎯 Next Steps

1. ✅ Setup environment variables
2. ✅ Push database schema
3. ✅ Test with mock data first
4. 🔄 Configure Neon + R2
5. 🔄 Setup Supabase Auth policies
6. 🚀 Deploy to production

---

## 📚 Documentation Links

- [Neon Docs](https://neon.tech/docs)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
