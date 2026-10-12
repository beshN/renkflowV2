/** Encrypt the pg_dump stream before it reaches disk or a CI artifact. */
import { createCipheriv, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream, appendFileSync, unlinkSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';

async function main() {
  const url = new URL(process.env.DATABASE_URL_UNPOOLED ?? '');
  const key = Buffer.from(process.env.PRODUCTION_DATABASE_BACKUP_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('BACKUP_KEY_REQUIRED');
  const local=['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const localTest=local && url.pathname==='/renkflow_test' && process.argv.includes('--local-test');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (local && !localTest) || url.searchParams.has('host')) throw new Error('PRODUCTION_TARGET_REQUIRED');
  const sslmode = url.searchParams.get('sslmode') ?? '';
  if (!localTest && !['require', 'verify-full', 'verify-ca'].includes(sslmode)) throw new Error('TLS_REQUIRED');
  const output = process.env.RELEASE_BACKUP_FILE ?? 'release-backup.dump.enc';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const file = createWriteStream(output, { flags: 'wx', mode: 0o600 });
  file.write(Buffer.concat([Buffer.from('RENKDB1'), iv]));
  const child = spawn(process.env.PG_DUMP_BINARY ?? 'pg_dump', ['--format=custom', '--no-owner', '--no-acl'], {
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME,
      PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: localTest ? 'disable' : sslmode,
    }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.resume(); // Never leak connection parameters or server messages to CI logs.
  const finished = new Promise<void>((resolve, reject) => {
    child.once('error', () => reject(new Error('PG_DUMP_FAILED')));
    child.once('close', code => code === 0 ? resolve() : reject(new Error('PG_DUMP_FAILED')));
  });
  try {
    await Promise.all([pipeline(child.stdout, cipher, file), finished]);
    appendFileSync(output, cipher.getAuthTag());
    console.log('[release-backup] Encrypted database backup completed');
  } catch {
    child.kill();
    try { unlinkSync(output); } catch { /* no plaintext or incomplete backup retained */ }
    throw new Error('BACKUP_FAILED');
  } finally { key.fill(0); }
}
main().catch(() => { console.error('[release-backup] Failed; no migration was started'); process.exitCode = 1; });
