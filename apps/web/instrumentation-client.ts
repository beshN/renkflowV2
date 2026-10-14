import * as Sentry from '@sentry/nextjs';

import { sentryDsn, sentryOptions } from '@/lib/observability/sentry-options';

if (sentryDsn()) Sentry.init(sentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
