/** A browser's claimed origin must match the actual protocol and host, never forwarded input. */
export function isSameOriginRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // Non-browser clients are authenticated by their own credentials.
  try {
    const source = new URL(origin), expected = new URL(request.url);
    expected.host = request.headers.get('host') || expected.host;
    return source.origin === expected.origin && !source.username && !source.password && source.pathname === '/' && !source.search && !source.hash;
  } catch { return false; }
}

/** Central cookie-authenticated API boundary; public token callbacks have their own protocol. */
export function isForeignSessionWrite(request: Request, hasSession: boolean): boolean {
  return hasSession && !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase()) && !isSameOriginRequest(request);
}
