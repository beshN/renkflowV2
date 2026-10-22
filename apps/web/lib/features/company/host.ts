/** Only Host selects the company. Forwarded or client tenant headers never select an identity. */
export const COMPANY_ROOT_DOMAIN = "renkflow.com";
// Auth.js appends /callback/<provider>. Keep the existing registered Google callback.
export const COMPANY_AUTH_PROXY_URL = `https://${COMPANY_ROOT_DOMAIN}/api/auth`;
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "panel",
  "api",
  "admin",
  "auth",
  "login",
  "signup",
  "mail",
  "smtp",
  "imap",
  "pop",
  "ftp",
  "cdn",
  "assets",
  "static",
  "status",
  "support",
  "help",
  "docs",
  "blog",
  "billing",
  "vercel",
  "ns1",
  "ns2",
]);
export function validCompanyAddress(value: string) {
  return (
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) &&
    !RESERVED_SUBDOMAINS.has(value)
  );
}
export type CompanyHost =
  | { kind: "shared" }
  | { kind: "company"; address: string }
  | { kind: "invalid" };
export function parseCompanyHost(
  host: string | null,
  development = false,
): CompanyHost {
  if (!host || /[\s,/@\\?#]/.test(host)) return { kind: "invalid" };
  const normalized = host.toLowerCase();
  // 10.0.2.2 is the Android emulator's address for the developer's own machine.
  if (
    development &&
    /^(localhost|127\.0\.0\.1|10\.0\.2\.2|\[::1\])(?::\d{1,5})?$/.test(normalized)
  )
    return { kind: "shared" };
  if (development && /^[a-z0-9-]+\.localhost(?::\d{1,5})?$/.test(normalized)) {
    const address = normalized.split(".")[0];
    return validCompanyAddress(address)
      ? { kind: "company", address }
      : { kind: "invalid" };
  }
  const hostname = normalized.replace(/:443$/, "");
  if (
    [
      COMPANY_ROOT_DOMAIN,
      `www.${COMPANY_ROOT_DOMAIN}`,
      `panel.${COMPANY_ROOT_DOMAIN}`,
      `app.${COMPANY_ROOT_DOMAIN}`,
    ].includes(hostname)
  )
    return { kind: "shared" };
  if (/^[a-z0-9-]+\.vercel\.app$/.test(hostname)) return { kind: "shared" };
  const suffix = `.${COMPANY_ROOT_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return { kind: "invalid" };
  const address = hostname.slice(0, -suffix.length);
  return validCompanyAddress(address)
    ? { kind: "company", address }
    : { kind: "invalid" };
}

/** Auth.js may have a fixed base URL. Redirects stay on the actual, validated request host. */
export function companyAuthRedirect(
  url: string,
  baseUrl: string,
  host: string | null,
  secure: boolean,
  development = false,
) {
  if (parseCompanyHost(host, development).kind === "invalid") return baseUrl;
  const origin = `${secure ? "https" : "http"}://${host}`;
  try {
    if (/[\\\u0000-\u0020]/.test(url)) return origin + "/dashboard";
    if (url.startsWith("/") && !url.startsWith("//")) {
      const relative = new URL(url, origin);
      return relative.origin === origin ? relative.href : origin + "/dashboard";
    }
    const target = new URL(url);
    if (target.origin === origin) return target.href;
    if (target.origin === new URL(baseUrl).origin)
      return new URL(target.pathname + target.search + target.hash, origin)
        .href;
  } catch {
    /* Untrusted callback URLs never become redirects. */
  }
  return origin + "/dashboard";
}
