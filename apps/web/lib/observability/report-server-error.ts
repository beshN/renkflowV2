import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { sentryDsn } from './sentry-options';

/** Labels must be source-code constants, never request values or error messages. */
export async function reportServerError(label: string, _error: unknown): Promise<void> {
  if (!sentryDsn()) return;

  // Reporting must never replace an API's original response with another failure.
  try {
    let tenantId = 'unknown';
    try {
      const { auth } = await import('@/auth');
      const session = await auth();
      tenantId = session?.user?.tenantId || 'unknown';
    } catch {
      // Public routes and broken sessions may have no authenticated tenant.
    }

    Sentry.withScope((scope) => {
      scope.setTag('label', label);
      scope.setTag('tenant_id', tenantId);
      // SDK integrations may enrich the event after capture. Allow only the
      // synthetic exception and our tags; exclude request data and inherited PII.
      scope.addEventProcessor((event) => ({
        event_id: event.event_id,
        timestamp: event.timestamp,
        platform: event.platform,
        level: 'error',
        exception: event.exception,
        fingerprint: ['caught-server-error', label],
        tags: { label, tenant_id: tenantId },
      }));
      // Database errors, causes, custom properties and even stacks can contain
      // customer data. Never pass the original value to the SDK.
      Sentry.captureException(new Error('Caught server error'));
    });
  } catch {
    // Observability is best effort, including when the SDK is unavailable.
  }
}
