/** Empty, throwaway loopback database for the dedicated CI pilot integration step. */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { localTestDatabasePort, localTestDatabaseURL } from "./local-test-database";

const ROOT = path.resolve(__dirname, "..");
const controller = new AbortController();
const children: ChildProcess[] = [];
const interrupt = () => controller.abort();

function start(args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn("npm", args, {
    cwd: ROOT,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  // Never forward database addresses, passwords, or server error details.
  child.stderr?.resume();
  return child;
}

function waitFor(child: ChildProcess, ready: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    let tail = "";
    const finish = (error?: Error) => {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", aborted);
      child.removeListener("error", failed);
      child.removeListener("close", closed);
      child.stdout?.removeListener("data", data);
      // Keep draining pipes after readiness, without retaining or exposing raw logs.
      child.stdout?.resume();
      if (error) reject(error);
      else resolve();
    };
    const failed = () => finish(new Error("Pilot readiness subprocess failed."));
    const closed = (code: number | null) => {
      if (ready || code !== 0) failed();
      else finish();
    };
    const aborted = () => finish(new Error("Pilot readiness interrupted."));
    const data = (chunk: Buffer) => {
      if (!ready) return;
      tail = (tail + chunk.toString()).slice(-4096);
      if (tail.includes("Local PostgreSQL ready")) finish();
    };
    const timer = setTimeout(() => finish(new Error(
      ready ? "Local database readiness timed out after 180 s." : "Pilot readiness tests timed out after 180 s.",
    )), 180_000);
    child.on("error", failed);
    child.on("close", closed);
    child.stdout?.on("data", data);
    controller.signal.addEventListener("abort", aborted, { once: true });
    if (controller.signal.aborted) aborted();
  });
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals | 0): boolean {
  if (!child.pid) return false;
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw new Error("Local subprocess cleanup failed.");
  }
}

async function stop(child: ChildProcess) {
  if (!signalGroup(child, "SIGTERM")) return;
  for (let i = 0; i < 100; i++) {
    if (!signalGroup(child, 0)) return;
    await delay(100);
  }
  signalGroup(child, "SIGKILL");
  // Reap the direct child before removing the temporary cluster.
  if (child.exitCode === null && child.signalCode === null)
    await new Promise<void>((resolve) => child.once("close", () => resolve()));
}

async function main() {
  const started = Date.now();
  const port = String(localTestDatabasePort());
  // The supplied directory is a parent only: every invocation creates a new empty cluster.
  const directory = mkdtempSync(path.join(
    process.env.RENKFLOW_TEST_DB_DIR || tmpdir(),
    "renkflow-pilot-",
  ));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RENKFLOW_TEST_DB_PORT: port,
    RENKFLOW_TEST_DB_DIR: directory,
    DATABASE_URL: localTestDatabaseURL(),
  };
  delete env.DATABASE_URL_UNPOOLED;
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    const database = start(["run", "db:local", "--", "--empty"], env);
    await waitFor(database, true);
    console.log("Local PostgreSQL ready (empty isolated cluster).");
    const tests = start(["run", "test:pilot-readiness"], env);
    await waitFor(tests, false);
    if (database.exitCode !== null || database.signalCode !== null)
      throw new Error("Local database stopped unexpectedly.");
    console.log("PASS · pilot readiness: empty DB, remote guard, read-only session, tenant isolation.");
  } finally {
    try {
      for (const child of children.reverse()) await stop(child);
      rmSync(directory, { recursive: true, force: true });
      console.log(`Local database processes stopped (${((Date.now() - started) / 1000).toFixed(1)} s).`);
    } finally {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
    }
  }
}

main().catch(() => {
  console.error("Pilot readiness CI failed; local subprocess output withheld to protect connection details.");
  process.exitCode = 1;
});
