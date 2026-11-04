import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { sentryDsn } from './sentry-options';

// Closed lists: arbitrary error names/codes can themselves contain personal data.
const ERROR_CLASSES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError', 'PostgresError']);
const POSTGRES_CODES = new Set(['08000', '08001', '08003', '08004', '08006', '08007', '08P01', '22001', '22003', '22007', '22012', '22P02', '23502', '23503', '23505', '23514', '23P01', '25P02', '40001', '40P01', '42501', '42601', '42703', '42P01', '53100', '53200', '53300', '53400', '57014', '57P01', '57P02', '57P03']);

function errorTags(error: unknown): { error_class: string; postgres_code?: string } {
  try {
    if (!(error instanceof Error)) return { error_class: 'Unknown' };
    const name = error.name;
    const errorClass = ERROR_CLASSES.has(name) ? name : 'Error';
    // Read data properties only; never invoke a custom code getter.
    const code: unknown = Object.getOwnPropertyDescriptor(error, 'code')?.value;
    return {
      error_class: errorClass,
      ...(errorClass === 'PostgresError' && typeof code === 'string' && POSTGRES_CODES.has(code) ? { postgres_code: code } : {}),
    };
  } catch {
    return { error_class: 'Unknown' };
  }
}

/** Labels must be source-code constants, never request values or error messages. */
export async function reportServerError(label: string, error: unknown): Promise<void> {
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

    const tags = { label, tenant_id: tenantId, ...errorTags(error) };
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(tags)) scope.setTag(key, value);
      // SDK integrations may enrich the event after capture. Allow only the
      // synthetic exception and our tags; exclude request data and inherited PII.
      scope.addEventProcessor((event) => ({
        event_id: event.event_id,
        timestamp: event.timestamp,
        platform: event.platform,
        environment: event.environment,
        release: event.release,
        sdk: event.sdk,
        level: 'error',
        exception: event.exception,
        fingerprint: ['caught-server-error', label, tags.error_class, tags.postgres_code ?? 'none'],
        tags,
      }));
      // Database errors, causes, custom properties and even stacks can contain
      // customer data. Never pass the original value to the SDK.
      Sentry.captureException(new Error('Caught server error'));
    });
  } catch {
    // Observability is best effort, including when the SDK is unavailable.
  }
}
