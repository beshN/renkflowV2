# Operations automation

Scheduled jobs that keep production running on the Vercel Hobby plan, and how they authenticate. Deployment itself is in [vercel-deployment.md](vercel-deployment.md); backup/restore is in [docs/runbooks/backup-restore.md](../../../docs/runbooks/backup-restore.md).

## GitHub Actions secrets and variables

**None are required.** `cron.yml` authenticates with a short-lived GitHub Actions OIDC token instead of a shared secret (see below), so nothing has to be copied from Vercel into GitHub and nothing breaks when `CRON_SECRET` is rotated in Vercel.

Optional settings in GitHub → repository `beshN/renkflowV2` → **Settings → Secrets and variables → Actions**:

| Name | Kind | Used by | Value |
|---|---|---|---|
| `APP_URL` | **Variable** (not a secret) | `cron.yml` | Base URL to call. Defaults to `https://renkflow.com`; set it only if Production moves. Must be the Production deployment: the cron routes answer 403 on Preview. |
| `CRON_SECRET` | Secret | `cron.yml` | Legacy fallback. If present, it is sent instead of the OIDC token and must equal the Vercel **Production** `CRON_SECRET` (at least 32 characters). Leave it unset to use OIDC. |

The repository is public: workflow logs and artifacts are visible to any signed-in GitHub user. The workflows therefore print only HTTP status codes. For the same reason there is no backup workflow here: a database dump, even encrypted, must not be stored where any GitHub user can download it (see the runbook's open items).

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

`apps/web/vercel.json` now schedules five once-a-day crons, which Hobby allows (once per day per job; Vercel may fire anywhere within the stated hour): `fx` (13:45 UTC weekdays), `storage-cleanup` (00:00), and as a fallback for the queues above `notifications` (05:00), `inbound` (05:20), `e-invoices` (05:40 UTC). They run only on the Production deployment.

### `.github/dependabot.yml` and the audit job

Dependabot opens weekly (Monday 06:00 Istanbul) grouped minor/patch PRs for `apps/web` npm, root npm and GitHub Actions; majors come as separate PRs. Security updates are always opened.

The `audit` job in `validate.yml` runs `npm audit --omit=dev --audit-level=high` on `apps/web/package-lock.json`. It is `continue-on-error`, so it reports advisories without blocking merges; check its log after dependency changes.

## Runner note

The web validation jobs run on the self-hosted Mac; these three workflows run on GitHub-hosted `ubuntu-latest` so they never queue behind a long validation run. GitHub-hosted minutes are free for public repositories. If hosted runners become unavailable for the account (e.g. the repository goes private and exceeds its minutes — every 10 minutes is ~4,300 billed minutes a month), switch `runs-on` to `[self-hosted, macOS]` and make sure the Mac has `curl`, `gpg` and a PostgreSQL 17 `pg_dump`.
