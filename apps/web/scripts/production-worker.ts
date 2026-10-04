/** Durable outbox/inbound worker; run alongside the web server. */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const { drainNotifications } =
    await import("../lib/features/manufacturing/notification.service");
  const { drainInbound } =
    await import("../lib/features/manufacturing/inbound.service");
  const { drainStorageCleanup } =
    await import("../lib/features/orders/deletion.service");
  let stopped = false;
  process.on("SIGINT", () => {
    stopped = true;
  });
  process.on("SIGTERM", () => {
    stopped = true;
  });
  while (!stopped) {
    for (const [name, drain] of [
      ["inbound", drainInbound],
      ["notifications", drainNotifications],
      ["storage-cleanup", drainStorageCleanup],
    ] as const) {
      try {
        await drain();
      } catch (e) {
        console.error(
          "[production-worker:" + name + "]",
          e instanceof Error ? e.message : "failed",
        );
      }
    }
    if (process.argv.includes("--once")) break;
    await new Promise((r) => setTimeout(r, 10000));
  }
  process.exit(0);
}
main().catch(() => process.exit(1));
