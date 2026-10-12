/** A port override changes only a loopback fixture, never its credentials or database name. */
export function localDatabasePort(): number {
  const port = Number(process.env.LOCAL_DATABASE_PORT ?? '55432');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid LOCAL_DATABASE_PORT');
  return port;
}

export function localTestDatabaseUrl(): string {
  return `postgres://postgres:renkflow-local-only@127.0.0.1:${localDatabasePort()}/renkflow_test`;
}
