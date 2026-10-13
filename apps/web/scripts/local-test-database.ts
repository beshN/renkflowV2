/** Test fixtures can select a free local port without accepting a remote database URL. */
export function localTestDatabasePort(): number {
  const raw=process.env.RENKFLOW_TEST_DB_PORT || '55432';
  const port=Number(raw);
  if(!/^\d+$/.test(raw) || !Number.isInteger(port) || port<1024 || port>65535)throw new Error('Invalid local test database port');
  return port;
}
export function localTestDatabaseURL(): string {
  return `postgres://postgres:renkflow-local-only@127.0.0.1:${localTestDatabasePort()}/renkflow_test`;
}
