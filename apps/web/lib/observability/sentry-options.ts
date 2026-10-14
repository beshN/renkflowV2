// Shared Sentry settings for the browser, Node and Edge runtimes.
// Without a DSN nothing is initialised, so local runs and previews without the variable send nothing.

type SentryEvent = {
  request?: { headers?: Record<string, string>; cookies?: unknown; data?: unknown; query_string?: unknown };
  user?: { id?: string | number; email?: string; ip_address?: string | null; username?: string };
};

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-renkflow-device', 'x-hub-signature-256', 'svix-signature'];

export function sentryDsn(): string | undefined {
  return (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || '').trim() || undefined;
}

function sampleRate(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

/** Drops credentials and personal data before an event leaves the server or the browser. */
export function scrubEvent<T extends SentryEvent>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    const headers = event.request.headers;
    if (headers) {
      for (const name of Object.keys(headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase())) delete headers[name];
      }
    }
  }
  if (event.user) {
    // Keep the opaque id only: the e-mail and IP are personal data (KVKK).
    event.user = event.user.id === undefined ? undefined : { id: event.user.id };
  }
  return event;
}

export function sentryOptions() {
  return {
    dsn: sentryDsn(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE ?? process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0),
    beforeSend: scrubEvent,
  };
}
