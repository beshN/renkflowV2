# RenkFlow Launch Runbook

RenkFlow runs on **Vercel** (project `renkflowv2`, team `beshnovski-projects`, region `fra1`).
Production domains: `renkflow.com` (primary), `www.renkflow.com` (308 → apex), `panel.renkflow.com`.
Pushing to `main` deploys to production through the Vercel Git integration.

## Site mode

| `PUBLIC_SITE_MODE` | Behavior |
|---|---|
| `off` (or unset) | Full site. This is the launch setting. |
| `coming-soon` | Teaser mode. Only `/`, `/coming-soon`, `/auth/login`, `/api/auth/*`, `/api/subscribe` and static assets stay reachable. |

Change it in Vercel → Project → Settings → Environment Variables (Production), then redeploy:

```bash
vercel env rm PUBLIC_SITE_MODE production
vercel env add PUBLIC_SITE_MODE production   # enter: off  (or coming-soon)
vercel --prod
```

Environment variable changes only apply to new deployments.

## Before launch

- [ ] `npm run validate` is green on `main` (CI does this on every push).
- [ ] Latest production deployment is `READY` in Vercel and points at the expected commit.
- [ ] Resend: `renkflow.com` is verified at https://resend.com/domains (SPF, DKIM, return-path DNS records). Without it, verification, password-reset and invite emails fail with `403 domain is not verified`.
- [ ] Company details in `apps/web/lib/core/company.ts` are filled in (legal name and address feed the KVKK notice on `/privacy`).
- [ ] Optional: `NEXT_PUBLIC_GA_MEASUREMENT_ID` set in Production if analytics is wanted. It only loads after the visitor accepts analytics cookies.
- [ ] Database migrations are applied separately with `npm run db:deploy` (they never run during the build).

## Smoke tests

```bash
./apps/web/scripts/smoke-live.sh https://renkflow.com
```

Coming-soon mode:

```bash
./apps/web/scripts/smoke-coming-soon.sh https://renkflow.com
```

| Category | Expectation |
|---|---|
| Root | `GET /` and `HEAD /` return `200` |
| Auth surface | `/auth/login` and `/api/auth/session` reachable |
| Protected routes | `/dashboard` redirects to `/auth/login` (live) or `/coming-soon` (teaser) |
| Public routes | `/features`, `/pricing`, `/blog` return `200` |
| SEO | `/robots.txt` and `/sitemap.xml` return `200` |

Then by hand: sign in, open the dashboard, create and delete a test record, request a password reset and confirm the email arrives.

## Rollback

Vercel → Project → Deployments → pick the last good production deployment → **Instant Rollback**, or:

```bash
vercel rollback <deployment-url-or-id>
```

A rollback only switches the application. Database migrations are additive and are not reversed; confirm the older build is compatible with the current schema first.

## Common issues

### Site still shows coming-soon
1. Confirm `PUBLIC_SITE_MODE` is `off` or absent for Production.
2. Redeploy (env changes need a new deployment).
3. Run `smoke-live.sh`.

### `/api/auth/session` fails or every page returns 500
1. The proxy refuses to run in production without `AUTH_SECRET` / `NEXTAUTH_SECRET`; check they are set.
2. Check `NEXTAUTH_URL` / `APP_URL` match `https://renkflow.com`.
3. Read runtime logs: Vercel → Project → Logs, filter `level:error`.

### Emails are not delivered
1. Check the Resend dashboard for the domain status and the failed message.
2. `RESEND_API_KEY` and `EMAIL_FROM` must be set for Production.

## After launch

- [ ] Watch Vercel runtime errors and logs for 30 minutes.
- [ ] Submit `https://renkflow.com/sitemap.xml` in Google Search Console.
