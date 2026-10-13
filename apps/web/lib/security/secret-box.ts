import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { resolveAuthSecret } from '@/lib/shared/config/runtime-env';

// Seals third-party secrets kept in the database (SSO client secrets, integrator credentials).
// AES-256-GCM with a key derived from the auth secret and the purpose, so a value sealed for one
// purpose cannot be opened as another. Rotating the auth secret makes sealed values unreadable:
// they must be entered again.

const PREFIX = 'sealed:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(purpose: string): Buffer {
  const secret = resolveAuthSecret({
    context: 'security.secret-box',
    allowDevelopmentFallback: process.env.NODE_ENV !== 'production',
    developmentFallback: 'development-only-fallback-secret',
  });
  if (!secret) throw new Error('[secret-box] AUTH_SECRET is required to seal secrets');
  return createHash('sha256').update(`renkflow-secret-box:${purpose}:${secret}`).digest();
}

export function sealSecret(value: string, purpose: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(purpose), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

/** Opens a sealed value. Values stored before sealing existed are returned as they are. */
export function openSecret(stored: string | null | undefined, purpose: string): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;
  const bytes = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(purpose), bytes.subarray(0, IV_BYTES));
  decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
}
