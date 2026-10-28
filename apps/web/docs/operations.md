# Operations automation

Scheduled jobs that keep production running on the Vercel Hobby plan, and how they authenticate. Deployment itself is in [vercel-deployment.md](vercel-deployment.md); backup/restore is in [docs/runbooks/backup-restore.md](../../../docs/runbooks/backup-restore.md).

## GitHub Actions secrets and variables

**None are required.** `cron.yml` authenticates with a short-lived GitHub Actions OIDC token instead of a shared secret (see below), so nothing has to be copied from Vercel into GitHub and nothing breaks when `CRON_SECRET` is rotated in Vercel.

Optional settings in GitHub → repository `beshN/renkflowV2` → **Settings → Secrets and variables → Actions**:

| Name | Kind | Used by | Value |
|---|---|---|---|
| `APP_URL` | **Variable** (not a secret) | `cron.yml` | Base URL to call. Defaults to `https://renkflow.com`; set it only if Production moves. Must be the Production deployment: the cron routes answer 403 on Preview. |
| `CRON_SECRET` | Secret | `cron.yml` | Legacy fallback. If present, it is sent instead of the OIDC token and must equal the Vercel **Production** `CRON_SECRET` (at least 32 characters). Leave it unset to use OIDC. |

The repository is public: workflow logs and artifacts are visible to any signed-in GitHub user. The workflows therefore print only HTTP status codes. For the same reason there is no backup workflow here: a database dump, even encrypted, must not be stored where any GitHub user can download it. The daily dump runs as a Vercel cron and goes to the app's private Blob store instead (below).

## Workflows

### `.github/workflows/cron.yml` — background queues

Every 10 minutes (and on demand via **Actions → Background queues → Run workflow**, optionally for a single queue) it calls, on `ubuntu-latest`:

- `GET /api/cron/notifications` — sends up to 5 queued email/WhatsApp notifications,
- `GET /api/cron/inbound` — processes 1 inbound email/WhatsApp message into an intake draft,
- `GET /api/cron/e-invoices` — sends queued e-Belge invoices and polls sent ones (no-op while `E_INVOICE_PROVIDER` is unset),

with `Authorization: Bearer <GitHub OIDC token>` (or `Bearer $CRON_SECRET` when that legacy secret exists). Each call has a 10 s connect / 290 s total timeout and two retries; any non-2xx response fails the run, so GitHub's failed-workflow email doubles as the alert. Queue workers lease their rows (`FOR UPDATE SKIP LOCKED`), so a delayed or overlapping run is safe.

#### How the OIDC authentication works

The job has `permissions: id-token: write`, and before each queue call it asks the runner (`ACTIONS_ID_TOKEN_REQUEST_URL`) for a fresh JWT with audience `renkflow-cron`. The token is masked in the log and passed to curl through a `0600` header file. On the server, `cronAuthorized` in `lib/features/manufacturing/cron.ts` still accepts `Bearer $CRON_SECRET` (Vercel Cron), and for **these three routes only** (`notifications`, `inbound`, `e-invoices`; not `fx` or `storage-cleanup`) it also accepts a token that `lib/security/github-oidc.ts` verifies as follows — all conditions must hold:

- RS256 signature by a key from `https://token.actions.githubusercontent.com/.well-known/jwks` (cached in memory for 1 hour; an unknown `kid` refetches the key set, at most once a minute, to follow key rotation; if GitHub is unreachable the request is rejected),
- `iss` = `https://token.actions.githubusercontent.com`, `aud` = `renkflow-cron`,
- `exp`, `iat` and `nbf` valid with 60 s clock skew,
- `repository` = `beshN/renkflowV2` (override with the server env var `CRON_OIDC_REPOSITORY`, e.g. for a fork),
- `ref` = `refs/heads/main`,
- `workflow_ref` (and `job_workflow_ref`, when present) exactly `beshN/renkflowV2/.github/workflows/cron.yml@refs/heads/main`,
- `event_name` = `schedule` or `workflow_dispatch`.

So only this workflow file, running from `main` on a schedule or a manual dispatch, can trigger the queues: pull requests (including from forks), other branches, other workflows and other repositories get 401. Anyone with write access to `main` could already change the workflow, so this grants nothing beyond what repository write access implies. The Production-only rule (`VERCEL_ENV`) still applies on top.

Throughput: about 5 notifications and 1 inbound message per 10 minutes. GitHub may delay or skip scheduled runs at busy times, and disables schedules in a repository with no activity for 60 days (re-enable under Actions). If the backlog grows, move to Vercel Pro and deploy with `vercel.pro.json` (minute-level crons); the GitHub workflow can then be disabled.

### Vercel daily crons (fallback)

`apps/web/vercel.json` now schedules six once-a-day crons, which Hobby allows (once per day per job; Vercel may fire anywhere within the stated hour): `fx` (13:45 UTC weekdays), `storage-cleanup` (00:00), `backup` (01:30), and as a fallback for the queues above `notifications` (05:00), `inbound` (05:20), `e-invoices` (05:40 UTC). They run only on the Production deployment.

