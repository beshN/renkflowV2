# RenkFlow Launch Mode Runbook

## Overview

RenkFlow uses a **launch gate** mechanism controlled by the `PUBLIC_SITE_MODE` environment variable. This document covers operational procedures for managing the coming-soon mode.

---

## Environment Variable

| Variable | Values | Description |
|----------|--------|-------------|
| `PUBLIC_SITE_MODE` | `coming-soon` | Blocks all routes except `/`, `/coming-soon`, `/api/subscribe`, and static assets |
| `PUBLIC_SITE_MODE` | `off` | Full site access (production mode) |

---

## Quick Commands

### Check Current Mode

**Vercel:**
```bash
npx vercel env ls --token $VERCEL_TOKEN
```

**Cloud Run:**
```bash
gcloud run services describe renkflow-web --region europe-west3 --format='value(spec.template.spec.containers[0].env)'
```

### Enable Coming-Soon Mode

**Vercel:**
```bash
export VERCEL_TOKEN="your-token"
export PUBLIC_SITE_MODE="coming-soon"
./apps/web/scripts/vercel-prod-launch-deploy.sh
```

**Cloud Run (manual):**
```bash
gcloud run services update renkflow-web \
  --region europe-west3 \
  --set-env-vars "PUBLIC_SITE_MODE=coming-soon"
```

### Disable Coming-Soon Mode (Full Launch)

**Vercel:**
```bash
export VERCEL_TOKEN="your-token"
export PUBLIC_SITE_MODE="off"
./apps/web/scripts/vercel-prod-launch-deploy.sh
```

**Cloud Run (manual):**
```bash
gcloud run services update renkflow-web \
  --region europe-west3 \
  --set-env-vars "PUBLIC_SITE_MODE=off"
```

---

## Smoke Tests

### Run Smoke Tests

```bash
# Against production
./apps/web/scripts/smoke-coming-soon.sh https://renkflow.com

# Against staging/Cloud Run
./apps/web/scripts/smoke-coming-soon.sh https://renkflow-web-xxxxx.a.run.app

# Verbose mode
./apps/web/scripts/smoke-coming-soon.sh https://renkflow.com --verbose
```

### What Smoke Tests Check

| Category | Tests |
|----------|-------|
| Core Routes | `GET /` → 200, `HEAD /` → 200, `GET /coming-soon` → 200 |
| Redirects | `/dashboard`, `/pricing`, `/orders`, `/settings` → 302 to `/coming-soon` |
| API Security | `/api/auth/*`, `/api/orders` → 404 |
| Subscribe API | `OPTIONS` → 204, `POST` → 400/200, `DELETE/PUT` → 404 |
| Static Assets | `/favicon.ico`, `/robots.txt`, `/sitemap.xml` → 200 |
| SEO | robots.txt allows `/coming-soon`, disallows `/dashboard` |

---

## Rollback Procedures

### Vercel Rollback

```bash
# List recent deployments
npx vercel ls --token $VERCEL_TOKEN

# Rollback to previous deployment
npx vercel rollback --token $VERCEL_TOKEN

# Or promote a specific deployment
npx vercel promote <deployment-url> --token $VERCEL_TOKEN
```

### Cloud Run Rollback

```bash
# List revisions
gcloud run revisions list --service renkflow-web --region europe-west3

# Rollback to previous revision
gcloud run services update-traffic renkflow-web \
  --region europe-west3 \
  --to-revisions=<previous-revision>=100
```

---

## Common Issues & Solutions

### Issue: Site shows full content instead of coming-soon

**Cause:** `PUBLIC_SITE_MODE` is not set or set to `off`

**Solution:**
1. Check env variable: `npx vercel env ls` or check Cloud Run config
2. Set to `coming-soon` and redeploy
3. Run smoke tests to verify

### Issue: `/api/subscribe` returns 404

**Cause:** API route not deployed or middleware misconfigured

**Solution:**
1. Check that `apps/web/app/api/subscribe/route.ts` exists
2. Verify middleware is not blocking the route
3. Check `comingSoonGate.ts` logic

### Issue: Smoke tests fail with "Connection failed"

**Cause:** Service not ready or DNS not propagated

**Solution:**
1. Wait 30-60 seconds after deployment
2. Check service health: `curl -I https://renkflow.com`
3. Verify DNS: `dig renkflow.com`

### Issue: `PUBLIC_SITE_MODE` has newline/whitespace

**Cause:** Copy-paste error or env file encoding issue

**Solution:**
1. Use the deploy script which sanitizes the value
2. Or manually: `echo -n "coming-soon" | vercel env add PUBLIC_SITE_MODE production`

### Issue: robots.txt or sitemap.xml incorrect

**Cause:** Dynamic generation based on `PUBLIC_SITE_MODE`

**Solution:**
1. Verify `apps/web/app/robots.ts` and `apps/web/app/sitemap.ts`
2. Clear CDN cache if applicable
3. Redeploy

---

## Pre-Launch Checklist

- [ ] `PUBLIC_SITE_MODE=coming-soon` set in all environments
- [ ] Smoke tests pass on staging
- [ ] Smoke tests pass on production
- [ ] `/api/subscribe` accepts POST requests
- [ ] Email notifications working (test with real email)
- [ ] robots.txt blocks private routes
- [ ] sitemap.xml only includes public routes
- [ ] SSL certificate valid
- [ ] DNS configured correctly

## Full Launch Checklist

- [ ] All features tested and approved
- [ ] Database migrations complete
- [ ] Set `PUBLIC_SITE_MODE=off`
- [ ] Deploy to production
- [ ] Verify all routes accessible
- [ ] Update robots.txt to allow all routes
- [ ] Submit new sitemap to search engines
- [ ] Monitor error rates for 24 hours

---

## Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | TBD |
| Platform Team | TBD |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2024-01-XX | Platform Team | Initial runbook |
