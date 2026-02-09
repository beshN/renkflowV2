# RenkFlow Backend GCP Audit - 2026-02-08

## Scope

This audit covers backend runtime, database, authentication, storage, deployment scripts, CI guardrails, and environment contracts for `apps/web`.

## Findings (file + reason + risk)

1. `apps/web/lib/db/index.ts`
- Reason: Legacy DB naming survived after Cloud SQL migration.
- Risk: Engineers may reintroduce legacy drivers by following stale imports.
- Status: Removed; imports migrated to `@/lib/db`.

2. `apps/web/lib/features/orders/postgres/order.postgres.ts`
- Reason: Legacy service naming and path.
- Risk: Cloud SQL-only architecture intent was unclear.
- Status: Moved to `apps/web/lib/features/orders/postgres/order.postgres.ts` and renamed to `PostgresOrderService`.

3. `apps/web/lib/storage/r2.ts`
- Reason: Mixed storage implementation with fallback behavior.
- Risk: Runtime could drift to non-GCS paths.
- Status: Replaced with GCS-only adapter at `apps/web/lib/storage/gcs.ts`.

4. `apps/web/.env.example`
- Reason: Included legacy DB/storage/auth providers.
- Risk: Wrong local setup, wrong secret mapping, deployment mistakes.
- Status: Rewritten for Cloud SQL + GCS + Auth.js baseline.

5. `apps/web/scripts/gcp-full-migrate.sh`
- Reason: Included legacy storage migration path.
- Risk: Operational script could trigger outdated migration dependencies.
- Status: Legacy storage migration section removed.

6. `apps/web/next.config.js`
- Reason: Included legacy storage host entries in image allowlist.
- Risk: Policy drift vs Cloud Storage-only direction.
- Status: Legacy storage host patterns removed.

7. Legacy scripts in `apps/web/scripts`
- Reason: Environment and upload helpers were tied to old storage backend.
- Risk: Accidental operational use in production workflows.
- Status: Removed (`check-r2.js`, `setup-r2.js`, `test-upload.js`, `upload-logo.js`, `check-env.js`, `migrate-r2-to-gcs.ts`).

## process.env Inventory

- `process.env.*` usages detected: 89 unique keys
- `.env.example` keys defined: 30

### Used in code but absent in `.env.example` (selected)

`API_CORS_ALLOWED_ORIGIN`, `API_CORS_ALLOW_ALL`, `AUTH_DEBUG`, `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`, `INTERNAL_API_SECRET`, `LOG_LEVEL`, `NEXT_PUBLIC_USE_DATABASE`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_SUPPORT_SOCKET_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `RESEND_FROM_EMAIL`, `S3_BUCKET`, `VAPID_PUBLIC_KEY`.

Notes:
- Some entries are test/dev/debug only (`FOO_*`, `HELLO`, `DEBUG`, `NODE_DEBUG`, etc.).
- Runtime-relevant keys should be gradually documented in `.env.example` or moved behind feature-specific docs.

### Present in `.env.example` but not used in runtime code

`NEXT_PUBLIC_APP_VERSION`, `SENTRY_AUTH_TOKEN`

## GCP Secret Manager Inventory

Secrets currently present:
- `AUTH_SECRET`
- `DATABASE_URL`
- `DB_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GROQ_API_KEY`
- `NEXTAUTH_SECRET`
- `RESEND_API_KEY`
- `VAPID_PRIVATE_KEY`
- `renkflowv2-github-oauthtoken-85e305`

### Used by application runtime

`AUTH_SECRET`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`

### Not referenced by runtime code (safe-phaseout candidates)

`GROQ_API_KEY`, `renkflowv2-github-oauthtoken-85e305`

Operational exception:
- `DB_PASSWORD` is required by migration/provisioning script flow and is intentionally retained.

## Cloud Run / Cloud SQL Baseline

- `STORAGE_BACKEND=gcs`
- `GCS_BUCKET_NAME` set
- `DATABASE_URL` bound from Secret Manager
- Cloud SQL instance: `dauntless-host-486823-j3:europe-west3:renkflow-db-prod` (RUNNABLE)

## Guardrails Added

- New guard script in `apps/web/scripts/guardrails/` for legacy backend pattern blocking.
- Validation chain now includes backend legacy-pattern guard before lint/build.
- Deploy workflow runs guardrail before build/deploy.

## Verification Results

- Static scan passed:
  - Legacy DB/storage pattern scan across `apps/web` and `.github`
  - Result: no matches.
- Local quality gate passed:
  - `npm --prefix apps/web run validate`
  - Type check, lint, test, and production build all succeeded.
- Smoke test passed:
  - `bash apps/web/scripts/smoke-coming-soon.sh https://renkflow-web-r7mdgubfjq-ey.a.run.app`
  - Result: `23/23` checks passed.
- Cloud Run env verified:
  - `DATABASE_URL` is Secret Manager bound (`DATABASE_URL:latest`).
  - `STORAGE_BACKEND=gcs` and `GCS_BUCKET_NAME` are set.
  - No legacy backend env keys found.
- Database URL policy tests passed:
  - Production URL with legacy DB host fails fast.
  - Production localhost TCP URL without socket fails fast.
  - Production localhost URL with `host=/cloudsql/...` passes.
- Cloud SQL table check:
  - Present: `users`, `tenants`, `tenant_members`, `invitations`, `orders`, `payments`, `journal_entries`, `journal_entry_lines`, `accounts`.
  - Note: `chart_of_accounts` table name is not present; current schema uses `accounts`.
- GCS access check passed:
  - Runtime bucket listing succeeds for `gs://renkflowv2-storage-dauntless-host-486823-j3`.

## Safe Phaseout Plan

1. Keep runtime references removed first (completed).
2. Keep unused secrets documented and detached from runtime (completed).
3. Execute controlled secret deletion in a dedicated change window with rollback checklist.
