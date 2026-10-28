/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  BACKUP_HEADER_BYTES, BackupKeyMismatchError, backupKeyFromEnv, backupKeyId, createBackupDecryptStream, createBackupEncryptStream, parseBackupKey,
} from '@/lib/db/backup-crypto';
import { backupTableKey } from '@/lib/db/backup-manifest';

const key = randomBytes(32);
const storageKey = 'backups/2026-10-28/users.csv.gz.enc';

async function run(input: Buffer, transform: NodeJS.ReadWriteStream, chunk = 7): Promise<Buffer> {
  const out: Buffer[] = [];
  const pieces = Array.from({ length: Math.ceil(input.length / chunk) || 1 }, (_, i) => input.subarray(i * chunk, (i + 1) * chunk));
  await pipeline(Readable.from(pieces.filter((p) => p.length)), transform, async function (s: AsyncIterable<Buffer | string>) { for await (const c of s) out.push(Buffer.from(c)); });
  return Buffer.concat(out);
}

describe('backup file encryption', () => {
  it('round trips in any chunking; header carries magic, version and key id; random IV per file', async () => {
    const plain = randomBytes(10_000);
    const a = await run(plain, createBackupEncryptStream(key, storageKey), 4096);
    const b = await run(plain, createBackupEncryptStream(key, storageKey), 4096);
    expect(a.subarray(0, 4).toString('ascii')).toBe('RFBK');
    expect(a[4]).toBe(1);
    expect(a.subarray(5, 9).toString('hex')).toBe(backupKeyId(key));
    expect(a.length).toBe(plain.length + BACKUP_HEADER_BYTES + 16);
    expect(a.equals(b)).toBe(false);
    for (const size of [1, 7, 16, 17, 4096, 100_000]) expect((await run(a, createBackupDecryptStream(key, storageKey), size)).equals(plain)).toBe(true);
  });

  it('an empty body still gets a header and a tag', async () => {
    const enc = await run(Buffer.alloc(0), createBackupEncryptStream(key, storageKey));
    expect(enc.length).toBe(BACKUP_HEADER_BYTES + 16);
    expect((await run(enc, createBackupDecryptStream(key, storageKey))).length).toBe(0);
  });

  it('refuses a wrong key by its id, before any plaintext', async () => {
    const enc = await run(Buffer.from('id,password\n1,secret\n'), createBackupEncryptStream(key, storageKey));
    await expect(run(enc, createBackupDecryptStream(randomBytes(32), storageKey))).rejects.toBeInstanceOf(BackupKeyMismatchError);
  });

  it('a changed byte, another file name (swapped file) or a cut-off file fails authentication', async () => {
    const enc = await run(randomBytes(500), createBackupEncryptStream(key, storageKey));
    const tampered = Buffer.from(enc);
    tampered[BACKUP_HEADER_BYTES + 3] ^= 1;
    await expect(run(tampered, createBackupDecryptStream(key, storageKey))).rejects.toThrow(/doğrulanamadı/);
    await expect(run(enc, createBackupDecryptStream(key, 'backups/2026-10-28/customers.csv.gz.enc'))).rejects.toThrow(/doğrulanamadı/);
    await expect(run(enc.subarray(0, enc.length - 5), createBackupDecryptStream(key, storageKey))).rejects.toThrow(/doğrulanamadı/);
    await expect(run(enc.subarray(0, 10), createBackupDecryptStream(key, storageKey))).rejects.toThrow(/kesik/);
    await expect(run(Buffer.from('not an encrypted backup file at all'), createBackupDecryptStream(key, storageKey))).rejects.toThrow(/başlık/);
  });

  it('key parsing: exactly 32 base64 bytes; unset means unencrypted', () => {
    const b64 = key.toString('base64');
    expect(parseBackupKey(`${b64}\n`).equals(key)).toBe(true);
    expect(() => parseBackupKey(randomBytes(16).toString('base64'))).toThrow(/32 bayt/);
    expect(() => parseBackupKey('not base64!')).toThrow(/base64/);
    expect(backupKeyFromEnv({})).toBeNull();
    expect(backupKeyFromEnv({ BACKUP_ENCRYPTION_KEY: '  ' })).toBeNull();
    expect(backupKeyFromEnv({ BACKUP_ENCRYPTION_KEY: b64 })!.equals(key)).toBe(true);
    expect(backupKeyId(key)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('file names: .csv.gz.enc when encrypted', () => {
    expect(backupTableKey('2026-10-28', 'users')).toBe('backups/2026-10-28/users.csv.gz');
    expect(backupTableKey('2026-10-28', 'users', true)).toBe('backups/2026-10-28/users.csv.gz.enc');
  });
});
