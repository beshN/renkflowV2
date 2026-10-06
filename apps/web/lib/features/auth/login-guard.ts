import 'server-only';
import bcrypt from 'bcryptjs';
import {
  consumeRateLimit,
  resetRateLimit,
  type RateLimitResult,
} from '@/lib/security/rate-limit';

// Cost-12 hash of a throwaway value. Comparing against it when the account is
// missing keeps response times equal, so timing cannot reveal registered emails.
const TIMING_EQUALIZER_HASH = '$2b$12$CBKjszu.wTV1YVkzEEFsO.itB.FgagreR8yihr1hujAvXGrOy0nV2';

/** Counts a login attempt against both the client IP and the target account. */
export async function consumeLoginAttempt(ip: string, email: string): Promise<RateLimitResult> {
  const [byIp, byAccount] = await Promise.all([
    consumeRateLimit('loginIp', ip),
    consumeRateLimit('loginAccount', email),
  ]);
  return byIp.allowed ? byAccount : byIp;
}

export async function clearLoginAttempts(email: string): Promise<void> {
  await resetRateLimit('loginAccount', email);
}

/** bcrypt comparison that costs the same whether or not a password hash exists. */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, TIMING_EQUALIZER_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}
