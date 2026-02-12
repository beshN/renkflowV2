# RenkFlow Setup Guide

## Quick Start

1. Install dependencies
```bash
npm install
```

2. Create local env file
```bash
cp .env.example .env.local
```

3. Set required variables in `.env.local`
- `DATABASE_URL`
- `STORAGE_BACKEND=gcs`
- `GCS_BUCKET_NAME`
- `AUTH_SECRET`
- `NEXTAUTH_SECRET` (same value as `AUTH_SECRET`)
- `NEXT_PUBLIC_APP_URL`

4. Push database schema
```bash
npm run db:push
```

5. Run development server
```bash
npm run dev
```

## Database Configuration

### Production (Cloud SQL socket URL)
Use Cloud SQL socket format:
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost/DB_NAME?host=/cloudsql/PROJECT:REGION:INSTANCE&sslmode=disable"
```

### Local development
Use one of these:
- Local PostgreSQL instance
- Cloud SQL Proxy (`127.0.0.1:<proxy-port>`)

## Storage Configuration

Only Google Cloud Storage is supported.

```env
STORAGE_BACKEND="gcs"
GCS_BUCKET_NAME="your-gcs-bucket"
GCS_PUBLIC_URL=""
```

## Auth Configuration

```env
AUTH_SECRET="<32+ chars>"
NEXTAUTH_SECRET="<same as AUTH_SECRET>"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="false"
```

OAuth providers are optional:
```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
AZURE_AD_CLIENT_ID=""
AZURE_AD_CLIENT_SECRET=""
AZURE_AD_TENANT_ID=""
```

## Deployment Notes

- Cloud Run should receive `DATABASE_URL` from Secret Manager.
- Runtime env must include `STORAGE_BACKEND=gcs` and `GCS_BUCKET_NAME`.
- Runtime service account needs access to:
  - Cloud SQL Client
  - Secret Manager Secret Accessor
  - Storage Object Admin (bucket-scoped preferred)

### Vercel Preview / Production auth contract

For stable NextAuth runtime on Vercel, configure these variables in both Preview and Production:

- `DATABASE_URL`
- `AUTH_SECRET` (32+ chars)
- `NEXTAUTH_SECRET` (same value as `AUTH_SECRET`)
- `AUTH_TRUST_HOST=true`

Recommended for callback/url consistency:

- `AUTH_URL` and/or `NEXTAUTH_URL` to the active deployment domain
- `NEXT_PUBLIC_APP_URL` to the same public domain

## Validation

Run full quality checks:
```bash
npm run validate
```

Run coming-soon smoke test:
```bash
npm run smoke:coming-soon -- https://<your-cloud-run-url>
```

## Troubleshooting

### "DATABASE_URL is not defined"
- Verify Cloud Run secret binding for `DATABASE_URL`
- Verify `.env.local` contains `DATABASE_URL` for local runs

### "Production localhost DATABASE_URL requires Cloud SQL socket"
- Ensure URL includes `host=/cloudsql/<INSTANCE_CONNECTION_NAME>` query param

### "GCS_BUCKET_NAME is not configured"
- Set `GCS_BUCKET_NAME` in runtime env or `.env.local`
- Keep `STORAGE_BACKEND=gcs`
