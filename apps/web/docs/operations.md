# Operations automation

Scheduled jobs that keep production running on the Vercel Hobby plan, and the secrets they need. Deployment itself is in [vercel-deployment.md](vercel-deployment.md); backup/restore is in [docs/runbooks/backup-restore.md](../../../docs/runbooks/backup-restore.md).

## GitHub Actions secrets

Set them in GitHub → repository `beshN/renkflowV2` → **Settings → Secrets and variables → Actions → New repository secret** (or `gh secret set NAME`, which reads the value from stdin and keeps it out of shell history). Until a workflow's secrets exist, it finishes green with a notice saying it was skipped.

| Secret | Used by | Value |
|---|---|---|
| `CRON_SECRET` | `cron.yml` | Exactly the `CRON_SECRET` of the Vercel **Production** environment (at least 32 characters). If it is rotated in Vercel, update it here too, otherwise every run fails with 401. |
| `APP_URL` | `cron.yml` | Production base URL, `https://renkflow.com` (no trailing slash needed). Must be the Production deployment: the cron routes answer 403 on Preview. |

The repository is public: workflow logs and artifacts are visible to any signed-in GitHub user. The workflows therefore print only HTTP status codes. For the same reason there is no backup workflow here: a database dump, even encrypted, must not be stored where any GitHub user can download it. The daily dump runs as a Vercel cron and goes to the app's private Blob store instead (below).

## Workflows

### `.github/workflows/cron.yml` — background queues

Every 10 minutes (and on demand via **Actions → Background queues → Run workflow**, optionally for a single queue) it calls, on `ubuntu-latest`:

- `GET /api/cron/notifications` — sends up to 5 queued email/WhatsApp notifications,
- `GET /api/cron/inbound` — processes 1 inbound email/WhatsApp message into an intake draft,
- `GET /api/cron/e-invoices` — sends queued e-Belge invoices and polls sent ones (no-op while `E_INVOICE_PROVIDER` is unset),

with `Authorization: Bearer $CRON_SECRET`, the same header Vercel Cron sends (checked in `lib/features/manufacturing/cron.ts`). Each call has a 10 s connect / 290 s total timeout and two retries; any non-2xx response fails the run, so GitHub's failed-workflow email doubles as the alert. Queue workers lease their rows (`FOR UPDATE SKIP LOCKED`), so a delayed or overlapping run is safe.

Throughput: about 5 notifications and 1 inbound message per 10 minutes. GitHub may delay or skip scheduled runs at busy times, and disables schedules in a repository with no activity for 60 days (re-enable under Actions). If the backlog grows, move to Vercel Pro and deploy with `vercel.pro.json` (minute-level crons); the GitHub workflow can then be disabled.

### Vercel daily crons (fallback)

`apps/web/vercel.json` now schedules six once-a-day crons, which Hobby allows (once per day per job; Vercel may fire anywhere within the stated hour): `fx` (13:45 UTC weekdays), `storage-cleanup` (00:00), `backup` (01:30), and as a fallback for the queues above `notifications` (05:00), `inbound` (05:20), `e-invoices` (05:40 UTC). They run only on the Production deployment.

### `/api/cron/backup` — daily logical database backup

Same auth (`Authorization: Bearer $CRON_SECRET`) and preview guard as the other cron routes; `maxDuration` 300 s. Logic in `lib/db/backup.server.ts`, manifest format in `lib/db/backup-manifest.ts`.

- Exports every table in `public` (views excluded, `schema_migrations` included) from one `REPEATABLE READ READ ONLY` snapshot with `COPY … TO STDOUT (FORMAT csv, HEADER true)`, gzips each table and uploads it to the private Blob store as `backups/<YYYY-MM-DD>/<table>.csv.gz`, then `manifest.json` (tables, columns, row counts, byte sizes, migration list, free-standing sequence values, start/finish time, `VERCEL_GIT_COMMIT_SHA`, `complete`). Generated columns are left out (PostgreSQL recomputes them). Empty tables get no file.
- Time budget: no new table after 240 s, the table in flight is aborted at 270 s; the manifest is then written with `complete: false` and the route answers 500. A same-day re-run is a no-op when the day's backup is complete and replaces a partial one; an advisory lock stops overlapping runs.
- Retention: after a complete backup, folders older than 14 days are deleted (`listFiles`/`deleteFile` in `lib/storage`).
- Limits: each table is gzipped in memory before upload (fine for the current 16 MB database; watch `bytes` in the manifest and `seconds` in the response). Blob put/list count as advanced operations on Hobby: one put per non-empty table plus the manifest and one or two lists per day.
- Restore: `npm run db:restore-backup -- --date <YYYY-MM-DD> --target <url>` into a Neon branch prepared with `db:deploy` (runbook section C). Tested end to end by `npm run test:integration -- backup-restore`.

### `.github/dependabot.yml` and the audit job

Dependabot opens weekly (Monday 06:00 Istanbul) grouped minor/patch PRs for `apps/web` npm, root npm and GitHub Actions; majors come as separate PRs. Security updates are always opened.

The `audit` job in `validate.yml` runs `npm audit --omit=dev --audit-level=high` on `apps/web/package-lock.json`. It is `continue-on-error`, so it reports advisories without blocking merges; check its log after dependency changes.

## Runner note

The web validation jobs run on the self-hosted Mac; these three workflows run on GitHub-hosted `ubuntu-latest` so they never queue behind a long validation run. GitHub-hosted minutes are free for public repositories. If hosted runners become unavailable for the account (e.g. the repository goes private and exceeds its minutes — every 10 minutes is ~4,300 billed minutes a month), switch `runs-on` to `[self-hosted, macOS]` and make sure the Mac has `curl`, `gpg` and a PostgreSQL 17 `pg_dump`.