### `/api/cron/backup` — daily logical database backup

Same auth (`Authorization: Bearer $CRON_SECRET`) and preview guard as the other cron routes; `maxDuration` 300 s. Logic in `lib/db/backup.server.ts`, manifest format in `lib/db/backup-manifest.ts`.

- Exports every table in `public` (views excluded, `schema_migrations` included) from one `REPEATABLE READ READ ONLY` snapshot with `COPY … TO STDOUT (FORMAT csv, HEADER true)`, gzips each table, encrypts it when `BACKUP_ENCRYPTION_KEY` is set (below) and uploads it to the private Blob store as `backups/<YYYY-MM-DD>/<table>.csv.gz.enc` (unencrypted: `.csv.gz`), then `manifest.json` (version 2: tables, columns, row counts, byte sizes, migration list, free-standing sequence values, start/finish time, `VERCEL_GIT_COMMIT_SHA`, `complete`, `encryption`). Generated columns are left out (PostgreSQL recomputes them). Empty tables get no file.
- Encryption (`lib/db/backup-crypto.ts`): the dump contains every table, including password hashes, sign-in/link token hashes and sealed MFA secrets, so it is encrypted in the application, independently of Blob's own storage encryption and of `BLOB_READ_WRITE_TOKEN`. AES-256-GCM per file with a random 12-byte IV; file layout `RFBK` · version 1 · key id (4 bytes) · IV · ciphertext · 16-byte auth tag (the tag is last because the file is streamed). The header and the file's storage key are authenticated, so a file cannot be swapped for another table's or day's. `manifest.json` stays readable, holds no row data and records `encryption: { alg: "aes-256-gcm", keyId, format: "RFBK1" }`, where `keyId` = first 8 hex characters of `sha256(key)`; without the key it is `encryption: null` and the cron logs a warning.
  - Generate the key once: `openssl rand -base64 32`. Store it as the Production-only Vercel env var `BACKUP_ENCRYPTION_KEY` (sensitive; `vercel:env:sync` marks it so). A malformed key fails `env:check` and the backup run instead of silently writing unencrypted files; a missing one is a warning only.
  - Keep a **second copy offline** (company password manager vault that is not tied to Vercel/GitHub accounts, or a printed copy in a sealed envelope in the office safe), labelled with its key id. Restoring a backup needs the key that wrote it.
  - **If the key is lost**, every backup encrypted with it is unrecoverable: nothing (including support) can decrypt it. Generate a new key immediately so the next nightly backup is restorable again, and rely on Neon PITR / backup branches meanwhile.
  - Rotation: set the new key; new backups carry the new key id. Keep the old key (offline) for 14 days, until the last backup it wrote has been pruned.
- Memory: a table file up to 8 MB is sent in one Blob put; a larger one is streamed as a multipart upload while COPY → gzip → encryption runs, so no table is held in memory in full.
- Time budget: no new table after 240 s, the table in flight is aborted at 270 s; the manifest is then written with `complete: false` and the route answers 500. A same-day re-run is a no-op when the day's backup is complete and replaces a partial one; an advisory lock stops overlapping runs.
- Retention: after a complete backup, folders older than 14 days are deleted (`listFiles`/`deleteFile` in `lib/storage`).
- Limits: watch `bytes` in the manifest and `seconds` in the response; the 240/270 s time budget, not memory, is the limit now. Blob put/list count as advanced operations on Hobby: one put per non-empty table (a multipart upload of a file over 8 MB costs a few more) plus the manifest and one or two lists per day.
- Restore: `npm run db:restore-backup -- --date <YYYY-MM-DD> --target <url> [--key-file=<file>]` into a Neon branch prepared with `db:deploy` (runbook section C). An encrypted backup needs `BACKUP_ENCRYPTION_KEY` (shell or `--env-file`) or `--key-file` (the offline copy, same base64 text); a key whose id differs from the manifest's is refused before the target is touched, and a file that fails GCM authentication rolls the whole restore back. Tested end to end (unencrypted and encrypted, wrong key, tampered file) by `npm run test:integration -- backup-restore`.

### `.github/dependabot.yml` and the audit job

Dependabot opens weekly (Monday 06:00 Istanbul) grouped minor/patch PRs for `apps/web` npm, root npm and GitHub Actions; majors come as separate PRs. Security updates are always opened.

The `audit` job in `validate.yml` runs `npm audit --omit=dev --audit-level=high` on `apps/web/package-lock.json`. It is `continue-on-error`, so it reports advisories without blocking merges; check its log after dependency changes.

## Runner note

The web validation jobs run on the self-hosted Mac; these three workflows run on GitHub-hosted `ubuntu-latest` so they never queue behind a long validation run. GitHub-hosted minutes are free for public repositories. If hosted runners become unavailable for the account (e.g. the repository goes private and exceeds its minutes — every 10 minutes is ~4,300 billed minutes a month), switch `runs-on` to `[self-hosted, macOS]` and make sure the Mac has `curl`, `gpg` and a PostgreSQL 17 `pg_dump`.
