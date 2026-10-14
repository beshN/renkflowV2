import * as Sentry from '@sentry/nextjs';

import { sentryDsn, sentryOptions } from '@/lib/observability/sentry-options';

export function register() {
  if (!sentryDsn()) return;
  // One init per runtime; the SDK picks the Node or Edge integrations itself.
  Sentry.init(sentryOptions());
}

// Server-side errors from route handlers, server components and server actions.
export const onRequestError = Sentry.captureRequestError;
