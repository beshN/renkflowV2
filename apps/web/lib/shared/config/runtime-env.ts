import 'server-only';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';

let warnedSecretMismatch = false;

function readEnvValue(value: string | undefined): string {
  return value?.trim() || '';
}

type ResolveAuthSecretOptions = {
  context?: string;
  allowMissing?: boolean;
  allowDevelopmentFallback?: boolean;
  developmentFallback?: string;
};

export function resolveAuthSecret(options: ResolveAuthSecretOptions = {}): string | undefined {
  const context = options.context || 'auth';
  const authSecret = readEnvValue(process.env.AUTH_SECRET);
  const nextAuthSecret = readEnvValue(process.env.NEXTAUTH_SECRET);

  if (authSecret && nextAuthSecret && authSecret !== nextAuthSecret) {
    const message =
      `[${context}] AUTH_SECRET and NEXTAUTH_SECRET must match. ` +
      'Use a single shared secret value in all environments.';
    if (IS_PRODUCTION && !IS_BUILD_TIME) {
      throw new Error(message);
    }
    if (!warnedSecretMismatch) {
      warnedSecretMismatch = true;
      console.warn(`${message} Using AUTH_SECRET precedence in non-production runtime.`);
    }
  }

  const resolved = authSecret || nextAuthSecret;
  if (resolved) {
    return resolved;
  }

  if (options.allowDevelopmentFallback && !IS_PRODUCTION) {
    return options.developmentFallback || 'development-only-fallback-secret';
  }

  if (!options.allowMissing && IS_PRODUCTION && !IS_BUILD_TIME) {
    throw new Error(
      `[${context}] Missing AUTH_SECRET/NEXTAUTH_SECRET in production runtime.`
    );
  }

  return undefined;
}

type ResolveBaseUrlOptions = {
  context?: string;
  fallbackOrigin?: string;
  allowMissing?: boolean;
  allowLocalhostInProduction?: boolean;
};

export function resolveServerBaseUrl(options: ResolveBaseUrlOptions = {}): string | undefined {
  const context = options.context || 'runtime';
  const envUrl = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .map(readEnvValue)
    .find(Boolean);
  const fallbackOrigin = readEnvValue(options.fallbackOrigin);
  const rawUrl = envUrl || fallbackOrigin;

  if (!rawUrl) {
    if (!options.allowMissing && IS_PRODUCTION && !IS_BUILD_TIME) {
      throw new Error(
        `[${context}] Missing AUTH_URL/NEXTAUTH_URL/NEXT_PUBLIC_APP_URL in production runtime.`
      );
    }

    if (options.allowMissing) {
      return undefined;
    }

    return 'http://localhost:3000';
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`[${context}] Invalid URL value: ${rawUrl}`);
  }

  const isLocalhost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';

  if (IS_PRODUCTION && !IS_BUILD_TIME && isLocalhost && !options.allowLocalhostInProduction) {
    throw new Error(
      `[${context}] Production URL cannot point to localhost. Configure Cloud Run URL via AUTH_URL/NEXTAUTH_URL.`
    );
  }

  return parsed.origin;
}
