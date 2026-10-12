/** Verify authenticated encryption and archive identity without writing plaintext to disk. */
import { createDecipheriv } from 'node:crypto';
import { closeSync, createReadStream, openSync, readSync, statSync } from 'node:fs';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

async function main() {
  const file = process.env.RELEASE_BACKUP_FILE ?? 'release-backup.dump.enc';
  const key = Buffer.from(process.env.PRODUCTION_DATABASE_BACKUP_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('Invalid backup key');
  const size = statSync(file).size;
  if (size < 40) throw new Error('Invalid backup');
  const fd = openSync(file, 'r');
  const header = Buffer.alloc(19), tag = Buffer.alloc(16);
  try { readSync(fd, header, 0, 19, 0); readSync(fd, tag, 0, 16, size - 16); } finally { closeSync(fd); }
  if (header.subarray(0, 7).toString() !== 'RENKDB1') throw new Error('Invalid backup format');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(7));
  decipher.setAuthTag(tag);
  let signature = Buffer.alloc(0);
  const sink = new Writable({ write(chunk: Buffer, _encoding, done) {
    if (signature.length < 5) signature = Buffer.concat([signature, chunk]).subarray(0, 5);
    done();
  } });
  try {
    await pipeline(createReadStream(file, { start: 19, end: size - 17 }), decipher, sink);
    if (signature.toString() !== 'PGDMP') throw new Error('Not a PostgreSQL archive');
    console.log('[release-backup] Authentication and PostgreSQL archive identity verified');
  } finally { key.fill(0); }
}
main().catch(() => { console.error('[release-backup] Verification failed; no migration was started'); process.exitCode = 1; });
