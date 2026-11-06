import { isIP } from "node:net";

/** Resolve the actual endpoint explicitly: never inherit PGHOST/PGPORT. */
export function pilotReadinessConnection(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    /[,%]/.test(parsed.hostname)
  ) {
    throw new Error("Invalid database configuration");
  }
  // Preserve the existing Unix socket form, but require remote opt-in for it:
  // a local socket can proxy a remote database (for example Cloud SQL).
  const hostValues = parsed.searchParams.getAll("host");
  const socketHost = hostValues[0];
  if (
    hostValues.length > 1 ||
    (socketHost !== undefined && !socketHost.startsWith("/")) ||
    ["hostaddr", "hostname", "port"].some((key) => parsed.searchParams.has(key))
  ) {
    throw new Error("Ambiguous database endpoint");
  }
  parsed.searchParams.delete("host");
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const loopback =
    !socketHost &&
    (hostname === "localhost" ||
      hostname === "::1" ||
      (isIP(hostname) === 4 && hostname.split(".")[0] === "127"));
  return {
    connectionType: loopback ? ("yerel" as const) : ("uzak" as const),
    url: parsed.toString(),
    // Arrays prevent postgres.js splitting IPv6 literals or multi-host strings.
    host: [socketHost || hostname],
    port: [Number(parsed.port || 5432)],
    path: socketHost
      ? `${socketHost}/.s.PGSQL.${parsed.port || 5432}`
      : undefined,
  };
}
