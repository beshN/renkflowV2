# RenkFlow Vercel deployment

The application uses Vercel Functions, private Vercel Blob and Marketplace PostgreSQL (Neon). Google Cloud credentials are not required. External OpenAI, Resend and optional WhatsApp credentials are still required for their respective features; Vercel hosts the application rather than replacing those providers.

## Project and resources

Use existing project `renkflowv2`, team `beshnovski-projects`. Set **Root Directory `apps/web`**, Node.js **22.x**, framework **Next.js**, install command `npm ci --workspaces=false --legacy-peer-deps`, build command `npm run build:vercel`, output `.next`, and enable Fluid Compute. The committed `apps/web/vercel.json` defines Frankfurt functions and three authenticated worker routes. Create PostgreSQL in a matching EU region through Vercel Marketplace and use a **pooled** runtime `DATABASE_URL` requiring TLS. Connect a separate **direct/unpooled** `DATABASE_URL_UNPOOLED` for migrations. A private Blob store needs `BLOB_READ_WRITE_TOKEN` for authenticated direct browser uploads; server-side operations also support store-scoped OIDC when connected to the project.

Production and Preview must use **separate databases/branches, Blob stores and session secrets**. Do not attach the production resources to all environments. A Neon preview branching integration can create branch-specific databases. Preview deployments are protected in Vercel; do not disable deployment protection to run tests.

The default `vercel.json` has no scheduled tasks so an isolated Hobby preview can deploy. `vercel.pro.json` preserves the three minute-level schedules for an explicitly enabled Pro production release (`npx vercel@62.2.0 deploy --prod --local-config apps/web/vercel.pro.json` from the repository root). Minute-level Cron schedules require **Vercel Pro or above**; Hobby rejects them. Preview workers are intentionally disabled and must be exercised through the authenticated management queue controls. This Hobby preview is not a live factory deployment. The inbound function has a 300-second maximum on Fluid Compute and claims one inbox message, with a 15-minute recovery lease. Notifications claim five deliveries and cleanup claims twenty objects per invocation. SQL leases and `FOR UPDATE SKIP LOCKED` prevent overlapping workers from claiming the same live task; email uses provider idempotency keys, and uncertain WhatsApp delivery is held for operator review. Cron runs only in Production and checks a strong `CRON_SECRET`. Monitor queue backlog; capacity is bounded and busy factories may need additional scheduling throughput.

## Environment management

Tracked templates: `.env.example`, `.env.vercel.preview.example`, `.env.vercel.production.example`. Local secrets belong in ignored files ending in `.local`, with permissions `0600`. Existing `.env.local` remains the local development environment. The prepared `.env.vercel.preview.local` and `.env.vercel.production.local` have independent generated session secrets and the authorized OpenAI key, but their unprovisioned DB/Blob/domain values remain blank until resources are connected. Never run a production `env pull` over `.env.local`.

Production needs `APP_URL=https://<production-domain>`, `AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL`, `STORAGE_BACKEND=vercel-blob`, `BLOB_READ_WRITE_TOKEN`, `DEPLOYMENT_ENVIRONMENT=production`, `NATIVE_INVENTORY_ENABLED=1`, `AI_PROVIDER=openai`, `OPENAI_MODEL=gpt-6-luna`, and `OPENAI_API_KEY`. `NEXTAUTH_SECRET` is optional and must match `AUTH_SECRET` within that environment. Keep local bypasses, debug mode and permissive CORS disabled. OAuth is optional. Secrets remain server-only; never add them under `NEXT_PUBLIC_`.

Preview sets `DEPLOYMENT_ENVIRONMENT=preview` and leaves `APP_URL`, `AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` unset. Origin resolution uses `VERCEL_URL`. Do not bind live email or WhatsApp provider accounts to preview; keep delivery channels disabled. Production URLs must not be copied into preview settings.

Email/password reset requires `RESEND_API_KEY` plus a verified `EMAIL_FROM`; delivery and inbound webhooks use `RESEND_WEBHOOK_SECRET`. WhatsApp needs its access/phone/version/app/verification secrets and an approved template. Enable notification channels in application Settings after real provider delivery tests.

After authenticating the CLI, edit the isolated private env files and sync each scope without printing secret values:

```sh
npx vercel@62.2.0 login
npm run vercel:env:sync -- preview .env.vercel.preview.local
npm run vercel:env:sync -- production .env.vercel.production.local
```

The sync command validates the complete contract, allowlists variables, streams secret values through stdin and marks them sensitive. It removes stale Preview URL aliases. It never changes the local development file. CLI metadata is handled in memory and not printed. New environment values take effect in a **new deployment**.

`npm run env:check` checks local configuration. `build:vercel` validates deployed configuration before Next.js builds; missing keys, local DB/storage bypasses, TLS errors and exposed secret prefixes fail deployment. Framework-injected `VERCEL_*` and `NODE_ENV` values are not manually synced.

## Database release

