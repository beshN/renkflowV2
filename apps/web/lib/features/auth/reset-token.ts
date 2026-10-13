// Password reset tokens: the e-mail carries the raw token, the database keeps only its SHA-256 hash.
// Web Crypto keeps this usable from any runtime.

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 32 random bytes as hex, sent to the user once. */
export function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** The value stored in `users.password_reset_token` and compared on use. */
export async function hashResetToken(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}
