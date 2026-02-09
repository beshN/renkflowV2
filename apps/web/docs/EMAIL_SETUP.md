# Email Setup Guide

## Provider

RenkFlow uses Resend for transactional email delivery.

## Required environment variables

```env
RESEND_API_KEY=re_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
```

Optional sender settings:

```env
RESEND_INFO_EMAIL=info@yourdomain.com
RESEND_UPDATES_EMAIL=updates@yourdomain.com
RESEND_SUPPORT_EMAIL=support@yourdomain.com
```

## Verification flow expectations

- Registration writes a verification token in `users.verification_token`
- Verification endpoint validates token and marks `users.email_verified`
- Email delivery failure should not roll back successful user creation

## Local test checklist

1. Start app with valid `RESEND_API_KEY`
2. Register a new account
3. Confirm verification email is sent
4. Open verification link and confirm login is enabled

## Production checklist

- Keep `RESEND_API_KEY` in Secret Manager
- Bind secret to Cloud Run with `--set-secrets`
- Verify sender domain is configured in Resend
- Monitor delivery errors in logs and alerting
