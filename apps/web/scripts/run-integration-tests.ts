/**
 * Runs every `scripts/test-*.ts` integration script against a fresh, throwaway local PostgreSQL.
 *
 * The cluster lives in a temp directory on a free port, so a run never reuses data from an earlier
 * run and never collides with a developer's `npm run db:local`. Nothing here accepts a remote URL.
 *
 *   npm run test:integration                 all scripts
 *   npm run test:integration -- sales chain  only test-sales.ts and test-chain.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
// Not integration tests: test-db.ts only probes the DATABASE_URL in .env.local.
const EXCLUDED = new Set(['test-db.ts']);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

// A script that hangs is stopped and reported by name, instead of silently using up the CI step's time.
const SCRIPT_TIMEOUT_MS = Number(process.env.RENKFLOW_TEST_SCRIPT_TIMEOUT_S || 180) * 1000;

function run(command: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs = SCRIPT_TIMEOUT_MS): Promise<{ code: number; output: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
    }, timeoutMs);
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: timedOut ? 1 : code ?? 1, output: timedOut ? `${output}\n[timed out after ${timeoutMs / 1000} s]` : output, timedOut });
    });
  });
}

function startDatabase(env: NodeJS.ProcessEnv): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/dev-database.ts'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const timer = setTimeout(() => reject(new Error(`database did not start in 180 s\n${log}`)), 180_000);
    const onData = (chunk: Buffer) => {
      log += chunk;
      if (log.includes('Local PostgreSQL ready')) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`database exited (${code})\n${log}`));
    });
  });
}

async function main() {
  const only = process.argv.slice(2).map((name) => `test-${name.replace(/^test-|\.ts$/g, '')}.ts`);
  const scripts = readdirSync(path.join(ROOT, 'scripts'))
    .filter((name) => /^test-.*\.ts$/.test(name) && !EXCLUDED.has(name))
    .filter((name) => !only.length || only.includes(name))
    .sort();
  if (!scripts.length) throw new Error(`no integration scripts match: ${only.join(', ')}`);

  const directory = mkdtempSync(path.join(tmpdir(), 'renkflow-integration-'));
  const env = { ...process.env, RENKFLOW_TEST_DB_PORT: String(await freePort()), RENKFLOW_TEST_DB_DIR: directory };
  delete env.DATABASE_URL;
  delete env.DATABASE_URL_UNPOOLED;

  const database = await startDatabase(env);
  const failures: string[] = [];
  try {
    const mobile = await run(process.execPath, ['--import', 'tsx', '../../scripts/mobile/apply-local-schema.ts'], env);
    if (mobile.code !== 0) throw new Error(`mobile schema failed\n${mobile.output}`);

    for (const script of scripts) {
      const started = Date.now();
      const result = await run(process.execPath, ['--require', './scripts/register-server-only.cjs', '--import', 'tsx', `scripts/${script}`], env);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (result.code === 0) {
        console.log(`ok   ${script} (${seconds} s)`);
      } else {
        failures.push(script);
        console.log(`FAIL ${script} (${seconds} s${result.timedOut ? ', timed out' : ''})\n${result.output.trim()}\n`);
      }
    }
  } finally {
    database.kill('SIGTERM');
    await new Promise((resolve) => database.once('exit', resolve));
    rmSync(directory, { recursive: true, force: true });
  }

  console.log(`\n${scripts.length - failures.length}/${scripts.length} integration scripts passed`);
  if (failures.length) {
    console.log(`Failed: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