Migrations never run inside the web build. First make a backup/snapshot and apply the release to the isolated Preview database:

```sh
npm run db:deploy -- --env-file=.env.vercel.preview.local
npm run db:deploy -- --env-file=.env.vercel.production.local
```

The release runner requires `DATABASE_URL_UNPOOLED`, serializes releases with a direct advisory lock and bootstraps only a truly empty public schema. The historical destructive `schema.sql` reset statements are stripped before bootstrap, and the runner rejects partial core schemas. It adds migrations through `020_vercel_storage.sql` and never seeds demo accounts. Existing SQL-backed production files remain readable; new files use Blob. Existing Google Storage files must be copied into the matching private Blob keys before switching a database that contains those references; this code change does not transfer existing remote objects.

For fresh local verification use only an explicit `*_migration_test` database and `ALLOW_LOCAL_DATABASE=1`. Production tests continue to use the isolated local `renkflow_test` database. Do not use `db:push` or demo seeds against production.

## Verification and release

GitHub runs typecheck, lint, unit tests, backend/env guardrails and a production build. Vercel Git integration creates deployment previews; do not regard a passing GitHub workflow alone as a release approval. Review the candidate, confirm `/api/health/ready` is 200, test sign-in, quotation conversion, factory operations, document upload/download (including >4.5 MB), tenant isolation, offline replay and provider webhooks. `/api/health` is only liveness; readiness checks configuration and database connectivity without exposing configuration values.

Files uploaded by the browser go directly to private Blob using a short-lived, path-scoped token issued after session/role/assignment checks. Finalization validates size, content magic and ownership; signed private storage credentials never reach the browser. Download routes check tenant and current membership. Local file storage exists under ignored `.data/files` only for development/testing; Vercel rejects this adapter. New orders fail if their document cannot be attached, rather than silently discarding the document. Finalization expires after 24 hours; the cleanup cron sweeps unreferenced uploads after seven days, checks all document/file tables before deletion, and keeps a durable paginated cursor. Referenced files are retained.

SSE production event streams close before their 60-second function limit; EventSource reconnects with the last event ID. Separate permanently running WebSocket or worker servers are not required for this production flow. Legacy standalone Socket.IO scripts are not part of the Vercel deployment.

Test Production only after resources and envs are configured. Record the prior revision and database snapshot. Rollback switches the application deployment; database migrations are additive and a deployment rollback does not reverse them. Confirm compatibility before promotion. Recipe limits and real factory data must be approved before physical production.

Official references: [Marketplace PostgreSQL](https://vercel.com/docs/marketplace-storage), [private Blob](https://vercel.com/docs/vercel-blob/private-storage), [environment variables](https://vercel.com/docs/environment-variables), [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [function limits](https://vercel.com/docs/functions/limitations).

## Local verification — 2026-10-03

Node.js 22 production build, TypeScript, lint, environment/backend/tenant guardrails and 44 Jest suites (283 tests) passed. The isolated PostgreSQL production integration suite and browser checks covering 31 authenticated pages, mobile worker operations, offline synchronization, procurement, finance, saved views and immediate membership revocation passed. Fresh installation and repeated additive migration preserved the sentinel tenant/user. Production dependency audit reports zero vulnerabilities.

The Mac CLI is authenticated. The project is configured for Node 22, Fluid Compute and Frankfurt Functions. The user selected a Hobby test environment. A new Neon Free database `renkflow-preview` (`store_XcwfmhjJtgfld0Sp`) and private Frankfurt Blob store (`store_c5qDokOXKdpa7IIG`) are connected to Preview only; Preview migrations and scoped environment synchronization completed. Production resources/values, live domain/provider delivery checks and Pro scheduling remain required before a live factory release. Existing production environment values were not changed. Never deploy directly from `apps/web` while the project Root Directory is `apps/web`: deploy from the repository root with `--local-config apps/web/vercel.json`.

## Auth forms under slow connections

The sign-in submit button is disabled until hydration completes. Credential and password forms use POST as their native fallback, so early submission cannot put credentials into query strings. Preview test credentials are generated privately and belong only to the isolated test company.

## Preview regression checks

The final validation gate passed 47 Jest suites (291 tests), typecheck and lint. Metadata-only multipart order requests now resolve owned Blob references, retain files, accept an omitted delivery date and reject malformed lines. UUID upload keys explicitly carry the original MIME type into multipart Blob requests. Upload failures preserve form data and show a retryable error.

## Verified Hobby cloud preview — 2026-10-03

Ready preview: https://renkflowv2-lsm1k0ti0-beshnovski-projects.vercel.app (protected by Vercel Authentication). Cloud readiness is 200; actual sign-in, mobile workspace pages, a 6 MB private multipart PDF upload through the new-order UI, SQL document persistence, byte-identical authenticated streaming download and anonymous denial passed. No server 5xx or uncaught browser exceptions were observed. A synthetic test order/document remains for review. Preview-only test credentials are in ignored `.data/preview-test-account.json`; they are not seeded into Production.
