/** @jest-environment node */
import { pilotReadinessConnection } from "../../scripts/pilot-readiness-connection";

it.each(["localhost", "127.0.0.1", "127.12.34.56", "[::1]"])(
  "accepts loopback %s and explicitly pins the actual endpoint",
  (host) => {
    const connection = pilotReadinessConnection(
      `postgres://user:secret@${host}:55432/local_test`,
    );
    expect(connection.connectionType).toBe("yerel");
    expect(connection.host).toEqual([host.replace(/^\[|\]$/g, "")]);
    expect(connection.port).toEqual([55432]);
  },
);
it.each([
  "db.example.invalid",
  "localhost.example.invalid",
  "0.0.0.0",
  "10.0.0.1",
  "[::ffff:127.0.0.1]",
  "[::]",
])("classifies %s as remote", (host) => {
  expect(
    pilotReadinessConnection(`postgres://user:secret@${host}/test`)
      .connectionType,
  ).toBe("uzak");
});
it("does not inherit environment host or port", () => {
  const oldHost = process.env.PGHOST,
    oldPort = process.env.PGPORT;
  try {
    process.env.PGHOST = "remote.example.invalid";
    process.env.PGPORT = "12345";
    expect(
      pilotReadinessConnection("postgres://user@localhost/test"),
    ).toMatchObject({
      connectionType: "yerel",
      host: ["localhost"],
      port: [5432],
    });
  } finally {
    if (oldHost === undefined) delete process.env.PGHOST;
    else process.env.PGHOST = oldHost;
    if (oldPort === undefined) delete process.env.PGPORT;
    else process.env.PGPORT = oldPort;
  }
});
it("treats a socket override as remote even with a loopback URL hostname", () => {
  expect(
    pilotReadinessConnection(
      "postgres://user@localhost/test?host=%2Fcloudsql%2Ftest",
    ),
  ).toMatchObject({ connectionType: "uzak", host: ["/cloudsql/test"] });
});
it.each([
  "https://localhost/test",
  "postgres:///test",
  "postgres://user@localhost/test?host=remote.example.invalid",
  "postgres://user@localhost/test?hostaddr=10.0.0.1",
  "postgres://user@localhost/test?hostname=remote.example.invalid",
  "postgres://user@localhost/test?host=%2Ftmp&host=%2Fother",
  "postgres://user@localhost/test?port=12345",
  "postgres://user@localhost,remote.example.invalid/test",
])(
  "rejects unsupported or ambiguous endpoint before creating a client",
  (value) => {
    expect(() => pilotReadinessConnection(value)).toThrow();
  },
);
