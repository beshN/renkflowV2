# RenkFlow Launch Mode Runbook

## Overview

RenkFlow launch gate is controlled by `PUBLIC_SITE_MODE` and runs on **Cloud Run only**.

## Environment Contract

| Variable | Value | Behavior |
|---|---|---|
| `PUBLIC_SITE_MODE` | `off` | Default production mode. Full site access. |
| `PUBLIC_SITE_MODE` | `coming-soon` | Teaser mode. Keeps `/`, `/coming-soon`, `/auth/login`, `/api/auth/*`, `/api/subscribe`, static assets reachable. |

## Quick Commands

### Read current mode

```bash
gcloud run services describe renkflow-web \
  --region europe-west3 \
  --format='value(spec.template.spec.containers[0].env)'
```

### Enable coming-soon mode

```bash
gcloud run services update renkflow-web \
  --region europe-west3 \
  --set-env-vars "PUBLIC_SITE_MODE=coming-soon"
```

### Disable coming-soon mode (full launch)

```bash
gcloud run services update renkflow-web \
  --region europe-west3 \
  --set-env-vars "PUBLIC_SITE_MODE=off"
```

## Smoke Tests

### Live mode (`PUBLIC_SITE_MODE=off`)

```bash
./apps/web/scripts/smoke-live.sh https://renkflow.com
```

### Coming-soon mode (`PUBLIC_SITE_MODE=coming-soon`)

```bash
./apps/web/scripts/smoke-coming-soon.sh https://renkflow.com
```

### Coverage summary

| Category | Expectation |
|---|---|
| Root | `GET /` and `HEAD /` return `200` |
| Auth surface | `/auth/login` and `/api/auth/session` reachable |
| Protected routes | `/dashboard` redirects to `/auth/login` (live) or `/coming-soon` (launch) |
| Public routes | `/features`, `/pricing`, `/blog` return `200` in live mode |
| SEO | `/robots.txt` and `/sitemap.xml` return `200` |

## Rollback

```bash
gcloud run revisions list --service renkflow-web --region europe-west3

gcloud run services update-traffic renkflow-web \
  --region europe-west3 \
  --to-revisions=<previous-revision>=100
```

## Common Issues

### Site still shows coming-soon

1. Confirm Cloud Run has `PUBLIC_SITE_MODE=off`.
2. Redeploy latest revision.
3. Run `smoke-live.sh`.

### `/api/auth/session` fails

1. Check proxy route policy (`apps/web/proxy.ts`).
2. Confirm `AUTH_SECRET` and `NEXTAUTH_SECRET` are set and equal.
3. Validate NextAuth route health: `/api/auth/[...nextauth]`.

### Smoke tests fail right after deploy

1. Wait 30-60 seconds for revision warmup.
2. Retry smoke.
3. Check Cloud Run logs for startup/config errors.

## Pre-Launch Checklist

- [ ] `PUBLIC_SITE_MODE=coming-soon` confirmed when campaign mode is intended.
- [ ] `smoke-coming-soon.sh` green.
- [ ] `DATABASE_URL` bound from Secret Manager.
- [ ] `STORAGE_BACKEND=gcs` and `GCS_BUCKET_NAME` set.

## Full Launch Checklist

- [ ] `PUBLIC_SITE_MODE=off`.
- [ ] `smoke-live.sh` green.
- [ ] Login and `/api/auth/session` verified.
- [ ] Protected route redirect behavior verified.
- [ ] 30 minute post-release monitoring completed.
