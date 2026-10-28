/**
 * Application-level encryption of the daily backup files (audit: "Yedek sırları"). Shared by the
 * backup cron (lib/db/backup.server.ts) and scripts/restore-backup.ts; no server imports.
 *
 * Each table file is gzipped CSV, then AES-256-GCM encrypted with BACKUP_ENCRYPTION_KEY (32 random
 * bytes, base64) and a fresh random 12-byte IV. Streaming layout of a `.csv.gz.enc` file:
 *
 *   "RFBK" (4) | version 0x01 (1) | key id (4) | IV (12) | ciphertext … | GCM auth tag (16)
 *
 * The tag comes last because it is only known once the whole stream is encrypted (no table is
 * held in memory). The header and the file's storage key are authenticated as GCM additional data,
 * so a file cannot be swapped for another table's or another day's file without failing.
 * The key id is the first 8 hex characters of sha256(key): the manifest names it, a wrong key is
 * refused before any byte is restored.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, type DecipherGCM } from "node:crypto";
import { Transform, type TransformCallback } from 'node:stream';

export const BACKUP_ENCRYPTION_ALG = 'aes-256-gcm' as const;
export const BACKUP_ENCRYPTION_FORMAT = 'RFBK1' as const;
export type BackupEncryption = { alg: typeof BACKUP_ENCRYPTION_ALG; keyId: string; format: typeof BACKUP_ENCRYPTION_FORMAT };

const MAGIC = Buffer.from('RFBK', 'ascii');
const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ID_BYTES = 4;
export const BACKUP_HEADER_BYTES = MAGIC.length + 1 + KEY_ID_BYTES + IV_BYTES;

/** BACKUP_ENCRYPTION_KEY → 32-byte key. Anything else is an error, never a silent fallback. */
export function parseBackupKey(raw: string): Buffer {
  const text = raw.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('BACKUP_ENCRYPTION_KEY base64 olmalı (openssl rand -base64 32)');
  const key = Buffer.from(text, 'base64');
  if (key.length !== 32) throw new Error(`BACKUP_ENCRYPTION_KEY 32 bayt olmalı (şu an ${key.length}); openssl rand -base64 32 ile üretin`);
  return key;
}

/** First 8 hex characters of sha256(key): identifies the key without revealing it. */
export function backupKeyId(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

/** The key from the environment, or null when backups run unencrypted. */
export function backupKeyFromEnv(env?: Record<string, string | undefined>): Buffer | null {
  const raw = env ? env.BACKUP_ENCRYPTION_KEY : process.env.BACKUP_ENCRYPTION_KEY;
  return raw && raw.trim() ? parseBackupKey(raw) : null;
}

function header(keyId: string, iv: Buffer): Buffer {
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), Buffer.from(keyId, 'hex'), iv]);
}
const aad = (head: Buffer, storageKey: string) => Buffer.concat([head, Buffer.from(storageKey, 'utf8')]);

/** gzip bytes in → header, ciphertext, tag out. `storageKey` is bound to the file as additional data. */
export function createBackupEncryptStream(key: Buffer, storageKey: string): Transform {
  const iv = randomBytes(IV_BYTES);
  const head = header(backupKeyId(key), iv);
  const cipher = createCipheriv(BACKUP_ENCRYPTION_ALG, key, iv);
  cipher.setAAD(aad(head, storageKey));
  let started = false;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      if (!started) { started = true; this.push(head); }
      callback(null, cipher.update(chunk));
    },
    flush(callback: TransformCallback) {
      if (!started) this.push(head);
      this.push(cipher.final());
      callback(null, cipher.getAuthTag());
    },
  });
}

export class BackupKeyMismatchError extends Error {
  constructor(readonly expected: string, readonly actual: string) {
    super(`Yedek ${expected} kimlikli anahtarla şifrelenmiş; verilen anahtarın kimliği ${actual}. Doğru BACKUP_ENCRYPTION_KEY (veya --key-file) gerekli.`);
    this.name = 'BackupKeyMismatchError';
  }
}

/**
 * header + ciphertext + tag in → gzip bytes out. Plaintext is released before the tag is checked
 * (streaming); a wrong tag fails the stream at its end, so the consumer must be transactional
 * (restore-backup.ts COPYs inside one transaction and rolls back on any error).
 */
export function createBackupDecryptStream(key: Buffer, storageKey: string): Transform {
  const keyId = backupKeyId(key);
  let head: Buffer = Buffer.alloc(0);
  let decipher: DecipherGCM | null = null;
  let held: Buffer = Buffer.alloc(0);
  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      try {
        let data = chunk;
        if (!decipher) {
          head = Buffer.concat([head, data]);
          if (head.length < BACKUP_HEADER_BYTES) return callback();
          data = head.subarray(BACKUP_HEADER_BYTES);
          head = head.subarray(0, BACKUP_HEADER_BYTES);
          if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Şifreli yedek dosyası değil (başlık tanınmadı)');
          if (head[MAGIC.length] !== VERSION) throw new Error(`Bilinmeyen şifreli yedek sürümü ${head[MAGIC.length]}`);
          const fileKeyId = head.subarray(MAGIC.length + 1, MAGIC.length + 1 + KEY_ID_BYTES).toString('hex');
          if (fileKeyId !== keyId) throw new BackupKeyMismatchError(fileKeyId, keyId);
          decipher = createDecipheriv(BACKUP_ENCRYPTION_ALG, key, head.subarray(MAGIC.length + 1 + KEY_ID_BYTES)) as DecipherGCM;
          decipher.setAAD(aad(head, storageKey));
        }
        // The last 16 bytes are the tag: always hold them back.
        held = Buffer.concat([held, data]);
        if (held.length <= TAG_BYTES) return callback();
        const body = held.subarray(0, held.length - TAG_BYTES);
        held = held.subarray(held.length - TAG_BYTES);
        callback(null, decipher.update(body));
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback: TransformCallback) {
      try {
        if (!decipher || held.length !== TAG_BYTES) throw new Error('Şifreli yedek dosyası kesik');
        decipher.setAuthTag(held);
        callback(null, decipher.final());
      } catch (error) {
        callback(error instanceof BackupKeyMismatchError ? error : new Error(`Şifreli yedek doğrulanamadı (dosya bozuk, değiştirilmiş veya başka bir tabloya ait): ${error instanceof Error ? error.message : error}`));
      }
    },
  });
}
